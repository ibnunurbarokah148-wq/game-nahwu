"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Brand } from "@/components/brand";
import { Bracket, DamagePopup, HpBar, JoinShareBox, Leaderboard, TeamPanel } from "@/components/game-widgets";
import { CARD_LETTERS, type RoomSnapshot } from "@/lib/game";
import { getSocket } from "@/lib/socket";
import { useRoomBgm } from "@/lib/sound";

export default function DisplayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomSnapshot>();
  const [error, setError] = useState("");
  const [now, setNow] = useState(Date.now());
  const { muted, toggleMute } = useRoomBgm(room?.status);

  useEffect(() => {
    const socket = getSocket();
    const update = (snapshot: RoomSnapshot) => {
      if (snapshot.id === roomId || snapshot.code === roomId?.toUpperCase()) {
        setRoom(snapshot);
      }
    };
    const spectate = () => {
      socket.emit("room:spectate", { roomIdOrCode: roomId }, (result) => {
        if (result.error) setError(result.error);
      });
    };
    socket.on("room:update", update);
    socket.on("connect", spectate);
    if (socket.connected) spectate();
    return () => {
      socket.off("room:update", update);
      socket.off("connect", spectate);
    };
  }, [roomId]);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  if (!room) {
    return (
      <main className="shell">
        <header className="topbar">
          <Brand />
          <span className="status-tag">MODE PROYEKTOR</span>
        </header>
        <div className="panel waiting">
          <h2>Menghubungkan ke layar proyektor…</h2>
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    );
  }

  const activeMatches = room.matches ?? (room.match ? [room.match] : []);
  const championTeam = room.teams.find((team) => team.id === room.championTeamId);

  return (
    <main className="shell display-shell">
      <header className="topbar">
        <Brand />
        <div className="btn-row">
          <button type="button" className="button secondary" onClick={toggleMute}>
            {muted ? "Backsound: Mati" : "Backsound: Aktif"}
          </button>
          <span className="status-tag">KODE ROOM: {room.code}</span>
          <span className="status-tag">
            {room.status === "lobby"
              ? `MENUNGGU PEMAIN (${room.players.length})`
              : room.status === "running"
              ? `ARENA RONDE ${room.currentRound ?? 1}`
              : "TURNAMEN SELESAI"}
          </span>
        </div>
      </header>

      {room.status === "lobby" && (
        <section className="display-lobby">
          <div className="panel">
            <span className="eyebrow">Mode Proyektor · {room.quizTitle ?? "Kuis Nahwu"}</span>
            <h1 style={{ fontSize: "clamp(36px, 5vw, 58px)", margin: "10px 0 18px" }}>
              Siapkan HP, Masuk ke Arena!
            </h1>
            <JoinShareBox code={room.code} roomId={room.id} />
          </div>
          <div className="panel" style={{ marginTop: 18 }}>
            <h2>Peserta Bergabung ({room.players.length})</h2>
            <p className="panel-sub">Tim berisi 3–5 pemain akan diacak otomatis saat host memulai.</p>
            {room.players.length === 0 ? (
              <p className="micro">Menunggu peserta pertama bergabung…</p>
            ) : (
              <div className="display-player-grid">
                {room.players.map((player) => (
                  <div className="display-player-chip" key={player.id}>
                    <span className="avatar">{player.avatar}</span>
                    <strong>{player.name}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {room.status === "finished" && (
        <section className="panel waiting" style={{ marginBottom: 20 }}>
          <span className="eyebrow">Turnamen Selesai</span>
          <h1 style={{ fontSize: "clamp(36px, 5vw, 56px)", margin: "8px 0 12px" }}>
            {championTeam?.name ?? "Tim Juara"} Menang!
          </h1>
          <p className="lede" style={{ margin: "0 auto" }}>
            Selamat kepada seluruh anggota {championTeam?.name ?? "tim pemenang"} atas penguasaan Nahwu & Shorof terbaik.
          </p>
        </section>
      )}

      {room.status === "running" && activeMatches.length > 0 && (
        <section className="arena-matches-grid" style={{ marginBottom: 20 }}>
          {activeMatches.map((match) => {
            const [teamAId, teamBId] = match.teamIds;
            const teamA = room.teams.find((t) => t.id === teamAId);
            const teamB = room.teams.find((t) => t.id === teamBId);
            const hpA = match.hp[teamAId] ?? room.config.startingHp;
            const hpB = match.hp[teamBId] ?? room.config.startingHp;
            const remaining = match.question
              ? match.status === "paused" && match.question.pausedRemainingMs
                ? Math.max(0, Math.ceil(match.question.pausedRemainingMs / 1000))
                : Math.max(0, Math.ceil((match.question.endsAt - now) / 1000))
              : 0;

            return (
              <div className="panel question-panel" key={match.id}>
                <div className="score-strip">
                  <div className="score-team">
                    <strong>{teamA?.name ?? "Tim A"}</strong>
                    <b>{hpA} HP</b>
                    <HpBar hp={hpA} maxHp={room.config.startingHp} variant="green" />
                  </div>
                  <span className="round-mark">VS</span>
                  <div className="score-team">
                    <strong>{teamB?.name ?? "Tim B"}</strong>
                    <b>{hpB} HP</b>
                    <HpBar hp={hpB} maxHp={room.config.startingHp} variant="orange" />
                  </div>
                </div>

                {match.question && (
                  <>
                    <div className="question-top">
                      <span>
                        {match.tieBreaker
                          ? "SOAL TIE-BREAKER"
                          : `SOAL ${match.question.number} / ${room.config.questionsPerMatch}`}
                      </span>
                      <span className="timer">
                        {match.status === "paused"
                          ? `DIJEDA (${remaining} dtk)`
                          : match.status === "question"
                          ? `${remaining} dtk`
                          : match.status === "finished"
                          ? "SELESAI"
                          : "TERKUNCI"}
                      </span>
                    </div>
                    <h2 className="question-text" dir="auto" style={{ margin: "16px 0 20px" }}>
                      {match.question.text}
                    </h2>
                    <div className="answer-grid">
                      {CARD_LETTERS.map((letter, idx) => (
                        <div className="answer" key={letter}>
                          <span className="answer-letter">{letter}</span>
                          <span dir="auto">{match.question!.options[idx]}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <DamagePopup feedback={match.feedback} teams={room.teams} />
              </div>
            );
          })}
        </section>
      )}

      {room.bracket && room.bracket.length > 0 && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <h2>Bracket Turnamen</h2>
          <Bracket
            bracket={room.bracket}
            teams={room.teams}
            maxHp={room.config.startingHp}
            championTeamId={room.championTeamId}
          />
        </section>
      )}

      {room.leaderboard && room.leaderboard.length > 0 && (
        <section className="panel" style={{ marginBottom: 20 }}>
          <h2>Leaderboard MVP Pemain</h2>
          <Leaderboard entries={room.leaderboard} />
        </section>
      )}

      {room.teams.length > 0 && (
        <section className="panel">
          <h2>Daftar Tim</h2>
          <TeamPanel teams={room.teams} players={room.players} championTeamId={room.championTeamId} />
        </section>
      )}
    </main>
  );
}
