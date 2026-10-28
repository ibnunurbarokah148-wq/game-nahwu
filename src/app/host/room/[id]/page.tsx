"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { Bracket, DamagePopup, JoinShareBox, Leaderboard, TeamPanel } from "@/components/game-widgets";
import { getSocket } from "@/lib/socket";
import { useRoomBgm } from "@/lib/sound";
import type { Quiz, RoomSnapshot } from "@/lib/game";

export default function HostRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<RoomSnapshot>();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const { muted, toggleMute } = useRoomBgm(room?.status);

  useEffect(() => {
    fetch("/api/quizzes")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data.quizzes)) setQuizzes(data.quizzes);
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const hostToken = localStorage.getItem(`host-token:${id}`);
    if (!hostToken) {
      router.replace("/");
      return;
    }
    const hostId = localStorage.getItem(`host-id:${id}`) ?? "";
    const socket = getSocket();
    const update = (snapshot: RoomSnapshot) => {
      if (snapshot.id === id) setRoom(snapshot);
    };
    const subscribe = () =>
      socket.emit("room:subscribe", { roomId: id, hostId, hostToken }, (result) => {
        if (result.error) setError(result.error);
      });
    socket.on("room:update", update);
    socket.on("connect", subscribe);
    if (socket.connected) subscribe();
    return () => {
      socket.off("room:update", update);
      socket.off("connect", subscribe);
    };
  }, [id, router]);

  const startMatch = useCallback(() => {
    setBusy(true);
    setError("");
    getSocket().emit("host:start", { roomId: id }, (result) => {
      setBusy(false);
      if (result.error) setError(result.error);
    });
  }, [id]);

  function updateConfig(
    field: "startingHp" | "baseDamage" | "questionSeconds" | "questionsPerMatch" | "quizId",
    value: number | string
  ) {
    if (!room) return;
    getSocket().emit("host:configure", { roomId: id, config: { [field]: value } }, (result) => {
      if (result.error) setError(result.error);
    });
  }

  function togglePause() {
    setError("");
    getSocket().emit("host:pause", { roomId: id }, (result) => {
      if (result.error) setError(result.error);
    });
  }

  function skipQuestion() {
    setError("");
    getSocket().emit("host:skip", { roomId: id }, (result) => {
      if (result.error) setError(result.error);
    });
  }

  async function copyCode() {
    if (!room) return;
    await navigator.clipboard.writeText(room.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  if (!room) {
    return (
      <main className="shell">
        <header className="topbar"><Brand /></header>
        <div className="panel">
          <p>Memuat lobby…</p>
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    );
  }

  const teamsReady = room.status !== "lobby";
  const currentMatch = room.match;
  const anyPaused = room.matches?.some((match) => match.status === "paused") ?? currentMatch?.status === "paused";

  return (
    <main className="shell">
      <header className="topbar">
        <Brand />
        <div className="btn-row">
          <button type="button" className="button secondary" onClick={toggleMute}>
            {muted ? "Backsound: Mati" : "Backsound: Aktif"}
          </button>
          <Link className="button secondary" href="/host">Dashboard kuis</Link>
          <Link className="button secondary" href={`/display/${room.id}`} target="_blank">
            Layar proyektor
          </Link>
          <span className="status-tag">
            {room.status === "lobby"
              ? "LOBBY TERBUKA"
              : room.status === "running"
              ? `RONDE ${room.currentRound ?? 1} BERJALAN`
              : "PERTANDINGAN SELESAI"}
          </span>
        </div>
      </header>

      <div className="page-heading">
        <div>
          <span className="eyebrow">Panel host · {room.players.length} pemain · {room.quizTitle ?? "Kuis Nahwu"}</span>
          <h1>Lobby & Kontrol Turnamen</h1>
          <p className="micro">Bagikan kode room atau tampilkan Layar Proyektor. Minimal 6 pemain untuk membentuk tim otomatis (hingga 200 pemain).</p>
        </div>
        <button className="button secondary" onClick={copyCode}>
          {copied ? "Kode tersalin" : "Salin kode"}
        </button>
      </div>

      {room.status === "lobby" && (
        <div style={{ marginBottom: 18 }}>
          <JoinShareBox code={room.code} roomId={room.id} />
        </div>
      )}

      <div className="host-grid">
        <section className="panel">
          <h2>Pemain di room</h2>
          <p className="panel-sub">{room.players.length} pemain bergabung (minimal 6 pemain)</p>
          {room.players.length === 0 ? (
            <div className="waiting">
              <p className="big-code">{room.code}</p>
              <p className="micro">Belum ada pemain. Minta peserta membuka halaman utama atau scan QR untuk memasukkan kode ini.</p>
            </div>
          ) : (
            <div className="player-list">
              {room.players.map((player) => (
                <div className="player-row" key={player.id}>
                  <span className="avatar">{player.avatar}</span>
                  <span className="player-meta">
                    <strong>{player.name}</strong>
                    <small>{player.connected ? "Terhubung" : "Terputus sementara (Bot-slot aktif)"}</small>
                  </span>
                  {room.status === "lobby" && (
                    <button
                      className="remove"
                      title={`Keluarkan ${player.name}`}
                      aria-label={`Keluarkan ${player.name}`}
                      onClick={() =>
                        getSocket().emit("host:kick", { roomId: id, playerId: player.id }, (result) => {
                          if (result.error) setError(result.error);
                        })
                      }
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="panel">
          <h2>Aturan room & kuis</h2>
          <p className="panel-sub">Pengaturan berlaku untuk seluruh pertandingan di turnamen ini.</p>

          {quizzes.length > 0 && (
            <div className="field" style={{ marginTop: 0 }}>
              <label htmlFor="quiz-select">Paket Kuis</label>
              <select
                id="quiz-select"
                className="input"
                disabled={teamsReady}
                value={room.config.quizId ?? "nahwu-dasar"}
                onChange={(event) => updateConfig("quizId", event.target.value)}
              >
                {quizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title} ({quiz.questions.length} soal)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="settings">
            <div className="field">
              <label htmlFor="hp">HP awal</label>
              <input
                id="hp"
                className="input"
                type="number"
                min={20}
                max={500}
                step={10}
                disabled={teamsReady}
                value={room.config.startingHp}
                onChange={(event) => updateConfig("startingHp", Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="damage">Damage dasar</label>
              <input
                id="damage"
                className="input"
                type="number"
                min={1}
                max={100}
                disabled={teamsReady}
                value={room.config.baseDamage}
                onChange={(event) => updateConfig("baseDamage", Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="seconds">Detik per soal</label>
              <input
                id="seconds"
                className="input"
                type="number"
                min={5}
                max={120}
                disabled={teamsReady}
                value={room.config.questionSeconds}
                onChange={(event) => updateConfig("questionSeconds", Number(event.target.value))}
              />
            </div>
            <div className="field">
              <label htmlFor="count">Soal per match</label>
              <input
                id="count"
                className="input"
                type="number"
                min={1}
                max={15}
                disabled={teamsReady}
                value={room.config.questionsPerMatch}
                onChange={(event) => updateConfig("questionsPerMatch", Number(event.target.value))}
              />
            </div>
          </div>

          <p id="seed-note" className="micro">
            Kuis aktif: <strong>{room.quizTitle ?? "Nahwu & Mufradat Dasar"}</strong>.{" "}
            <Link href="/host">Buat/edit kuis →</Link>
          </p>

          {!teamsReady ? (
            <button
              className="button full"
              disabled={busy || room.players.length < 6 || room.players.length > 200}
              onClick={startMatch}
            >
              {busy ? "Membentuk tim…" : "Acak tim dan mulai"}
            </button>
          ) : (
            <div className="micro">Tim sudah dibentuk secara acak. Pertandingan tampil di layar pemain & proyektor.</div>
          )}
          {error && <p className="error" role="alert">{error}</p>}
        </aside>
      </div>

      {currentMatch && (
        <section className="panel" style={{ marginTop: 18 }}>
          <div className="page-heading" style={{ marginBottom: 12 }}>
            <div>
              <h2>Kontrol pertandingan · Ronde {room.currentRound ?? 1}</h2>
              <p className="panel-sub" style={{ marginBottom: 0 }}>
                {currentMatch.tieBreaker
                  ? "Soal tie-breaker (Sudden Death)"
                  : `Soal ${Math.min(currentMatch.questionNumber, room.config.questionsPerMatch)} dari ${room.config.questionsPerMatch}`}{" "}
                · status{" "}
                {currentMatch.status === "question"
                  ? "berlangsung"
                  : currentMatch.status === "paused"
                  ? "dijeda"
                  : currentMatch.status === "finished"
                  ? "selesai"
                  : "menunggu"}
              </p>
            </div>
            {room.status === "running" && (
              <div className="btn-row">
                <button type="button" className="button secondary" onClick={togglePause}>
                  {anyPaused ? "Lanjutkan soal" : "Jeda soal"}
                </button>
                <button type="button" className="button danger" onClick={skipQuestion}>
                  Lewati soal
                </button>
              </div>
            )}
          </div>

          {currentMatch.question && room.status === "running" && (
            <div className="team-box" style={{ marginTop: 12 }}>
              <span className="eyebrow">Soal Aktif di Arena</span>
              <h3 dir="auto" style={{ fontSize: 20, margin: "6px 0 0" }}>{currentMatch.question.text}</h3>
            </div>
          )}

          <DamagePopup feedback={currentMatch.feedback} teams={room.teams} />

          {room.status === "finished" && (
            <p style={{ marginTop: 10 }}>
              <strong>
                Pemenang: {room.teams.find((team) => team.id === (room.championTeamId ?? currentMatch.winnerTeamId))?.name ?? "Seri"}
              </strong>
            </p>
          )}
        </section>
      )}

      {room.bracket && room.bracket.length > 0 && (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Bracket Turnamen</h2>
          <p className="panel-sub">Single elimination bracket. Tim ganjil otomatis mendapat bye tanpa berulang.</p>
          <Bracket
            bracket={room.bracket}
            teams={room.teams}
            maxHp={room.config.startingHp}
            championTeamId={room.championTeamId}
          />
        </section>
      )}

      {room.teams.length > 0 && (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Susunan tim</h2>
          <TeamPanel teams={room.teams} players={room.players} championTeamId={room.championTeamId} />
        </section>
      )}

      {room.leaderboard && room.leaderboard.length > 0 && (
        <section className="panel" style={{ marginTop: 18 }}>
          <h2>Leaderboard MVP Pemain</h2>
          <p className="panel-sub">Statistik kontribusi jawaban benar dan damage seluruh pemain.</p>
          <Leaderboard entries={room.leaderboard} />
        </section>
      )}
    </main>
  );
}
