import { once } from "node:events";
import { io as createClient, type Socket } from "socket.io-client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClientToServerEvents, ServerToClientEvents } from "./events";
import type { RoomSnapshot } from "./game";

type AckResult = {
  roomId?: string;
  code?: string;
  hostId?: string;
  hostToken?: string;
  playerId?: string;
  token?: string;
  paused?: boolean;
  error?: string;
};

process.env.GAME_SERVER_NO_LISTEN = "1";
process.env.PORT = "0";
const { httpServer } = await import("../../server/index");

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;
const clients: ClientSocket[] = [];
let address: string;

function connect(): Promise<ClientSocket> {
  const client: ClientSocket = createClient(address, { forceNew: true, reconnection: false });
  clients.push(client);
  return new Promise((resolve, reject) => {
    client.once("connect", () => resolve(client));
    client.once("connect_error", reject);
  });
}

function updateFor(
  client: ClientSocket,
  roomId: string,
  predicate: (snapshot: RoomSnapshot) => boolean = () => true,
  timeoutMs = 5000
): Promise<RoomSnapshot> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Room update timed out")), timeoutMs);
    client.on("room:update", function listener(snapshot) {
      if (snapshot.id !== roomId || !predicate(snapshot)) return;
      clearTimeout(timeout);
      client.off("room:update", listener);
      resolve(snapshot);
    });
  });
}

function ack(register: (reply: (result: AckResult) => void) => void): Promise<AckResult> {
  return new Promise((resolve) => register(resolve));
}

function cardsFor(client: ClientSocket): Promise<string[]> {
  return new Promise((resolve) => client.once("player:cards", resolve));
}

beforeAll(async () => {
  httpServer.listen(0);
  await once(httpServer, "listening");
  const serverAddress = httpServer.address();
  if (!serverAddress || typeof serverAddress === "string") throw new Error("Test server did not bind a TCP port");
  address = `http://127.0.0.1:${serverAddress.port}`;
});

