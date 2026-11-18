"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Brand } from "@/components/brand";
import { Bracket, DamagePopup, HpBar, JoinShareBox, Leaderboard, TeamPanel } from "@/components/game-widgets";
import { CARD_LETTERS, type RoomSnapshot } from "@/lib/game";
import { getSocket } from "@/lib/socket";
import { sfx, useRoomBgm } from "@/lib/sound";

const CONFETTI_ITEMS = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${5 + ((index * 19) % 90)}%`,
  delay: `${(index % 6) * 0.28}s`,
  duration: `${2.8 + (index % 4) * 0.45}s`,
  color: ["#1f704b", "#d8f36a", "#f3b74d", "#bc4a3e", "#3a8f66"][index % 5],
}));

export default function DisplayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [room, setRoom] = useState<RoomSnapshot>();
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const { muted, toggleMute } = useRoomBgm(room?.status);
  const seenFeedbacksRef = useRef<Set<string>>(new Set());
  const lastCountdownRef = useRef<Record<string, number>>({});
  const victoryPlayedRef = useRef(false);

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
    const interval = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const matches = room?.matches ?? (room?.match ? [room.match] : []);
    for (const match of matches) {
      if (!match.feedback) continue;
      const key = `${match.id}:${match.questionNumber}:${match.feedback.playerId}:${match.feedback.card}`;
      if (seenFeedbacksRef.current.has(key)) continue;
      seenFeedbacksRef.current.add(key);
      if (match.feedback.correct) {
        sfx.playCorrect();
      } else {
        sfx.playWrong();
      }
    }
  }, [room?.matches, room?.match]);

  useEffect(() => {
    const matches = room?.matches ?? (room?.match ? [room.match] : []);
    for (const match of matches) {
      if (match.phase !== "countdown" || match.status === "paused" || !match.countdownEndsAt) continue;
      const sec = Math.max(0, Math.ceil((match.countdownEndsAt - now) / 1000));
      if (sec > 0 && lastCountdownRef.current[match.id] !== sec) {
        lastCountdownRef.current[match.id] = sec;
        sfx.playCountdown();
      }
    }
  }, [now, room?.matches, room?.match]);

  useEffect(() => {
    if (room?.status === "finished" && !victoryPlayedRef.current) {
      victoryPlayedRef.current = true;
      sfx.playVictory();
    } else if (room?.status && room.status !== "finished") {
      victoryPlayedRef.current = false;
    }
  }, [room?.status]);

  if (!room) {
    return (
      <main className="shell spectator-stage">
        <div className="ambient-orb orb-a" aria-hidden="true" />
        <div className="ambient-orb orb-b" aria-hidden="true" />
        <header className="topbar">
          <Brand />
          <span className="live-pill">
            <span className="live-dot" /> MODE PROYEKTOR
          </span>
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
  const championMembers = championTeam
    ? room.players.filter((player) => championTeam.playerIds.includes(player.id))
    : [];
  const currentRoundEntry = room.bracket?.find((entry) => entry.round === room.currentRound);
  const byeTeam = currentRoundEntry?.byeTeamId
    ? room.teams.find((team) => team.id === currentRoundEntry.byeTeamId)
    : undefined;
  const topThree = (room.leaderboard ?? []).slice(0, 3);
  const lobbyProgress = Math.min(100, (room.players.length / 6) * 100);

  return (
    <main className="shell display-shell spectator-stage">
      <div className="ambient-orb orb-a" aria-hidden="true" />
      <div className="ambient-orb orb-b" aria-hidden="true" />

      <header className="topbar">
        <Brand />
        <div className="btn-row">
          <span className="live-pill">
            <span className="live-dot" /> LIVE SPECTATOR
          </span>
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
          <div className="panel display-lobby-hero">
            <div className="display-lobby-copy">
              <span className="eyebrow">Mode Proyektor · {room.quizTitle ?? "Kuis Nahwu"}</span>
              <h1 style={{ fontSize: "clamp(34px, 5vw, 56px)", margin: "10px 0 14px" }}>
                Siapkan HP, Masuk ke Arena!
              </h1>
              <div className="floating-cards-strip" aria-hidden="true">
                {CARD_LETTERS.map((letter, idx) => (
                  <span
                    key={letter}
                    className="floating-card-chip"
                    style={{ animationDelay: `${idx * 0.18}s` }}
                  >
                    {letter}
                  </span>
                ))}
              </div>
              <div className="lobby-readiness">
                <div className="lobby-readiness-head">
                  <span>Kesiapan Arena</span>
                  <span>
                    {room.players.length} / 6 minimal pemain
                    {room.players.length >= 6 ? " · Siap dimulai!" : ""}
                  </span>
                </div>
                <div className="phase-track answering" style={{ margin: "6px 0 0" }}>
                  <span style={{ width: `${lobbyProgress}%` }} />
                </div>
              </div>
            </div>
            <JoinShareBox code={room.code} roomId={room.id} />
          </div>

          <div className="panel" style={{ marginTop: 18 }}>
            <div className="question-top" style={{ marginBottom: 6 }}>
              <h2 style={{ marginBottom: 0, color: "var(--ink)" }}>
                Peserta Bergabung ({room.players.length})
              </h2>
              <span>Tim berisi 3–5 pemain diacak otomatis saat mulai</span>
            </div>
            {room.players.length === 0 ? (
              <p className="micro" style={{ marginTop: 10 }}>
                Menunggu peserta pertama bergabung…
              </p>
            ) : (
              <div className="display-player-grid">
                {room.players.map((player, index) => (
                  <div
                    className="display-player-chip pop-in-chip"
                    style={{ animationDelay: `${Math.min(index, 24) * 40}ms` }}
                    key={player.id}
                  >
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
        <section className="panel champion-stage" style={{ marginBottom: 20 }}>
          <div className="confetti-layer" aria-hidden="true">
            {CONFETTI_ITEMS.map((item) => (
              <span
                key={item.id}
                className="confetti-piece"
                style={{
                  left: item.left,
                  background: item.color,
                  animationDelay: item.delay,
                  animationDuration: item.duration,
                }}
              />
            ))}
          </div>

          <div className="champion-header">
            <span className="trophy-badge" aria-hidden="true">🏆</span>
            <span className="eyebrow">Turnamen Selesai · Juara Bertahan</span>
            <h1 style={{ fontSize: "clamp(36px, 5vw, 58px)", margin: "8px 0 10px" }}>
              {championTeam?.name ?? "Tim Juara"} Menang!
            </h1>
            <p className="lede" style={{ margin: "0 auto" }}>
              Selamat kepada seluruh anggota {championTeam?.name ?? "tim pemenang"} atas ketangkasan Nahwu & Shorof terbaik.
            </p>
          </div>

          {championMembers.length > 0 && (
            <div className="champion-roster">
              {championMembers.map((member) => (
                <div key={member.id} className="champion-member-pill">
                  <span>{member.avatar}</span>
                  <strong>{member.name}</strong>
                </div>
              ))}
            </div>
          )}

          {topThree.length > 0 && (
            <div className="mvp-podium">
              {topThree.map((entry, idx) => (
                <div className={`podium-card rank-${idx + 1}`} key={entry.playerId}>
                  <span className="podium-rank">#{idx + 1} {idx === 0 ? "MVP" : "TOP"}</span>
                  <span className="podium-avatar">{entry.avatar}</span>
                  <strong>{entry.playerName}</strong>
                  <small>{entry.teamName ?? "Peserta"}</small>
                  <div className="podium-stat">
                    <b>{entry.damageDealt} DMG</b>
                    <span>{entry.correctAnswers} benar</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {room.status === "running" && byeTeam && (
        <div className="panel bye-ticker" style={{ marginBottom: 18 }}>
          <span className="badge-pill">BYE RONDE {room.currentRound ?? 1}</span>
          <strong>{byeTeam.name}</strong> otomatis lolos ke ronde berikutnya tanpa bertanding di ronde ini.
        </div>
      )}

      {room.status === "running" && activeMatches.length > 0 && (
        <section className="arena-matches-grid" style={{ marginBottom: 20 }}>
          {activeMatches.map((match) => {
            const [teamAId, teamBId] = match.teamIds;
            const teamA = room.teams.find((t) => t.id === teamAId);
            const teamB = room.teams.find((t) => t.id === teamBId);
            const hpA = match.hp[teamAId] ?? room.config.startingHp;
            const hpB = match.hp[teamBId] ?? room.config.startingHp;
            const feedback = match.feedback;
            const hitTeamA = feedback?.targetTeamId === teamAId;
            const hitTeamB = feedback?.targetTeamId === teamBId;
            const hitKey = feedback ? `${match.id}-${match.questionNumber}-${feedback.card}` : "none";

            const isReading = match.phase === "reading";
            const isAnswering = match.phase === "answering";
            const isCountdown = match.phase === "countdown";
            const countdownSec = match.countdownEndsAt
              ? Math.max(0, Math.ceil((match.countdownEndsAt - now) / 1000))
              : 0;
            const countdownLabel =
              match.status === "paused" ? "PAUSE" : countdownSec > 0 ? String(countdownSec) : "MULAI!";

            const phaseTotal = isReading ? room.config.readingSeconds : room.config.questionSeconds;
            const remainingMs = match.question
              ? match.status === "paused" && match.question.pausedRemainingMs
                ? match.question.pausedRemainingMs
                : isReading
                ? Math.max(0, match.question.readEndsAt - now)
                : Math.max(0, match.question.endsAt - now)
              : 0;
            const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
            const phaseProgress = Math.max(0, Math.min(100, (remainingMs / Math.max(1, phaseTotal * 1000)) * 100));

            return (
              <div className="panel question-panel display-match-card" key={match.id}>
                <div className="score-strip">
                  <div
                    key={hitTeamA ? `hitA-${hitKey}` : "idleA"}
                    className={`score-team score-team-relative ${hitTeamA ? "damage-hit-shake" : ""}`}
                  >
                    <strong>{teamA?.name ?? "Tim A"}</strong>
                    <b>{hpA} HP</b>
                    <HpBar hp={hpA} maxHp={room.config.startingHp} variant="green" />
                    {hitTeamA && feedback && (
                      <span className="floating-dmg-badge">-{feedback.damage} HP</span>
                    )}
                  </div>
                  <span className="round-mark vs-pulse">VS</span>
                  <div
                    key={hitTeamB ? `hitB-${hitKey}` : "idleB"}
                    className={`score-team score-team-relative ${hitTeamB ? "damage-hit-shake" : ""}`}
                  >
                    <strong>{teamB?.name ?? "Tim B"}</strong>
                    <b>{hpB} HP</b>
                    <HpBar hp={hpB} maxHp={room.config.startingHp} variant="orange" />
                    {hitTeamB && feedback && (
                      <span className="floating-dmg-badge">-{feedback.damage} HP</span>
                    )}
                  </div>
                </div>

                {isCountdown && (
                  <div className="display-countdown-stage">
                    <span className="countdown-kicker">Ronde {room.currentRound ?? 1} · Bersiap di Arena</span>
                    <div className="vs-clash-row">
                      <span>{teamA?.name ?? "Tim A"}</span>
                      <b>⚡</b>
                      <span>{teamB?.name ?? "Tim B"}</span>
                    </div>
                    <div
                      key={countdownLabel}
                      className={`display-countdown-num ${
                        countdownLabel === "MULAI!" || countdownLabel === "PAUSE" ? "final" : ""
                      }`}
                    >
                      {countdownLabel}
                    </div>
                    <p className="micro" style={{ color: "#cfe6a8", margin: 0 }}>
                      Kartu akan terbuka setelah waktu baca selesai
                    </p>
                  </div>
                )}

                {match.status === "finished" && (
                  <div className="match-winner-banner">
                    <span className="eyebrow">Pertandingan Selesai</span>
                    <h3>
                      🏆 {room.teams.find((team) => team.id === match.winnerTeamId)?.name ?? "Pemenang"} Lolos!
                    </h3>
                    <p className="micro" style={{ marginBottom: 0 }}>
                      Menunggu pertandingan lain selesai untuk lanjut ke ronde berikutnya…
                    </p>
                  </div>
                )}

                {match.question && match.status !== "finished" && !isCountdown && (
                  <div className="display-question-flow" key={match.question.id}>
                    <div
                      className={`phase-banner ${
                        match.status === "paused" ? "paused" : match.phase ?? ""
                      }`}
                    >
                      <span>
                        {match.status === "paused"
                          ? "⏸ SOAL DIJEDA HOST"
                          : isReading
                          ? "📖 WAKTU BACA SOAL — SIAPKAN KARTU"
                          : isAnswering
                          ? "⚡ REBUTAN JAWABAN — ANGKAT KARTU!"
                          : "🔒 SOAL TERKUNCI"}
                      </span>
                      <span className="phase-clock">
                        {match.status === "paused" || match.status === "question"
                          ? `${remainingSec} dtk`
                          : "—"}
                      </span>
                    </div>

                    <div
                      className={`phase-track ${isAnswering ? "answering" : ""} ${
                        remainingSec <= 2 && match.status === "question" ? "low" : ""
                      }`}
                    >
                      <span style={{ width: `${phaseProgress}%` }} />
                    </div>

                    <div className="question-top" style={{ marginBottom: 6 }}>
                      <span>
                        {match.tieBreaker
                          ? "🔥 SOAL TIE-BREAKER (SUDDEN DEATH)"
                          : `SOAL ${match.question.number} / ${room.config.questionsPerMatch}`}
                      </span>
                      <span>
                        {match.question.multiplier > 1
                          ? `DAMAGE x${match.question.multiplier}`
                          : match.question.category ?? "Nahwu"}
                      </span>
                    </div>

                    <h2 className="question-text question-pop-in" dir="auto" style={{ margin: "12px 0 18px" }}>
                      {match.question.text}
                    </h2>

                    <div className="answer-grid">
                      {CARD_LETTERS.map((letter, idx) => {
                        const isPicked = feedback?.card === letter;
                        const pickedClass = feedback
                          ? isPicked
                            ? feedback.correct
                              ? "answer-picked-correct"
                              : "answer-picked-wrong"
                            : "answer-dimmed"
                          : isAnswering && match.status === "question"
                          ? "live-contend"
                          : "";
                        return (
                          <div
                            className={`answer display-answer-card ${pickedClass}`}
                            style={{ animationDelay: `${idx * 45}ms` }}
                            key={letter}
                          >
                            <span className="answer-letter">{letter}</span>
                            <span dir="auto">{match.question!.options[idx]}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {match.status === "locked" && !feedback && (
                  <div className="feedback" role="status" style={{ marginTop: 14 }}>
                    Waktu habis. Soal ditutup tanpa damage.
                  </div>
                )}

                <DamagePopup feedback={feedback} teams={room.teams} />
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
