import { createServer } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { Server } from "socket.io";
import { z } from "zod";
import {
  assignCards,
  assignTeams,
  buildLeaderboard,
  calculateDamage,
  CARD_LETTERS,
  createBracketPairing,
  createEmptyStats,
  DEFAULT_CONFIG,
  redistributeTeamCards,
  type AnswerFeedback,
  type CardLetter,
  type MatchView,
  type PublicQuestion,
  type QuizQuestion,
  type RoomSnapshot,
  type Team,
} from "../src/lib/game";
import { getQuizById } from "../src/lib/quiz-store";
import type { ClientToServerEvents, HostCreateReply, ServerToClientEvents } from "../src/lib/events";

const port = Number(process.env.PORT ?? 3001);
const shouldListen = process.env.GAME_SERVER_NO_LISTEN !== "1";
const MATCH_COUNTDOWN_MS = 3000;
const httpServer = createServer((_, response) => {
  const latestLobby = [...rooms.values()].reverse().find((room) => room.status === "lobby");
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "ok", activeLobbyCode: latestLobby?.code ?? null }));
});
const configuredOrigins = new Set(process.env.WEB_ORIGIN?.split(",").map((origin) => origin.trim()).filter(Boolean) ?? []);
const localOrigin = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?::\d+)?$/;
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: (origin, callback) => {
      if (!origin || configuredOrigins.has(origin) || localOrigin.test(origin)) callback(null, true);
      else callback(new Error("Origin tidak diizinkan."));
    },
    methods: ["GET", "POST"],
  },
});

type MatchState = MatchView & {
  questionIndex: number;
  questionStartedAt: number;
  pausedRemainingMs?: number;
  questionTimer?: NodeJS.Timeout;
  readingTimer?: NodeJS.Timeout;
  countdownTimer?: NodeJS.Timeout;
  advanceTimer?: NodeJS.Timeout;
  submissions: Set<string>;
  tieBreaker: boolean;
  tieBreakerCount: number;
};

type RoomState = RoomSnapshot & {
  questions: QuizQuestion[];
  activeMatches: MatchState[];
  roundAdvanceTimer?: NodeJS.Timeout;
  usedByes: Set<string>;
  hostToken: string;
};

const rooms = new Map<string, RoomState>();
const playerSessions = new Map<string, { roomId: string; token: string }>();
const socketPlayers = new Map<string, string>();
const playerSockets = new Map<string, string>();
const socketHosts = new Map<string, string>();
const roomCodeAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codeSchema = z.string().trim().toUpperCase().regex(/^[A-Z2-9]{6}$/);
const nameSchema = z.string().trim().min(1).max(20).transform((name) => name.replace(/[<>]/g, ""));
const avatarSchema = z.string().trim().min(1).max(12);

function makeCode(): string {
  let code = "";
  do {
    code = Array.from(randomBytes(6), (byte) => roomCodeAlphabet[byte % roomCodeAlphabet.length]).join("");
  } while ([...rooms.values()].some((room) => room.code === code));
  return code;
}

function toMatchView(match: MatchState): MatchView {
  return {
    id: match.id,
    round: match.round,
    teamIds: match.teamIds,
    tieBreaker: match.tieBreaker,
    paused: match.paused,
    phase: match.phase,
    countdownEndsAt: match.countdownEndsAt,
    hp: { ...match.hp },
    question: match.question,
    questionNumber: match.questionNumber,
    status: match.status,
    winnerTeamId: match.winnerTeamId,
    feedback: match.feedback,
  };
}

function syncBracket(room: RoomState): void {
  if (!room.bracket || !room.currentRound) return;
  const roundEntry = room.bracket.find((entry) => entry.round === room.currentRound);
  if (!roundEntry) return;
  roundEntry.matches = room.activeMatches.map((match) => ({
    id: match.id,
    round: match.round ?? room.currentRound ?? 1,
    teamIds: match.teamIds,
    hp: { ...match.hp },
    status: match.status,
    winnerTeamId: match.winnerTeamId,
    tieBreaker: match.tieBreaker,
  }));
}