afterAll(async () => {
  for (const client of clients) client.disconnect();
  await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

describe("realtime room and answer flow", () => {
  it("assigns private cards and accepts only a valid first answer", async () => {
    const host = await connect();
    const created = await ack((reply) => host.emit("host:create", reply));
    const roomId = created.roomId!;
    const roomCode = created.code!;
    const hostId = created.hostId!;
    const hostToken = created.hostToken!;
    const hostUpdate = updateFor(host, roomId);
    host.emit("room:subscribe", { roomId, hostId, hostToken }, () => undefined);
    await hostUpdate;

    const players = await Promise.all(
      Array.from({ length: 6 }, async (_, index) => {
        const client = await connect();
        const joined = await ack((reply) =>
          client.emit("room:join", { code: roomCode, name: `Pemain ${index + 1}`, avatar: "🦊" }, reply)
        );
        if (!joined.playerId || !joined.token) throw new Error(joined.error ?? "Player join failed");
        return { client, id: joined.playerId };
      })
    );

    const receivedCards = players.map(({ client }) => cardsFor(client));
    const readingUpdate = updateFor(
      host,
      roomId,
      (snapshot) => snapshot.match?.phase === "reading" && Boolean(snapshot.match?.question),
      10000
    );
    const startUpdate = updateFor(
      host,
      roomId,
      (snapshot) =>
        snapshot.status === "running" &&
        snapshot.match?.phase === "answering" &&
        Boolean(snapshot.match?.question),
      15000
    );
    const started = await ack((reply) => host.emit("host:start", { roomId }, reply));
    expect(started.error).toBeUndefined();

    const readingSnapshot = await readingUpdate;
    const cardEvents = await Promise.all(receivedCards);
    expect(cardEvents).toHaveLength(6);
    const assignments = new Map(players.map((player, index) => [player.id, cardEvents[index]]));
    const readingQuestion = readingSnapshot.match!;
    const readingPlayer = readingSnapshot.players.find(
      (candidate) =>
        candidate.teamId === readingQuestion.teamIds[0] && assignments.get(candidate.id)?.includes("A")
    )!;
    const readingClient = players.find((candidate) => candidate.id === readingPlayer.id)!.client;
    const earlyRaise = await ack((reply) =>
      readingClient.emit(
        "card:raise",
        { roomId, matchId: readingQuestion.id, questionId: readingQuestion.question!.id, card: "A" },
        reply
      )
    );
    expect(earlyRaise.error).toBeTruthy();

    const snapshot = await startUpdate;
    expect(snapshot.teams).toHaveLength(2);
    expect(snapshot.teams.every((team) => team.playerIds.length === 3)).toBe(true);
    expect(snapshot.match?.question?.number).toBe(1);
    expect(snapshot.match?.question).not.toHaveProperty("correctIndex");
    expect(snapshot.players.every((player) => player.cards.length === 0)).toBe(true);

    for (const team of snapshot.teams) {
      expect(team.playerIds.flatMap((id) => assignments.get(id) ?? []).sort()).toEqual(["A", "B", "C", "D", "E"]);
    }

    const activeQuestion = snapshot.match!;
    const playerForCard = snapshot.players.find(
      (candidate) => candidate.teamId === activeQuestion.teamIds[0] && assignments.get(candidate.id)?.includes("A")
    )!;
    const playerClient = players.find((candidate) => candidate.id === playerForCard.id)!.client;
    const damageUpdate = updateFor(host, roomId);
    const answer = await ack((reply) =>
      playerClient.emit("card:raise", { roomId, matchId: activeQuestion.id, questionId: activeQuestion.question!.id, card: "A" }, reply)
    );
    expect(answer.error).toBeUndefined();
    const damage = await damageUpdate;
    expect(damage.match?.status).toBe("locked");
    expect(damage.match?.feedback?.correct).toBe(true);
    expect(damage.match?.hp[activeQuestion.teamIds[1]]).toBeLessThan(100);
    expect(damage.leaderboard?.[0]?.playerId).toBe(playerForCard.id);

    const rejected = await ack((reply) =>
      playerClient.emit("card:raise", { roomId, matchId: activeQuestion.id, questionId: activeQuestion.question!.id, card: "A" }, reply)
    );
    expect(rejected.error).toBeTruthy();
  }, 30000);

  it("supports multi-team tournament bracket with bye, pause/skip controls, and display spectator", async () => {
    const host = await connect();
    const created = await ack((reply) => host.emit("host:create", { quizId: "irab-jurumiyah" }, reply));
    const roomId = created.roomId!;
    const roomCode = created.code!;

    await Promise.all(
      Array.from({ length: 11 }, async (_, index) => {
        const client = await connect();
        await ack((reply) =>
          client.emit("room:join", { code: roomCode, name: `Santri ${index + 1}`, avatar: "🦉" }, reply)
        );
      })
    );

    const displayClient = await connect();
    const spectated = await ack((reply) => displayClient.emit("room:spectate", { roomIdOrCode: roomCode }, reply));
    expect(spectated.roomId).toBe(roomId);

    const runningUpdate = updateFor(
      displayClient,
      roomId,
      (snapshot) => snapshot.status === "running" && Boolean(snapshot.bracket?.length)
    );
    await ack((reply) => host.emit("host:start", { roomId }, reply));
    const snapshot = await runningUpdate;
    expect(snapshot.teams).toHaveLength(3);
    expect(snapshot.bracket?.[0]?.byeTeamId).toBeTruthy();
    expect(snapshot.bracket?.[0]?.matches).toHaveLength(1);

    await updateFor(displayClient, roomId, (s) => s.match?.phase === "answering", 15000);

    const pausedUpdate = updateFor(displayClient, roomId, (s) => s.match?.status === "paused");
    const pausedRes = await ack((reply) => host.emit("host:pause", { roomId }, reply));
    expect(pausedRes.paused).toBe(true);
    await pausedUpdate;

    const skippedUpdate = updateFor(displayClient, roomId, (s) => s.match?.questionNumber === 2);
    const skipRes = await ack((reply) => host.emit("host:skip", { roomId }, reply));
    expect(skipRes.error).toBeUndefined();
    await skippedUpdate;
  }, 30000);
});
