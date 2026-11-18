"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import {
  JoinShareBox,
  Leaderboard,
  TeamPanel,
} from "@/components/game-widgets";
import {
  getGridMetrics,
  HostMatchFocus,
  HostMatchGridTile,
  HostTournamentModal,
  type HostMatchItem,
  type HostModalTab,
} from "@/components/host-arena";
import type { Quiz, RoomSnapshot } from "@/lib/game";
import { getSocket } from "@/lib/socket";
import { sfx, useRoomBgm } from "@/lib/sound";

const HOST_CONFETTI = Array.from({ length: 18 }, (_, index) => ({
  id: index,
  left: `${5 + ((index * 19) % 90)}%`,
  delay: `${(index % 6) * 0.28}s`,
  duration: `${2.8 + (index % 4) * 0.45}s`,
  color: ["#1f704b", "#d8f36a", "#f3b74d", "#bc4a3e", "#3a8f66"][index % 5],
}));

type FinishedTab = "summary" | "matches" | "teams" | "leaderboard";

export default function HostRoomPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<RoomSnapshot>();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [selectedRound, setSelectedRound] = useState<number | null>(null);
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [modalTab, setModalTab] = useState<HostModalTab | null>(null);
  const [finishedTab, setFinishedTab] = useState<FinishedTab>("summary");
  const { muted, toggleMute } = useRoomBgm(room?.status);
  const seenFeedbacksRef = useRef<Set<string>>(new Set());
  const lastCountdownRef = useRef<Record<string, number>>({});
  const victoryPlayedRef = useRef(false);

  useEffect(() => {
    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

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

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 120);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setSelectedRound(null);
    setSelectedMatchId(null);
  }, [room?.currentRound]);

  useEffect(() => {
    if (!modalTab) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setModalTab(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalTab]);

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

  const startMatch = useCallback(() => {
    setBusy(true);
    setError("");
    getSocket().emit("host:start", { roomId: id }, (result) => {
      setBusy(false);
      if (result.error) setError(result.error);
    });
  }, [id]);

  function updateConfig(
    field:
      | "startingHp"
      | "baseDamage"
      | "speedBonus"
      | "readingSeconds"
      | "questionSeconds"
      | "questionsPerMatch"
      | "quizId",
    value: number | string
  ) {
    if (!room) return;
    getSocket().emit("host:configure", { roomId: id, config: { [field]: value } }, (result) => {
      if (result.error) setError(result.error);
    });
  }

  function togglePause(matchId?: string) {
    setError("");
    getSocket().emit("host:pause", { roomId: id, matchId }, (result) => {
      if (result.error) setError(result.error);
    });
  }

  function skipQuestion(matchId?: string) {
    setError("");
    getSocket().emit("host:skip", { roomId: id, matchId }, (result) => {
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
      <main className="shell host-shell spectator-stage">
        <div className="ambient-orb orb-a" aria-hidden="true" />
        <div className="ambient-orb orb-b" aria-hidden="true" />
        <header className="topbar host-topbar">
          <Brand />
        </header>
        <div className="panel waiting" style={{ margin: "auto 0" }}>
          <h2>Memuat panel host…</h2>
          {error && <p className="error">{error}</p>}
        </div>
      </main>
    );
  }

  const activeMatches = room.matches ?? (room.match ? [room.match] : []);
  const anyPaused = activeMatches.some((match) => match.status === "paused");
  const bracketRounds = room.bracket ?? [];
  const currentRoundNum = room.currentRound ?? bracketRounds[bracketRounds.length - 1]?.round ?? 1;
  const activeRoundNum = selectedRound ?? currentRoundNum;
  const isViewingLiveRound = activeRoundNum === currentRoundNum && room.status === "running";
  const selectedRoundEntry = bracketRounds.find((entry) => entry.round === activeRoundNum);
  const displayedMatches: HostMatchItem[] =
    activeRoundNum === currentRoundNum && activeMatches.length > 0
      ? activeMatches
      : selectedRoundEntry?.matches ?? [];

  const focusedMatchIndex =
    displayedMatches.length === 1
      ? 0
      : selectedMatchId
      ? displayedMatches.findIndex((match) => match.id === selectedMatchId)
      : -1;
  const focusedMatch = focusedMatchIndex >= 0 ? displayedMatches[focusedMatchIndex] : undefined;
  const gridMetrics = getGridMetrics(displayedMatches.length);

  const byeTeam = selectedRoundEntry?.byeTeamId
    ? room.teams.find((team) => team.id === selectedRoundEntry.byeTeamId)
    : undefined;
  const championTeam = room.teams.find((team) => team.id === room.championTeamId);
  const championMembers = championTeam
    ? room.players.filter((player) => championTeam.playerIds.includes(player.id))
    : [];
  const topThree = (room.leaderboard ?? []).slice(0, 3);
  const lobbyProgress = Math.min(100, (room.players.length / 6) * 100);

  const teamName = (teamId: string) => room.teams.find((team) => team.id === teamId)?.name ?? teamId;

  function selectRound(roundNum: number) {
    setSelectedRound(roundNum === currentRoundNum ? null : roundNum);
    setSelectedMatchId(null);
  }

  function jumpToMatch(matchId: string, round?: number) {
    if (typeof round === "number") {
      setSelectedRound(round === currentRoundNum ? null : round);
    }
    setSelectedMatchId(matchId);
    setModalTab(null);
    if (room?.status === "finished") {
      setFinishedTab("matches");
    }
  }

  function stepFocusedMatch(delta: number) {
    if (displayedMatches.length === 0) return;
    const nextIdx =
      focusedMatchIndex < 0
        ? 0
        : (focusedMatchIndex + delta + displayedMatches.length) % displayedMatches.length;
    setSelectedMatchId(displayedMatches[nextIdx].id);
  }

  function renderMatchNavigator() {
    if (displayedMatches.length === 0 && bracketRounds.length === 0) return null;
    return (
      <div className="panel host-arena-nav">
        <div className="host-nav-group">
          {bracketRounds.length > 1 ? (
            bracketRounds.map((entry) => {
              const isCurrent = entry.round === currentRoundNum;
              const isActive = entry.round === activeRoundNum;
              return (
                <button
                  key={entry.round}
                  type="button"
                  className={`host-tab-pill ${isActive ? "active" : ""}`}
                  onClick={() => selectRound(entry.round)}
                >
                  Ronde {entry.round}
                  {isCurrent && room?.status === "running" ? " · LIVE" : ""}
                </button>
              );
            })
          ) : (
            <span className="host-nav-label">
              Ronde {activeRoundNum} · {displayedMatches.length} Laga
            </span>
          )}
          {byeTeam && <span className="badge-pill">BYE: {byeTeam.name}</span>}
        </div>

        <div className="host-nav-group right">
          {displayedMatches.length > 1 && (
            <button
              type="button"
              className={`host-tab-pill ${!focusedMatch ? "active" : ""}`}
              onClick={() => setSelectedMatchId(null)}
            >
              Semua Laga ({displayedMatches.length})
            </button>
          )}

          {displayedMatches.length <= 6 ? (
            displayedMatches.map((match, idx) => {
              const [teamAId, teamBId] = match.teamIds;
              const isSelected = focusedMatch?.id === match.id;
              return (
                <button
                  key={match.id}
                  type="button"
                  className={`host-match-pill ${isSelected ? "active" : ""} ${
                    match.status === "finished" ? "done" : ""
                  }`}
                  onClick={() => setSelectedMatchId(match.id)}
                >
                  <span className="host-match-pill-idx">L{idx + 1}</span>
                  <span>
                    {teamName(teamAId)} vs {teamName(teamBId)}
                  </span>
                  <small>
                    {match.status === "finished"
                      ? `🏆 ${teamName(match.winnerTeamId ?? teamAId)}`
                      : `${match.hp[teamAId] ?? room?.config.startingHp}:${
                          match.hp[teamBId] ?? room?.config.startingHp
                        }`}
                  </small>
                </button>
              );
            })
          ) : (
            <div className="host-nav-group" style={{ gap: 6 }}>
              {focusedMatch && (
                <>
                  <button
                    type="button"
                    className="host-tab-pill"
                    onClick={() => stepFocusedMatch(-1)}
                    aria-label="Laga sebelumnya"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    className="host-tab-pill"
                    onClick={() => stepFocusedMatch(1)}
                    aria-label="Laga berikutnya"
                  >
                    ›
                  </button>
                </>
              )}
              <select
                aria-label="Pilih laga atau tim"
                className="host-match-select"
                value={focusedMatch?.id ?? ""}
                onChange={(event) => setSelectedMatchId(event.target.value || null)}
              >
                <option value="">Tampilkan semua laga ({displayedMatches.length})</option>
                {displayedMatches.map((match, idx) => (
                  <option key={match.id} value={match.id}>
                    Laga {idx + 1}: {teamName(match.teamIds[0])} vs {teamName(match.teamIds[1])}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderMatchStage() {
    if (displayedMatches.length === 0) {
      return (
        <div className="panel waiting" style={{ margin: "auto 0" }}>
          <h2>Menyiapkan arena pertandingan…</h2>
        </div>
      );
    }

    if (focusedMatch) {
      return (
        <HostMatchFocus
          match={focusedMatch}
          matchIndex={focusedMatchIndex + 1}
          roundNumber={activeRoundNum}
          room={room!}
          now={now}
          canControlMatch={isViewingLiveRound && focusedMatch.status !== "finished"}
          showPerMatchControls={activeMatches.length > 1}
          onPauseMatch={(matchId) => togglePause(matchId)}
          onSkipMatch={(matchId) => skipQuestion(matchId)}
        />
      );
    }

    return (
      <div
        className="host-all-matches-grid"
        style={{
          gridTemplateColumns: `repeat(${gridMetrics.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${gridMetrics.rows}, minmax(0, 1fr))`,
        }}
      >
        {displayedMatches.map((match, index) => (
          <HostMatchGridTile
            key={match.id}
            match={match}
            matchIndex={index + 1}
            room={room!}
            now={now}
            density={gridMetrics.density}
            onSelect={() => setSelectedMatchId(match.id)}
          />
        ))}
      </div>
    );
  }

  return (
    <main className="shell host-shell spectator-stage">
      <div className="ambient-orb orb-a" aria-hidden="true" />
      <div className="ambient-orb orb-b" aria-hidden="true" />

      <header className="topbar host-topbar">
        <div className="host-topbar-left">
          <Brand />
          <span className="live-pill">
            {room.status === "running" && <span className="live-dot" />}
            {room.status === "lobby"
              ? "LOBBY"
              : room.status === "running"
              ? `RONDE ${room.currentRound ?? 1}`
              : "SELESAI"}
          </span>
          <button
            type="button"
            className="status-tag host-code-btn"
            onClick={copyCode}
            title="Salin kode room"
          >
            {copied ? "✓ Tersalin" : `KODE: ${room.code}`}
          </button>
          {room.status === "running" && (
            <span className="status-tag host-meta-pill">
              {activeMatches.length} Laga · {room.teams.length} Tim · {room.players.length} Pemain
            </span>
          )}
        </div>

        <div className="btn-row host-topbar-actions">
          {room.status === "running" && (
            <>
              <button type="button" className="button secondary" onClick={() => togglePause()}>
                {anyPaused ? "▶ Lanjut" : "⏸ Jeda"}
              </button>
              <button type="button" className="button danger" onClick={() => skipQuestion()}>
                ⏭ Lewati
              </button>
            </>
          )}
          {room.teams.length > 0 && (
            <>
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalTab("teams")}
              >
                Tim ({room.teams.length})
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalTab("bracket")}
              >
                Bracket
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() => setModalTab("leaderboard")}
              >
                MVP
              </button>
            </>
          )}
          <button type="button" className="button secondary" onClick={toggleMute}>
            {muted ? "🔇 Mati" : "🔊 Audio"}
          </button>
          <Link className="button secondary" href={`/display/${room.id}`} target="_blank">
            Proyektor
          </Link>
          <Link className="button secondary" href="/host">
            Dashboard
          </Link>
        </div>
      </header>

      {error && (
        <p className="error host-inline-error" role="alert">
          {error}
        </p>
      )}

      <div className="host-stage-body">
        {room.status === "lobby" && (
          <div className="host-lobby-layout">
            <section className="host-lobby-left">
              <div className="host-lobby-share">
                <JoinShareBox code={room.code} roomId={room.id} />
              </div>

              <div className="panel host-lobby-players">
                <div className="question-top" style={{ marginBottom: 6, flex: "0 0 auto" }}>
                  <span>PEMAIN DI ROOM ({room.players.length})</span>
                  <span>{room.players.length} / 6 minimal</span>
                </div>
                <div className="phase-track answering" style={{ margin: "0 0 10px", flex: "0 0 auto" }}>
                  <span style={{ width: `${lobbyProgress}%` }} />
                </div>

                {room.players.length === 0 ? (
                  <div className="waiting host-lobby-empty">
                    <p className="big-code" style={{ margin: "0 0 6px" }}>{room.code}</p>
                    <p className="micro" style={{ margin: 0 }}>
                      Belum ada pemain. Minta peserta memasukkan kode ini atau scan QR di atas.
                    </p>
                  </div>
                ) : (
                  <div className="host-lobby-player-grid">
                    {room.players.map((player, index) => (
                      <div
                        className="player-row pop-in-chip host-lobby-player-chip"
                        style={{ animationDelay: `${Math.min(index, 20) * 30}ms` }}
                        key={player.id}
                      >
                        <span className="avatar">{player.avatar}</span>
                        <span className="player-meta">
                          <strong>{player.name}</strong>
                          <small>{player.connected ? "Siap" : "Terputus"}</small>
                        </span>
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
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <aside className="panel host-lobby-config">
              <div className="host-lobby-config-scroll">
                <h2 style={{ marginBottom: 4 }}>Aturan room & kuis</h2>
                <p className="panel-sub" style={{ marginBottom: 10 }}>
                  Berlaku untuk seluruh laga di turnamen ini.
                </p>

                {quizzes.length > 0 && (
                  <div className="field" style={{ margin: "0 0 10px" }}>
                    <label htmlFor="quiz-select">Paket Kuis</label>
                    <select
                      id="quiz-select"
                      className="input"
                      style={{ minHeight: 40 }}
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

                <div className="settings host-lobby-settings">
                  <div className="field">
                    <label htmlFor="hp">HP awal</label>
                    <input
                      id="hp"
                      className="input"
                      type="number"
                      min={20}
                      max={500}
                      step={10}
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
                      value={room.config.baseDamage}
                      onChange={(event) => updateConfig("baseDamage", Number(event.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="reading">Waktu baca (dtk)</label>
                    <input
                      id="reading"
                      className="input"
                      type="number"
                      min={1}
                      max={30}
                      value={room.config.readingSeconds}
                      onChange={(event) => updateConfig("readingSeconds", Number(event.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="seconds">Detik menjawab</label>
                    <input
                      id="seconds"
                      className="input"
                      type="number"
                      min={5}
                      max={120}
                      value={room.config.questionSeconds}
                      onChange={(event) => updateConfig("questionSeconds", Number(event.target.value))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="speed-bonus">Bonus cepat</label>
                    <input
                      id="speed-bonus"
                      className="input"
                      type="number"
                      min={0}
                      max={50}
                      value={room.config.speedBonus}
                      onChange={(event) => updateConfig("speedBonus", Number(event.target.value))}
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
                      value={room.config.questionsPerMatch}
                      onChange={(event) => updateConfig("questionsPerMatch", Number(event.target.value))}
                    />
                  </div>
                </div>

                <p id="seed-note" className="micro" style={{ margin: "6px 0 0" }}>
                  Kuis aktif: <strong>{room.quizTitle ?? "Nahwu & Mufradat Dasar"}</strong>.{" "}
                  <Link href="/host">Edit kuis →</Link>
                </p>
              </div>

              <button
                className="button full"
                disabled={busy || room.players.length < 6 || room.players.length > 200}
                onClick={startMatch}
              >
                {busy ? "Membentuk tim…" : "Acak tim dan mulai"}
              </button>
            </aside>
          </div>
        )}

        {room.status === "running" && (
          <>
            {renderMatchNavigator()}
            <section className="host-arena-stage">{renderMatchStage()}</section>
          </>
        )}

        {room.status === "finished" && (
          <>
            <div className="panel host-arena-nav">
              <div className="host-nav-group">
                <button
                  type="button"
                  className={`host-tab-pill ${finishedTab === "summary" ? "active" : ""}`}
                  onClick={() => setFinishedTab("summary")}
                >
                  🏆 Juara & Podium
                </button>
                <button
                  type="button"
                  className={`host-tab-pill ${finishedTab === "matches" ? "active" : ""}`}
                  onClick={() => setFinishedTab("matches")}
                >
                  ⚔️ Laga Tiap Tim
                </button>
                <button
                  type="button"
                  className={`host-tab-pill ${finishedTab === "teams" ? "active" : ""}`}
                  onClick={() => setFinishedTab("teams")}
                >
                  👥 Tim & Statistik
                </button>
                <button
                  type="button"
                  className={`host-tab-pill ${finishedTab === "leaderboard" ? "active" : ""}`}
                  onClick={() => setFinishedTab("leaderboard")}
                >
                  🏅 Leaderboard MVP
                </button>
              </div>
              <span className="host-nav-label">
                Juara: <strong>{championTeam?.name ?? "Tim Juara"}</strong>
              </span>
            </div>

            {finishedTab === "summary" && (
              <section className="panel champion-stage host-finished-hero">
                <div className="confetti-layer" aria-hidden="true">
                  {HOST_CONFETTI.map((item) => (
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
                  <span className="trophy-badge small" aria-hidden="true">🏆</span>
                  <span className="eyebrow">Turnamen Selesai · Juara Bertahan</span>
                  <h1 style={{ fontSize: "clamp(28px, 4vw, 46px)", margin: "6px 0 8px" }}>
                    {championTeam?.name ?? "Tim Juara"} Menang!
                  </h1>
                  <p className="micro" style={{ margin: "0 auto" }}>
                    Seluruh pertandingan selesai. Pilih tab di atas untuk melihat laga tiap tim, bracket, atau leaderboard MVP.
                  </p>
                </div>

                {championMembers.length > 0 && (
                  <div className="champion-roster" style={{ marginTop: 12 }}>
                    {championMembers.map((member) => (
                      <div key={member.id} className="champion-member-pill">
                        <span>{member.avatar}</span>
                        <strong>{member.name}</strong>
                      </div>
                    ))}
                  </div>
                )}

                {topThree.length > 0 && (
                  <div className="mvp-podium host-finished-podium">
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

            {finishedTab === "matches" && (
              <>
                {renderMatchNavigator()}
                <section className="host-arena-stage">{renderMatchStage()}</section>
              </>
            )}

            {finishedTab === "teams" && (
              <section className="panel host-scrollable-panel">
                <TeamPanel
                  teams={room.teams}
                  players={room.players}
                  championTeamId={room.championTeamId}
                  matches={activeMatches}
                  maxHp={room.config.startingHp}
                  byeTeamId={selectedRoundEntry?.byeTeamId}
                  onSelectMatch={jumpToMatch}
                />
              </section>
            )}

            {finishedTab === "leaderboard" && (
              <section className="panel host-scrollable-panel">
                <Leaderboard entries={room.leaderboard} />
              </section>
            )}
          </>
        )}
      </div>

      <HostTournamentModal
        room={room}
        activeTab={modalTab}
        onChangeTab={(tab) => setModalTab(tab)}
        onClose={() => setModalTab(null)}
        onSelectMatch={jumpToMatch}
      />
    </main>
  );
}