function publish(room: RoomState): void {
  syncBracket(room);
  const matchViews = room.activeMatches.map(toMatchView);
  const primaryMatch = matchViews.find((candidate) => candidate.status !== "finished") ?? matchViews[0];
  const snapshot: RoomSnapshot = {
    id: room.id,
    code: room.code,
    status: room.status,
    hostId: room.hostId,
    quizTitle: room.quizTitle,
    config: room.config,
    players: room.players.map(({ id, name, avatar, teamId, connected, stats }) => ({
      id,
      name,
      avatar,
      teamId,
      cards: [],
      connected,
      stats,
    })),
    teams: room.teams,
    match: primaryMatch,
    matches: matchViews,
    currentRound: room.currentRound,
    bracket: room.bracket,
    championTeamId: room.championTeamId,
    leaderboard: buildLeaderboard(room.players, room.teams),
  };
  io.to(room.id).emit("room:update", snapshot);
}

function emitTeamCards(room: RoomState, targetTeamId?: string): void {
  const teams = targetTeamId ? room.teams.filter((team) => team.id === targetTeamId) : room.teams;
  for (const team of teams) {
    redistributeTeamCards(team, room.players);
    for (const playerId of team.playerIds) {
      const player = room.players.find((candidate) => candidate.id === playerId);
      const socketId = playerSockets.get(playerId);
      if (player && socketId) {
        io.sockets.sockets.get(socketId)?.emit("player:cards", player.cards);
      }
    }
  }
}

function buildMatch(room: RoomState, teamIds: [string, string], round: number): MatchState {
  const id = randomUUID();
  return {
    id,
    round,
    teamIds,
    hp: { [teamIds[0]]: room.config.startingHp, [teamIds[1]]: room.config.startingHp },
    questionNumber: 0,
    status: "waiting",
    questionIndex: (round - 1) * room.config.questionsPerMatch,
    questionStartedAt: 0,
    submissions: new Set(),
    tieBreaker: false,
    tieBreakerCount: 0,
  };
}

function clearMatchTimers(match: MatchState): void {
  if (match.questionTimer) clearTimeout(match.questionTimer);
  if (match.readingTimer) clearTimeout(match.readingTimer);
  if (match.countdownTimer) clearTimeout(match.countdownTimer);
  match.questionTimer = undefined;
  match.readingTimer = undefined;
  match.countdownTimer = undefined;
}

function scheduleCountdown(room: RoomState, match: MatchState, durationMs: number): void {
  if (match.countdownTimer) clearTimeout(match.countdownTimer);
  match.countdownTimer = setTimeout(() => {
    match.countdownTimer = undefined;
    if (match.status !== "question" || match.phase !== "countdown") return;
    showQuestion(room, match);
  }, durationMs);
}

function startMatchCountdown(room: RoomState, match: MatchState): void {
  clearMatchTimers(match);
  match.status = "question";
  match.phase = "countdown";
  match.countdownEndsAt = Date.now() + MATCH_COUNTDOWN_MS;
  match.question = undefined;
  match.questionNumber = 0;
  match.paused = false;
  match.pausedRemainingMs = undefined;
  match.feedback = undefined;
  match.submissions = new Set();
  scheduleCountdown(room, match, MATCH_COUNTDOWN_MS);
  publish(room);
}

function scheduleReading(room: RoomState, match: MatchState, durationMs: number): void {
  if (match.readingTimer) clearTimeout(match.readingTimer);
  match.readingTimer = setTimeout(() => {
    match.readingTimer = undefined;
    if (match.status !== "question" || match.phase !== "reading") return;
    const now = Date.now();
    match.phase = "answering";
    match.questionStartedAt = now;
    const answerMs = Math.max(0, (match.question?.endsAt ?? now) - now);
    publish(room);
    scheduleQuestionTimeout(room, match, answerMs);
  }, durationMs);
}

