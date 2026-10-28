import { io } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/lib/events";
import type { CardLetter, RoomSnapshot } from "../src/lib/game";

const serverUrl = process.env.SOCKET_URL ?? "http://localhost:3001";
const avatars = ["🦊", "🐼", "🦉", "🐯", "🐸", "🐙", "🦁", "🐨"];

async function resolveArgs(): Promise<{ code: string; count: number }> {
  const arg1 = process.argv[2]?.trim();
  const arg2 = process.argv[3]?.trim();

  // Jika arg1 adalah angka (mis. `npm run simulate 15`), otomatis cari room lobby yang sedang aktif
  if (!arg1 || /^\d+$/.test(arg1)) {
    const count = arg1 ? Number(arg1) : 10;
    try {
      const response = await fetch(serverUrl);
      const data = (await response.json()) as { activeLobbyCode?: string | null };
      if (data.activeLobbyCode) {
        return { code: data.activeLobbyCode, count };
      }
    } catch {
      console.error(`❌ Server game belum berjalan di ${serverUrl}. Jalankan 'npm run dev' terlebih dahulu.`);
      process.exit(1);
    }
    console.error(
      "❌ Belum ada room lobby yang terbuka.\n" +
        "1. Buka http://localhost:3000 lalu klik 'Buat room sebagai host', kemudian jalankan: npm run simulate\n" +
        "2. Atau masukkan kode 6 karakter asli (tanpa tanda < >), contoh: npm run simulate KARTU7 15"
    );
    process.exit(1);
  }

  return {
    code: arg1.replace(/[<>\s]/g, "").toUpperCase(),
    count: Number(arg2 ?? 10) || 10,
  };
}

async function main() {
  const { code, count } = await resolveArgs();
  console.log(`🤖 Menghubungkan ${count} bot pemain ke room ${code} di ${serverUrl}...`);

  for (let i = 1; i <= count; i += 1) {
    const socket = io(serverUrl, { forceNew: true }) as unknown as import("socket.io-client").Socket<
      ServerToClientEvents,
      ClientToServerEvents
    >;
    let myCards: CardLetter[] = [];
    let myPlayerId = "";
    let myRoomId = "";

    socket.on("connect", () => {
      socket.emit(
        "room:join",
        { code, name: `Bot Santri ${i}`, avatar: avatars[i % avatars.length] },
        (res) => {
          if (res.error) {
            console.error(`Bot ${i} gagal join:`, res.error);
            return;
          }
          myPlayerId = res.playerId ?? "";
          myRoomId = res.roomId ?? "";
          console.log(`✓ Bot Santri ${i} bergabung (${myPlayerId.slice(0, 6)})`);
        }
      );
    });

    socket.on("player:cards", (cards) => {
      myCards = cards;
    });

    socket.on("room:update", (snapshot: RoomSnapshot) => {
      if (!myPlayerId || snapshot.status !== "running") return;
      const me = snapshot.players.find((p) => p.id === myPlayerId);
      if (!me?.teamId) return;
      const activeMatch = snapshot.matches?.find((m) => m.teamIds.includes(me.teamId!)) ?? snapshot.match;
      if (!activeMatch || activeMatch.status !== "question" || !activeMatch.question || myCards.length === 0) return;

      const delay = 1200 + Math.floor(Math.random() * 4500);
      const questionId = activeMatch.question.id;
      const matchId = activeMatch.id;
      const chosenCard = myCards[Math.floor(Math.random() * myCards.length)];

      setTimeout(() => {
        socket.emit("card:raise", { roomId: myRoomId, matchId, questionId, card: chosenCard }, () => undefined);
      }, delay);
    });
  }
}

main();
