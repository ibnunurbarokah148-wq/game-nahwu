"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Brand } from "@/components/brand";
import { Bracket, HpBar, Leaderboard, TeamPanel } from "@/components/game-widgets";
import { CARD_LETTERS, type CardLetter, type RoomSnapshot } from "@/lib/game";
import { getSocket } from "@/lib/socket";
import { sfx, useRoomBgm } from "@/lib/sound";

export default function PlayPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const router = useRouter();
  const [room, setRoom] = useState<RoomSnapshot>();
  const [cards, setCards] = useState<CardLetter[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const { muted, toggleMute } = useRoomBgm(room?.status);
  const lastFeedbackKey = useRef<string>("");
  const lastCountdownRef = useRef<number | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);
  const playerId = typeof window !== "undefined" ? localStorage.getItem(`player-id:${roomId}`) : null;

  useEffect(() => {
    if (!playerId) {
      router.replace("/");
      return;
    }
    const socket = getSocket();
    const update = (snapshot: RoomSnapshot) => {
      if (snapshot.id === roomId) setRoom(snapshot);
    };
    const receiveCards = (newCards: CardLetter[]) => setCards(newCards);
    const token = localStorage.getItem(`player-token-room:${roomId}`);
    const subscribe = () => {
      if (token) {
        socket.emit("room:subscribe", { roomId, playerId, token }, (result) => {
          if (result.error) setError(result.error);
        });
      }
    };
    socket.on("room:update", update);
    socket.on("player:cards", receiveCards);
    socket.on("connect", subscribe);
    if (socket.connected) subscribe();
    return () => {
      socket.off("room:update", update);
      socket.off("player:cards", receiveCards);
      socket.off("connect", subscribe);
    };
  }, [playerId, roomId, router]);

  const player = room?.players.find((candidate) => candidate.id === playerId);
  const team = room?.teams.find((candidate) => candidate.id === player?.teamId);
  const myMatch = useMemo(() => {
    if (!room) return undefined;
    if (team && room.matches?.length) {
      const found = room.matches.find((candidate) => candidate.teamIds.includes(team.id));
      if (found) return found;
    }
    return room.match;
  }, [room, team]);

  const phase = myMatch?.phase;
  const isParticipantInMatch = Boolean(team && myMatch?.teamIds.includes(team.id));
  const currentRoundEntry = room?.bracket?.find((entry) => entry.round === room.currentRound);
  const hasByeThisRound = Boolean(team && currentRoundEntry?.byeTeamId === team.id);
  const question = myMatch?.question;
  const sortedCards = useMemo(
    () => [...cards].sort((a, b) => CARD_LETTERS.indexOf(a) - CARD_LETTERS.indexOf(b)),
    [cards]
  );

  useEffect(() => {
    if (phase !== "countdown" || !myMatch?.countdownEndsAt) {
      setCountdown(null);
      lastCountdownRef.current = null;
      return;
    }
    const tick = () =>
      setCountdown(Math.max(0, Math.ceil((myMatch.countdownEndsAt! - Date.now()) / 1000)));
    tick();
    const interval = setInterval(tick, 100);
    return () => clearInterval(interval);
  }, [phase, myMatch?.countdownEndsAt]);

  useEffect(() => {
    if (countdown === null || countdown <= 0) return;
    if (lastCountdownRef.current === countdown) return;
    lastCountdownRef.current = countdown;
    sfx.playCountdown();
  }, [countdown]);

  useEffect(() => {
    if (!question) {
      setRemaining(0);
      return;
    }
    if (myMatch?.status === "paused" && question.pausedRemainingMs) {
      setRemaining(Math.max(0, Math.ceil(question.pausedRemainingMs / 1000)));
      return;
    }
    const target = phase === "reading" ? question.readEndsAt : question.endsAt;
    const refresh = () => setRemaining(Math.max(0, Math.ceil((target - Date.now()) / 1000)));
    refresh();
    const interval = setInterval(refresh, 250);
    return () => clearInterval(interval);
  }, [question, myMatch?.status, phase]);

  useEffect(() => {
    setSubmitted(myMatch?.status !== "question" || phase !== "answering");
  }, [myMatch?.id, myMatch?.questionNumber, myMatch?.status, phase]);

  useEffect(() => {
    if (!myMatch?.feedback) return;
    const key = `${myMatch.id}:${myMatch.questionNumber}:${myMatch.feedback.playerId}:${myMatch.feedback.card}`;
    if (lastFeedbackKey.current === key) return;
    lastFeedbackKey.current = key;
    if (myMatch.feedback.correct) {
      sfx.playCorrect();
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);
    } else {
      sfx.playWrong();
      if (navigator.vibrate) navigator.vibrate([80, 50, 80]);
    }
  }, [myMatch?.feedback, myMatch?.id, myMatch?.questionNumber]);

  useEffect(() => {
    if (room?.status === "finished" && room.championTeamId === team?.id) {
      sfx.playVictory();
    }
  }, [room?.status, room?.championTeamId, team?.id]);

  useEffect(() => {
    if (!teamModalOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setTeamModalOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [teamModalOpen]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function raiseCard(card: CardLetter) {
    if (
      !myMatch ||
      !question ||
      !playerId ||
      submitted ||
      !isParticipantInMatch ||
      myMatch.status !== "question" ||
      phase !== "answering"
    ) {
      return;
    }
    setSubmitted(true);
    setError("");
    sfx.playCardRaise();
    getSocket().emit(
      "card:raise",
      { roomId, matchId: myMatch.id, questionId: question.id, card },
      (result) => {
        if (result.error) {
          setError(result.error);
          if (myMatch.status === "question" && myMatch.phase === "answering") setSubmitted(false);
        }
      }
    );
    if (navigator.vibrate) navigator.vibrate(25);
  }

  if (!room || !player) {
    return (
      <main className="shell">
        <header className="topbar"><Brand /></header>
        <div className="panel waiting">
          <h2>Menghubungkan ke room…</h2>
          {error && <p role="alert" className="error">{error}</p>}
        </div>
      </main>
    );
  }

  const teamName = team?.name ?? "Belum ada tim";
  const opponent = room.teams.find((item) => myMatch?.teamIds.includes(item.id) && item.id !== player?.teamId);
  const feedback = myMatch?.feedback;
  const isMyFeedback = feedback?.playerId === playerId;
  const disconnectedTeammates = room.players.filter(
    (candidate) => candidate.teamId === team?.id && !candidate.connected && candidate.id !== player.id
  );
  const isCountdown = room.status === "running" && isParticipantInMatch && phase === "countdown";
  const countdownText =
    myMatch?.status === "paused"
      ? "PAUSE"
      : countdown === null
      ? "3"
      : countdown <= 0
      ? "MULAI!"
      : String(countdown);
  const phaseTotal = phase === "reading" ? room.config.readingSeconds : room.config.questionSeconds;
  const phaseProgress = Math.max(0, Math.min(100, (remaining / Math.max(1, phaseTotal)) * 100));

  return (
    <main className="shell game-wrap play-shell">
      <header className="topbar">
        <Brand />
        <div className="btn-row">
          <button type="button" className="button secondary" onClick={toggleMute}>
            {muted ? "Audio mati" : "Audio aktif"}
          </button>
          {room.teams.length > 0 && (
            <button type="button" className="button secondary" onClick={() => setTeamModalOpen(true)}>
              Tim{team ? ` · ${team.playerIds.length}` : ""}
            </button>
          )}
        </div>
      </header>

      <div className="play-body">
        {room.status === "lobby" ? (
        <section className="panel waiting">
          <span className="eyebrow">Sudah masuk sebagai {player.avatar} {player.name}</span>
          <h2>Menunggu host memulai</h2>
          <p className="micro">Kamu berada di room {room.code} ({room.quizTitle ?? "Kuis Nahwu"}). Host akan mengacak pemain ke dalam tim.</p>
          <p className="big-code">{room.players.length} pemain</p>
          <p className="micro">Minimal 6 pemain untuk membentuk tim pertarungan.</p>
        </section>
      ) : (
        <>
          {isCountdown && (
            <div className="countdown-overlay" role="status" aria-live="polite">
              <div className="countdown-inner">
                <span className="countdown-kicker">Ronde {room.currentRound ?? 1} · Bersiap</span>
                <div className="countdown-vs">
                  <span>{team?.name ?? "Tim A"}</span>
                  <b>VS</b>
                  <span>{opponent?.name ?? "Tim B"}</span>
                </div>
                <div
                  key={countdownText}
                  className={`countdown-number ${countdownText === "MULAI!" || countdownText === "PAUSE" ? "final" : ""}`}
                >
                  {countdownText}
                </div>
                <p className="countdown-hint">Siapkan kartumu. Soal muncul setelah hitungan selesai.</p>
              </div>
            </div>
          )}

          {myMatch && isParticipantInMatch && team && (
            <div className="score-strip">
              <div className="score-team">
                <strong>{team.name} · {player.name}</strong>
                <b>{myMatch.hp[team.id] ?? room.config.startingHp} HP</b>
                <HpBar
                  hp={myMatch.hp[team.id] ?? room.config.startingHp}
                  maxHp={room.config.startingHp}
                  variant="green"
                />
              </div>
              <span className="round-mark">R{room.currentRound ?? 1} · {room.code}</span>
              <div className="score-team">
                <strong>{opponent?.name ?? "Tim lawan"}</strong>
                <b>{myMatch.hp[opponent?.id ?? ""] ?? room.config.startingHp} HP</b>
                <HpBar
                  hp={myMatch.hp[opponent?.id ?? ""] ?? room.config.startingHp}
                  maxHp={room.config.startingHp}
                  variant="orange"
                />
              </div>
            </div>
          )}

          {hasByeThisRound && room.status === "running" && (
            <section className="panel waiting">
              <span className="eyebrow">Ronde {room.currentRound} · Bye</span>
              <h2>{teamName} mendapat Bye!</h2>
              <p className="micro">Tim kamu otomatis lolos ke ronde berikutnya. Buka tombol Tim untuk melihat bracket dan tim lain.</p>
            </section>
          )}

          {!isParticipantInMatch && !hasByeThisRound && room.status === "running" && (
            <section className="panel waiting">
              <span className="eyebrow">Mode Penonton · Ronde {room.currentRound}</span>
              <h2>Menonton Pertandingan</h2>
              <p className="micro">Tim kamu sedang menunggu atau telah gugur. Buka tombol Tim untuk melihat bracket.</p>
            </section>
          )}

          {room.status === "finished" && (
            <section className="panel waiting">
              <span className="eyebrow">Turnamen Selesai</span>
              <h2>
                {room.championTeamId === team?.id
                  ? "Tim kamu menang turnamen!"
                  : `Pemenang: ${room.teams.find((item) => item.id === room.championTeamId)?.name ?? "Tim Pemenang"}`}
              </h2>
              {team && myMatch && isParticipantInMatch && (
                <p className="micro">{teamName} · {myMatch.hp[team.id] ?? 0} HP tersisa di laga terakhir</p>
              )}
            </section>
          )}

          {room.status === "running" && isParticipantInMatch && myMatch?.status === "finished" && (
            <section className="panel waiting">
              <span className="eyebrow">Pertandingan Ronde {room.currentRound} Selesai</span>
              <h2>{myMatch.winnerTeamId === team?.id ? "Tim kamu menang ronde ini!" : "Pertandingan berakhir"}</h2>
              <p className="micro">Menunggu pertandingan lain di ronde ini selesai untuk lanjut ke ronde berikutnya…</p>
            </section>
          )}

          {room.status === "running" && isParticipantInMatch && myMatch && myMatch.status !== "finished" && question && (
            <section className={`panel question-panel arena-stage ${myMatch.status === "paused" ? "paused" : ""}`}>
              <div className={`phase-banner ${myMatch.status === "paused" ? "paused" : phase ?? ""}`}>
                <span>
                  {myMatch.status === "paused"
                    ? "SOAL DIJEDA"
                    : phase === "reading"
                    ? "WAKTU BACA SOAL"
                    : phase === "answering"
                    ? "WAKTU MENJAWAB"
                    : "SOAL TERKUNCI"}
                </span>
                <span className="phase-clock" aria-live="polite">
                  {myMatch.status === "paused" || myMatch.status === "question" ? `${remaining} dtk` : "—"}
                </span>
              </div>

              <div
                className={`phase-track ${phase === "answering" ? "answering" : ""} ${
                  remaining <= 2 && myMatch.status === "question" ? "low" : ""
                }`}
              >
                <span style={{ width: `${phaseProgress}%` }} />
              </div>

              <div className="question-stage-card">
                <div className="question-meta-row">
                  <span className="question-chip">
                    {myMatch.tieBreaker ? "TIE-BREAKER" : `SOAL ${question.number} / ${room.config.questionsPerMatch}`}
                  </span>
                  <span className="question-chip">
                    {question.multiplier > 1 ? `DAMAGE x${question.multiplier}` : question.category ?? "Nahwu"}
                  </span>
                </div>

                <h1 className="question-text" dir="auto">{question.text}</h1>

                <div className={`hand-zone ${phase ?? ""}`}>
                    <div className="hand-label">
                      <span>Kartu Kamu</span>
                      <span>{sortedCards.length} kartu</span>
                    </div>

                    <div
                      className={`hand-cards ${
                        sortedCards.length >= 3 ? "three" : sortedCards.length === 2 ? "two" : "one"
                      }`}
                    >
                      {sortedCards.map((card) => {
                        const optionText = question.options[CARD_LETTERS.indexOf(card)];
                        const playable = myMatch.status === "question" && phase === "answering" && !submitted;
                        return (
                          <button
                            type="button"
                            className={`held-card ${playable ? "playable" : ""}`}
                            key={card}
                            disabled={!playable}
                            onClick={() => raiseCard(card)}
                            aria-label={`Angkat kartu ${card}: ${optionText}`}
                          >
                            <span className="held-card-corner top">{card}</span>
                            <span className="held-card-letter">{card}</span>
                            <span className="held-card-option" dir="auto">{optionText}</span>
                            <span className="held-card-corner bottom">{card}</span>
                            {playable && <span className="held-card-cta">Angkat Kartu</span>}
                          </button>
                        );
                      })}
                    </div>

                    <p className={`hand-note ${phase === "answering" && !submitted ? "live" : ""}`}>
                      {myMatch.status === "paused"
                        ? "Soal dijeda. Tunggu host melanjutkan."
                        : phase === "reading"
                        ? "Baca dulu. Kartu terkunci sampai waktu baca habis."
                        : phase === "answering" && !submitted
                        ? "Waktu menjawab! Tekan kartumu sekarang."
                        : submitted && myMatch.status === "question"
                        ? "Kartu sudah diangkat. Menunggu hasil…"
                        : "Menunggu soal berikutnya…"}
                    </p>

                    {disconnectedTeammates.length > 0 && (
                      <p className="hand-note">
                        <span className="dc-badge">Bot-slot aktif</span> Kartu rekan yang terputus sedang dioper ke tim.
                      </p>
                    )}
                </div>
              </div>

              {feedback && (
                <div className={`feedback ${feedback.correct ? "" : "wrong"}`} role="status">
                  {isMyFeedback
                    ? feedback.correct
                      ? `Benar. ${feedback.damage} damage ke ${opponent?.name ?? "lawan"}.`
                      : `Kurang tepat. Tim kamu kehilangan ${feedback.damage} HP.`
                    : `${feedback.playerName} mengangkat kartu ${feedback.card}. ${
                        feedback.correct ? `Jawaban benar (-${feedback.damage} HP).` : `Jawaban salah (-${feedback.damage} HP).`
                      }`}
                </div>
              )}

              {myMatch.status === "locked" && !feedback && (
                <div className="feedback" role="status">Soal ditutup tanpa damage.</div>
              )}
              {error && <p className="error" role="alert">{error}</p>}
            </section>
          )}

          {room.status === "running" && isParticipantInMatch && myMatch && myMatch.status !== "finished" && !question && (
            <section className="panel waiting">
              <span className="eyebrow">{teamName}</span>
              <h2>Siapkan kartu</h2>
              <p className="micro">Host akan menampilkan soal. Kartu jawaban hanya terlihat olehmu.</p>
              <div className="fake-cards">
                {sortedCards.map((card, index) => (
                  <span key={`${card}-${index}`}>{card}</span>
                ))}
              </div>
            </section>
          )}

        </>
      )}
      </div>

      {teamModalOpen && (
        <div
          className="team-modal-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setTeamModalOpen(false);
          }}
        >
          <section className="team-modal" role="dialog" aria-modal="true" aria-labelledby="team-modal-title">
            <header className="team-modal-head">
              <div>
                <span className="eyebrow">Ronde {room.currentRound ?? 1} · {room.code}</span>
                <h2 id="team-modal-title">Tim & Turnamen</h2>
              </div>
              <button
                type="button"
                className="team-modal-close"
                onClick={() => setTeamModalOpen(false)}
                aria-label="Tutup daftar tim"
              >
                ×
              </button>
            </header>
            <div className="team-modal-body">
              <TeamPanel
                teams={room.teams}
                players={room.players}
                championTeamId={room.championTeamId}
                highlightTeamId={team?.id}
                selfPlayerId={player.id}
              />
              {room.bracket && room.bracket.length > 0 && (
                <section className="team-modal-section">
                  <h3>Bracket Turnamen</h3>
                  <Bracket
                    bracket={room.bracket}
                    teams={room.teams}
                    maxHp={room.config.startingHp}
                    championTeamId={room.championTeamId}
                  />
                </section>
              )}
              {room.leaderboard && room.leaderboard.length > 0 && (
                <section className="team-modal-section">
                  <h3>Papan Skor</h3>
                  <Leaderboard entries={room.leaderboard} />
                </section>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