function scheduleQuestionTimeout(room: RoomState, match: MatchState, durationMs: number): void {
  if (match.questionTimer) clearTimeout(match.questionTimer);
  match.questionTimer = setTimeout(() => {
    match.questionTimer = undefined;
    if (match.status !== "question" || match.phase !== "answering") return;
    match.status = "locked";
    match.phase = "locked";
    match.feedback = undefined;
    publish(room);
    if (match.advanceTimer) clearTimeout(match.advanceTimer);
    match.advanceTimer = setTimeout(() => advanceMatch(room, match), 1800);
  }, durationMs);
}

function showQuestion(room: RoomState, match: MatchState): void {
  if (match.status === "finished") return;
  clearMatchTimers(match);
  const selected = room.questions[match.questionIndex % room.questions.length];
  const readingMs = room.config.readingSeconds * 1000;
  const answerMs = room.config.questionSeconds * 1000;
  const readEndsAt = Date.now() + readingMs;
  const endsAt = readEndsAt + answerMs;
  match.questionNumber += 1;
  match.questionStartedAt = readEndsAt;
  match.paused = false;
  match.pausedRemainingMs = undefined;
  match.status = "question";
  match.phase = "reading";
  match.countdownEndsAt = undefined;
  match.feedback = undefined;
  match.submissions = new Set();
  const question: PublicQuestion = {
    id: selected.id,
    text: selected.text,
    options: selected.options,
    multiplier: selected.multiplier,
    category: selected.category,
    number: match.questionNumber,
    readEndsAt,
    endsAt,
  };
  match.question = question;
  scheduleReading(room, match, readingMs);
  publish(room);
}

function checkRoundCompletion(room: RoomState): void {
  if (room.activeMatches.some((match) => match.status !== "finished")) {
    publish(room);
    return;
  }

  const currentRoundEntry = room.bracket?.find((entry) => entry.round === room.currentRound);
  const winners = room.activeMatches
    .map((match) => match.winnerTeamId ?? match.teamIds[0])
    .filter((teamId): teamId is string => Boolean(teamId));
  if (currentRoundEntry?.byeTeamId) {
    winners.push(currentRoundEntry.byeTeamId);
  }

  if (winners.length <= 1) {
    room.status = "finished";
    room.championTeamId = winners[0];
    publish(room);
    return;
  }

  publish(room);
  if (room.roundAdvanceTimer) clearTimeout(room.roundAdvanceTimer);
  room.roundAdvanceTimer = setTimeout(() => {
    startTournamentRound(room, winners, (room.currentRound ?? 1) + 1);
  }, 2200);
}

function finishMatch(room: RoomState, match: MatchState, winnerTeamId?: string): void {
  clearMatchTimers(match);
  if (match.advanceTimer) clearTimeout(match.advanceTimer);
  match.status = "finished";
  match.phase = undefined;
  match.countdownEndsAt = undefined;
  match.paused = false;
  match.winnerTeamId = winnerTeamId;
  checkRoundCompletion(room);
}

function advanceMatch(room: RoomState, match: MatchState): void {
  if (match.status === "finished" || match.status === "question" || match.status === "paused") return;
  if (match.questionNumber >= room.config.questionsPerMatch) {
    const [firstId, secondId] = match.teamIds;
    const firstHp = match.hp[firstId];
    const secondHp = match.hp[secondId];
    if (firstHp !== secondHp) {
      finishMatch(room, match, firstHp > secondHp ? firstId : secondId);
      return;
    }
    if (match.tieBreaker && match.tieBreakerCount >= 2) {
      finishMatch(room, match, firstId);
      return;
    }
    match.tieBreaker = true;
    match.tieBreakerCount += 1;
  }
  match.questionIndex += 1;
  showQuestion(room, match);
}

function startTournamentRound(room: RoomState, teamIds: string[], roundNumber: number): void {
  room.currentRound = roundNumber;
  const activeTeams = teamIds
    .map((id) => room.teams.find((team) => team.id === id))
    .filter((team): team is Team => Boolean(team));

  if (roundNumber > 1) {
    assignCards(activeTeams, room.players);
  }
  emitTeamCards(room);

  let pairs: [string, string][];
  let byeTeamId: string | undefined;

  if (roundNumber === 1 && teamIds.length === 2) {
    pairs = [[teamIds[0], teamIds[1]]];
  } else {
    const pairing = createBracketPairing(teamIds, room.usedByes);
    pairs = pairing.pairs;
    byeTeamId = pairing.byeTeamId;
  }

  room.activeMatches = pairs.map((pair) => buildMatch(room, pair, roundNumber));
  if (!room.bracket) room.bracket = [];
  room.bracket.push({
    round: roundNumber,
    byeTeamId,
    matches: room.activeMatches.map((match) => ({
      id: match.id,
      round: roundNumber,
      teamIds: match.teamIds,
      hp: { ...match.hp },
      status: match.status,
      winnerTeamId: match.winnerTeamId,
      tieBreaker: match.tieBreaker,
    })),
  });

  for (const match of room.activeMatches) {
    startMatchCountdown(room, match);
  }
}

io.on("connection", (socket) => {
  socket.on("host:create", (arg1: { quizId?: string } | HostCreateReply, arg2?: HostCreateReply) => {
    const reply: HostCreateReply = typeof arg1 === "function" ? arg1 : arg2!;
    const payload = typeof arg1 === "function" ? {} : arg1 ?? {};
    const quiz = getQuizById(payload.quizId ?? DEFAULT_CONFIG.quizId);
    const roomId = randomUUID();
    const hostId = randomUUID();
    const hostToken = randomBytes(24).toString("base64url");
    const room: RoomState = {
      id: roomId,
      code: makeCode(),
      status: "lobby",
      hostId,
      hostToken,
      quizTitle: quiz.title,
      config: { ...DEFAULT_CONFIG, quizId: quiz.id },
      players: [],
      teams: [],
      questions: structuredClone(quiz.questions),
      activeMatches: [],
      bracket: [],
      usedByes: new Set(),
    };
    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.hostId = hostId;
    socketHosts.set(socket.id, hostId);
    reply({ roomId, code: room.code, hostId, hostToken });
    publish(room);
  });

  socket.on("room:join", (payload, reply) => {
    const codeResult = codeSchema.safeParse(payload.code);
    const nameResult = nameSchema.safeParse(payload.name);
    const avatarResult = avatarSchema.safeParse(payload.avatar);
    if (!codeResult.success || !nameResult.success || !avatarResult.success) {
      return reply({ error: "Periksa kode room, nama, dan avatar." });
    }
    const room = [...rooms.values()].find((candidate) => candidate.code === codeResult.data);
    if (!room || !["lobby", "running"].includes(room.status)) {
      return reply({ error: "Room tidak ditemukan atau sudah selesai." });
    }
    if (room.status === "lobby" && room.players.length >= 200) {
      return reply({ error: "Room sudah penuh (maksimal 200 pemain)." });
    }
    let player = payload.token
      ? room.players.find(
          (candidate) =>
            playerSessions.get(candidate.id)?.token === payload.token &&
            playerSessions.get(candidate.id)?.roomId === room.id
        )
      : undefined;
    if (!player && room.status !== "lobby") {
      return reply({ error: "Turnamen sudah berjalan. Gunakan perangkat yang sudah bergabung untuk reconnect." });
    }
    if (!player) {
      player = {
        id: randomUUID(),
        name: nameResult.data,
        avatar: avatarResult.data,
        cards: [],
        baseCards: [],
        connected: true,
        stats: createEmptyStats(),
      };
      const token = randomBytes(24).toString("base64url");
      playerSessions.set(player.id, { roomId: room.id, token });
      room.players.push(player);
    } else {
      player.connected = true;
    }
    const previousSocketId = playerSockets.get(player.id);
    if (previousSocketId && previousSocketId !== socket.id) {
      io.sockets.sockets.get(previousSocketId)?.disconnect(true);
    }
    playerSockets.set(player.id, socket.id);
    socket.data.playerId = player.id;
    socket.data.roomId = room.id;
    socketPlayers.set(socket.id, player.id);
    socket.join(room.id);
    if (room.status === "running" && player.teamId) {
      emitTeamCards(room, player.teamId);
    } else if (player.cards.length) {
      socket.emit("player:cards", player.cards);
    }
    reply({ roomId: room.id, playerId: player.id, token: playerSessions.get(player.id)?.token });
    publish(room);
  });

  socket.on("room:subscribe", ({ roomId, playerId, token, hostId, hostToken }, reply) => {
    const room = rooms.get(roomId);
    if (!room) return reply({ error: "Room tidak ditemukan." });
    if (room.hostId === hostId && room.hostToken === hostToken) {
      socketHosts.set(socket.id, room.hostId);
    } else {
      const session = playerId ? playerSessions.get(playerId) : undefined;
      const player = room.players.find((candidate) => candidate.id === playerId);
      if (!player || !session || session.roomId !== roomId || session.token !== token) {
        return reply({ error: "Sesi pemain tidak valid." });
      }
      const previousSocketId = playerSockets.get(player.id);
      if (previousSocketId && previousSocketId !== socket.id) {
        io.sockets.sockets.get(previousSocketId)?.disconnect(true);
      }
      playerSockets.set(player.id, socket.id);
      socketPlayers.set(socket.id, player.id);
      socket.data.playerId = player.id;
      socket.data.roomId = roomId;
      player.connected = true;
      if (room.status === "running" && player.teamId) {
        emitTeamCards(room, player.teamId);
      } else if (player.cards.length) {
        socket.emit("player:cards", player.cards);
      }
    }
    socket.join(roomId);
    publish(room);
    reply({});
  });

  socket.on("room:spectate", ({ roomIdOrCode }, reply) => {
    const normalized = roomIdOrCode.trim();
    const room =
      rooms.get(normalized) ??
      [...rooms.values()].find((candidate) => candidate.code === normalized.toUpperCase());
    if (!room) return reply({ error: "Room tidak ditemukan." });
    socket.join(room.id);
    publish(room);
    reply({ roomId: room.id });
  });

  socket.on("host:configure", ({ roomId, config }, reply) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socketHosts.get(socket.id) || room.status !== "lobby") {
      return reply({ error: "Pengaturan room tidak dapat diubah." });
    }
    const parsed = z
      .object({
        startingHp: z.number().int().min(20).max(500).optional(),
        baseDamage: z.number().int().min(1).max(100).optional(),
        speedBonus: z.number().int().min(0).max(50).optional(),
        readingSeconds: z.number().int().min(1).max(30).optional(),
        questionSeconds: z.number().int().min(5).max(120).optional(),
        questionsPerMatch: z.number().int().min(1).max(15).optional(),
        quizId: z.string().trim().min(1).optional(),
      })
      .safeParse(config);
    if (!parsed.success) return reply({ error: "Nilai pengaturan tidak valid." });
    if (parsed.data.quizId) {
      const quiz = getQuizById(parsed.data.quizId);
      room.quizTitle = quiz.title;
      room.questions = structuredClone(quiz.questions);
      room.config.quizId = quiz.id;
    }
    room.config = { ...room.config, ...parsed.data };
    publish(room);
    reply({});
  });

  socket.on("host:kick", ({ roomId, playerId }, reply) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socketHosts.get(socket.id) || room.status !== "lobby") {
      return reply({ error: "Pemain tidak dapat dikeluarkan." });
    }
    room.players = room.players.filter((player) => player.id !== playerId);
    playerSessions.delete(playerId);
    for (const [socketId, joinedPlayerId] of socketPlayers) {
      if (joinedPlayerId === playerId) {
        io.sockets.sockets.get(socketId)?.leave(roomId);
        socketPlayers.delete(socketId);
      }
    }
    publish(room);
    reply({});
  });

  socket.on("host:start", ({ roomId }, reply) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socketHosts.get(socket.id) || room.status !== "lobby") {
      return reply({ error: "Room tidak dapat dimulai." });
    }
    if (room.players.length < 6 || room.players.length > 200) {
      return reply({ error: "Room memerlukan minimal 6 pemain (maksimal 200 pemain)." });
    }
    try {
      room.teams = assignTeams(room.players);
      assignCards(room.teams, room.players);
    } catch (error) {
      return reply({ error: error instanceof Error ? error.message : "Tim gagal dibentuk." });
    }
    room.status = "running";
    room.bracket = [];
    room.usedByes = new Set();
    startTournamentRound(
      room,
      room.teams.map((team) => team.id),
      1
    );
    reply({});
  });

  socket.on("host:pause", ({ roomId, matchId }, reply) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socketHosts.get(socket.id) || room.status !== "running") {
      return reply({ error: "Pertandingan tidak dapat dijeda." });
    }
    const targets = matchId
      ? room.activeMatches.filter((match) => match.id === matchId)
      : room.activeMatches.filter((match) => match.status === "question" || match.status === "paused");
    if (targets.length === 0) {
      return reply({ error: "Tidak ada soal aktif untuk dijeda." });
    }

    const shouldPause = targets.some((match) => match.status === "question");
    for (const match of targets) {
      if (shouldPause && match.status === "question") {
        const now = Date.now();
        const remainingMs = Math.max(
          500,
          match.phase === "countdown"
            ? (match.countdownEndsAt ?? now) - now
            : match.phase === "reading"
            ? (match.question?.readEndsAt ?? now) - now
            : (match.question?.endsAt ?? now) - now
        );
        clearMatchTimers(match);
        match.paused = true;
        match.status = "paused";
        match.pausedRemainingMs = remainingMs;
        if (match.phase === "countdown") {
          match.countdownEndsAt = now + remainingMs;
        }
        if (match.question) {
          match.question = { ...match.question, pausedRemainingMs: remainingMs };
        }
      } else if (!shouldPause && match.status === "paused") {
        const now = Date.now();
        const remainingMs = match.pausedRemainingMs ?? room.config.questionSeconds * 1000;
        match.paused = false;
        match.status = "question";
        match.pausedRemainingMs = undefined;
        if (match.question) {
          match.question = { ...match.question, pausedRemainingMs: undefined };
        }
        if (match.phase === "countdown") {
          match.countdownEndsAt = now + remainingMs;
          scheduleCountdown(room, match, remainingMs);
        } else if (match.phase === "reading" && match.question) {
          const readEndsAt = now + remainingMs;
          match.question = {
            ...match.question,
            readEndsAt,
            endsAt: readEndsAt + room.config.questionSeconds * 1000,
          };
          match.questionStartedAt = readEndsAt;
          scheduleReading(room, match, remainingMs);
        } else if (match.phase === "answering" && match.question) {
          match.question = { ...match.question, endsAt: now + remainingMs };
          match.questionStartedAt = now;
          scheduleQuestionTimeout(room, match, remainingMs);
        }
      }
    }
    publish(room);
    reply({ paused: shouldPause });
  });

  socket.on("host:skip", ({ roomId, matchId }, reply) => {
    const room = rooms.get(roomId);
    if (!room || room.hostId !== socketHosts.get(socket.id) || room.status !== "running") {
      return reply({ error: "Soal tidak dapat dilewati." });
    }
    const targets = matchId
      ? room.activeMatches.filter((match) => match.id === matchId && match.status !== "finished")
      : room.activeMatches.filter((match) => match.status !== "finished");
    if (targets.length === 0) {
      return reply({ error: "Tidak ada pertandingan aktif." });
    }
    for (const match of targets) {
      if (match.phase === "countdown") {
        clearMatchTimers(match);
        match.paused = false;
        match.pausedRemainingMs = undefined;
        showQuestion(room, match);
        continue;
      }
      clearMatchTimers(match);
      if (match.advanceTimer) clearTimeout(match.advanceTimer);
      match.paused = false;
      match.pausedRemainingMs = undefined;
      match.status = "locked";
      match.phase = "locked";
      match.feedback = undefined;
      advanceMatch(room, match);
    }
    reply({});
  });

  socket.on("card:raise", ({ roomId, matchId, questionId, card }, reply) => {
    const room = rooms.get(roomId);
    const match = room?.activeMatches.find((candidate) => candidate.id === matchId);
    if (
      !room ||
      socket.data.roomId !== roomId ||
      !match ||
      match.status !== "question" ||
      !match.question ||
      Date.now() >= match.question.endsAt
    ) {
      return reply({ error: "Soal sedang tidak menerima jawaban." });
    }
    if (match.phase !== "answering") {
      return reply({
        error: match.phase === "reading" ? "Sabar, waktu baca soal belum selesai." : "Soal belum siap dijawab.",
      });
    }
    if (!CARD_LETTERS.includes(card as CardLetter) || questionId !== match.question.id) {
      return reply({ error: "Kartu atau soal tidak valid." });
    }
    const player = room.players.find(
      (candidate) =>
        candidate.id === socketPlayers.get(socket.id) &&
        candidate.teamId &&
        match.teamIds.includes(candidate.teamId) &&
        candidate.cards.includes(card)
    );
    if (!player || !player.connected) {
      return reply({ error: "Kartu ini bukan milik pemain aktif di pertandingan." });
    }
    const submissionKey = `${player.id}:${card}`;
    if (match.submissions.has(submissionKey)) {
      return reply({ error: "Kartu ini sudah dimainkan untuk soal ini." });
    }
    match.submissions.add(submissionKey);
    const startedAt = match.questionStartedAt;
    const question = room.questions.find((candidate) => candidate.id === questionId)!;
    const correct = CARD_LETTERS.indexOf(card) === question.correctIndex;
    const elapsedMs = Math.max(0, Date.now() - startedAt);
    const amount = calculateDamage(room.config, question.multiplier, elapsedMs);
    const targetTeamId = correct
      ? match.teamIds.find((teamId) => teamId !== player.teamId)!
      : player.teamId!;
    match.hp[targetTeamId] = Math.max(0, match.hp[targetTeamId] - amount);
    match.status = "locked";
    match.phase = "locked";
    if (match.questionTimer) clearTimeout(match.questionTimer);
    if (match.readingTimer) clearTimeout(match.readingTimer);
    match.questionTimer = undefined;
    match.readingTimer = undefined;

    if (!player.stats) player.stats = createEmptyStats();
    player.stats.totalResponseMs += elapsedMs;
    if (correct) {
      player.stats.correctAnswers += 1;
      player.stats.damageDealt += amount;
    } else {
      player.stats.wrongAnswers += 1;
      player.stats.selfDamage += amount;
    }

    match.feedback = {
      playerId: player.id,
      playerName: player.name,
      card,
      correct,
      damage: amount,
      targetTeamId,
      hp: { ...match.hp },
      responseMs: elapsedMs,
    } satisfies AnswerFeedback;

    if (match.tieBreaker && correct) {
      finishMatch(room, match, player.teamId);
    } else if (match.hp[targetTeamId] === 0) {
      finishMatch(room, match, match.teamIds.find((teamId) => teamId !== targetTeamId));
    } else {
      publish(room);
      if (match.advanceTimer) clearTimeout(match.advanceTimer);
      match.advanceTimer = setTimeout(() => advanceMatch(room, match), 1800);
    }
    reply({});
  });

  socket.on("disconnect", () => {
    socketHosts.delete(socket.id);
    const playerId = socketPlayers.get(socket.id);
    socketPlayers.delete(socket.id);
    if (!playerId || playerSockets.get(playerId) !== socket.id) return;
    playerSockets.delete(playerId);
    for (const room of rooms.values()) {
      const player = room.players.find((candidate) => candidate.id === playerId);
      if (player) {
        player.connected = false;
        if (room.status === "running" && player.teamId) {
          emitTeamCards(room, player.teamId);
        }
        publish(room);
      }
    }
  });
});

export { httpServer };

if (shouldListen) httpServer.listen(port, () => console.log(`Game server listening on ${port}`));
