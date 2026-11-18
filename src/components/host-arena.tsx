"use client";

import {
  Bracket,
  HpBar,
  Leaderboard,
  TeamPanel,
} from "@/components/game-widgets";
import {
  CARD_LETTERS,
  type AnswerFeedback,
  type BracketMatchSummary,
  type MatchView,
  type Player,
  type RoomConfig,
  type RoomSnapshot,
  type Team,
} from "@/lib/game";

export type HostMatchItem = MatchView | BracketMatchSummary;
export type HostModalTab = "teams" | "bracket" | "leaderboard";
export type GridDensity = "duo" | "quad" | "six" | "dense";

function isLiveMatchView(match: HostMatchItem): match is MatchView {
  return "questionNumber" in match;
}

export function getMatchTiming(match: HostMatchItem, config: RoomConfig, now: number) {
  const live = isLiveMatchView(match) ? match : undefined;
  const phase = live?.phase;
  const isReading = phase === "reading";
  const isAnswering = phase === "answering";
  const isCountdown = phase === "countdown";
  const countdownSec = live?.countdownEndsAt
    ? Math.max(0, Math.ceil((live.countdownEndsAt - now) / 1000))
    : 0;
  const countdownLabel =
    match.status === "paused" ? "PAUSE" : countdownSec > 0 ? String(countdownSec) : "MULAI!";

  const phaseTotal = isReading ? config.readingSeconds : config.questionSeconds;
  const question = live?.question;
  const remainingMs = question
    ? match.status === "paused" && question.pausedRemainingMs
      ? question.pausedRemainingMs
      : isReading
      ? Math.max(0, question.readEndsAt - now)
      : Math.max(0, question.endsAt - now)
    : 0;
  const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
  const phaseProgress = Math.max(0, Math.min(100, (remainingMs / Math.max(1, phaseTotal * 1000)) * 100));

  return {
    live,
    question,
    feedback: live?.feedback,
    isReading,
    isAnswering,
    isCountdown,
    countdownLabel,
    remainingSec,
    phaseProgress,
  };
}

export function getGridMetrics(count: number): { cols: number; rows: number; density: GridDensity } {
  if (count <= 2) return { cols: 2, rows: 1, density: "duo" };
  if (count <= 4) return { cols: 2, rows: 2, density: "quad" };
  if (count <= 6) return { cols: 3, rows: 2, density: "six" };
  if (count <= 9) return { cols: 3, rows: 3, density: "dense" };
  if (count <= 12) return { cols: 4, rows: 3, density: "dense" };
  if (count <= 16) return { cols: 4, rows: 4, density: "dense" };
  return { cols: 5, rows: Math.ceil(count / 5), density: "dense" };
}

function getTeamMembers(team: Team | undefined, players: Player[]): Player[] {
  if (!team) return [];
  return team.playerIds
    .map((playerId) => players.find((player) => player.id === playerId))
    .filter((player): player is Player => Boolean(player));
}

function formatRosterPreview(members: Player[]): string {
  if (members.length === 0) return "Belum ada anggota";
  const shown = members.slice(0, 3).map((member) => `${member.avatar} ${member.name}`);
  return members.length > 3 ? `${shown.join(" · ")} +${members.length - 3}` : shown.join(" · ");
}

function renderInlineFeedback(
  feedback: AnswerFeedback | undefined,
  match: HostMatchItem,
  teams: Team[],
  isReading: boolean
) {
  if (feedback) {
    const targetName = teams.find((team) => team.id === feedback.targetTeamId)?.name ?? "Tim";
    const isFast = typeof feedback.responseMs === "number" && feedback.responseMs <= 1800;
    return (
      <div className={`host-feedback-bar feedback-animated ${feedback.correct ? "correct" : "wrong"}`} role="status">
        <span className={`impact-badge ${feedback.correct ? "hit" : "self"}`}>
          {feedback.correct ? "⚡ SERANGAN" : "💥 SALAH"}
        </span>
        <span className="host-feedback-text">
          <strong>{feedback.playerName}</strong> kartu{" "}
          <span className="picked-card-pill">{feedback.card}</span> ·{" "}
          {feedback.correct
            ? `${feedback.damage} damage ke ${targetName}`
            : `${targetName} kena -${feedback.damage} HP`}
        </span>
        <span className="host-feedback-meta">
          {typeof feedback.responseMs === "number" && (
            <span className="time-chip">{(feedback.responseMs / 1000).toFixed(1)} dtk</span>
          )}
          {isFast && feedback.correct && <span className="fast-chip">⚡ CEPAT</span>}
          <span className="dmg-chip">-{feedback.damage} HP</span>
        </span>
      </div>
    );
  }

  if (match.status === "locked") {
    return (
      <div className="host-feedback-bar neutral" role="status">
        <span>⏳ Waktu habis. Soal ditutup tanpa damage.</span>
      </div>
    );
  }

  if (match.status === "paused") {
    return (
      <div className="host-feedback-bar neutral" role="status">
        <span>⏸ Pertandingan dijeda sementara oleh host.</span>
      </div>
    );
  }

  return (
    <div className="host-feedback-bar neutral" role="status">
      <span>
        {isReading
          ? "📖 Fase baca soal — kartu pemain terbuka setelah waktu baca selesai."
          : "⚡ Rebutan kartu aktif — jawaban tercepat & tepat menyerang HP lawan!"}
      </span>
    </div>
  );
}

export function HostMatchFocus({
  match,
  matchIndex,
  roundNumber,
  room,
  now,
  canControlMatch,
  showPerMatchControls,
  onPauseMatch,
  onSkipMatch,
}: {
  match: HostMatchItem;
  matchIndex: number;
  roundNumber: number;
  room: RoomSnapshot;
  now: number;
  canControlMatch: boolean;
  showPerMatchControls: boolean;
  onPauseMatch?: (matchId: string) => void;
  onSkipMatch?: (matchId: string) => void;
}) {
  const [teamAId, teamBId] = match.teamIds;
  const teamA = room.teams.find((team) => team.id === teamAId);
  const teamB = room.teams.find((team) => team.id === teamBId);
  const membersA = getTeamMembers(teamA, room.players);
  const membersB = getTeamMembers(teamB, room.players);
  const hpA = match.hp[teamAId] ?? room.config.startingHp;
  const hpB = match.hp[teamBId] ?? room.config.startingHp;

  const {
    live,
    question,
    feedback,
    isReading,
    isAnswering,
    isCountdown,
    countdownLabel,
    remainingSec,
    phaseProgress,
  } = getMatchTiming(match, room.config, now);

  const hitTeamA = feedback?.targetTeamId === teamAId;
  const hitTeamB = feedback?.targetTeamId === teamBId;
  const hitKey = feedback ? `${match.id}-${live?.questionNumber ?? 0}-${feedback.card}` : "none";
  const winnerTeam = room.teams.find((team) => team.id === match.winnerTeamId);

  return (
    <article className="panel host-focus-stage">
      <div className="host-focus-score">
        <div
          key={hitTeamA ? `hitA-${hitKey}` : "idleA"}
          className={`score-team score-team-relative host-focus-team ${hitTeamA ? "damage-hit-shake" : ""}`}
        >
          <div className="host-focus-team-head">
            <strong>{teamA?.name ?? "Tim A"}</strong>
            <b>{hpA} HP</b>
          </div>
          <HpBar hp={hpA} maxHp={room.config.startingHp} variant="green" />
          <small className="host-team-roster">{formatRosterPreview(membersA)}</small>
          {hitTeamA && feedback && <span className="floating-dmg-badge">-{feedback.damage} HP</span>}
        </div>

        <div className="host-vs-center">
          <span className="host-vs-meta">
            R{roundNumber} · LAGA {matchIndex}
          </span>
          <span className="round-mark vs-pulse host-vs-big">VS</span>
          {showPerMatchControls && canControlMatch && (
            <div className="host-match-mini-actions">
              <button
                type="button"
                className="mini-action-btn"
                onClick={() => onPauseMatch?.(match.id)}
                title={match.status === "paused" ? "Lanjutkan laga ini" : "Jeda laga ini"}
              >
                {match.status === "paused" ? "▶" : "⏸"}
              </button>
              <button
                type="button"
                className="mini-action-btn danger"
                onClick={() => onSkipMatch?.(match.id)}
                title="Lewati soal di laga ini"
              >
                ⏭
              </button>
            </div>
          )}
        </div>

        <div
          key={hitTeamB ? `hitB-${hitKey}` : "idleB"}
          className={`score-team score-team-relative host-focus-team right ${hitTeamB ? "damage-hit-shake" : ""}`}
        >
          <div className="host-focus-team-head">
            <b>{hpB} HP</b>
            <strong>{teamB?.name ?? "Tim B"}</strong>
          </div>
          <HpBar hp={hpB} maxHp={room.config.startingHp} variant="orange" />
          <small className="host-team-roster">{formatRosterPreview(membersB)}</small>
          {hitTeamB && feedback && <span className="floating-dmg-badge">-{feedback.damage} HP</span>}
        </div>
      </div>

      {isCountdown && (
        <div className="display-countdown-stage host-focus-fill">
          <span className="countdown-kicker">Ronde {roundNumber} · Bersiap di Arena</span>
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
            Kartu pemain terbuka setelah fase baca selesai
          </p>
        </div>
      )}

      {match.status === "finished" && (
        <div className="match-winner-banner host-finished-match-stage">
          <span className="eyebrow">Laga Ronde {roundNumber} Selesai</span>
          <h3>🏆 {winnerTeam?.name ?? "Pemenang"} Menang Laga Ini!</h3>
          <p className="micro" style={{ margin: "0 0 12px" }}>
            Skor akhir: <strong>{teamA?.name ?? "Tim A"}</strong> ({hpA} HP) vs{" "}
            <strong>{teamB?.name ?? "Tim B"}</strong> ({hpB} HP)
            {room.status === "running" && roundNumber === room.currentRound
              ? " · Menunggu laga lain selesai untuk masuk ronde berikutnya…"
              : ""}
          </p>
          <div className="host-finished-rosters">
            {[
              { team: teamA, members: membersA, hp: hpA, isWinner: match.winnerTeamId === teamAId },
              { team: teamB, members: membersB, hp: hpB, isWinner: match.winnerTeamId === teamBId },
            ].map((side, idx) => (
              <div
                key={side.team?.id ?? idx}
                className={`host-finished-side ${side.isWinner ? "winner" : ""}`}
              >
                <div className="host-finished-side-head">
                  <strong>
                    {side.isWinner ? "🏆 " : ""}
                    {side.team?.name ?? `Tim ${idx + 1}`}
                  </strong>
                  <span>{side.hp} HP</span>
                </div>
                <div className="host-finished-member-list">
                  {side.members.map((member) => (
                    <span className="host-finished-member-pill" key={member.id}>
                      <span>{member.avatar} {member.name}</span>
                      <b>{member.stats?.damageDealt ?? 0} DMG</b>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {question && match.status !== "finished" && !isCountdown && (
        <div className="host-focus-question-flow" key={question.id}>
          <div className="host-phase-bar">
            <div className={`phase-banner ${match.status === "paused" ? "paused" : live?.phase ?? ""}`}>
              <span>
                {match.status === "paused"
                  ? "⏸ SOAL DIJEDA"
                  : isReading
                  ? "📖 FASE BACA SOAL — PEMAIN BERSIAP"
                  : isAnswering
                  ? "⚡ WAKTU MENJAWAB — REBUTAN KARTU!"
                  : "🔒 SOAL TERKUNCI"}
              </span>
              <span className="phase-clock">
                {match.status === "paused" || match.status === "question" ? `${remainingSec} dtk` : "—"}
              </span>
            </div>

            <div
              className={`phase-track host-phase-track ${isAnswering ? "answering" : ""} ${
                remainingSec <= 2 && match.status === "question" ? "low" : ""
              }`}
            >
              <span style={{ width: `${phaseProgress}%` }} />
            </div>
          </div>

          <div className="question-stage-card host-focus-question-card">
            <div className="question-meta-row">
              <span className="question-chip">
                {match.tieBreaker
                  ? "🔥 TIE-BREAKER"
                  : `SOAL ${question.number} / ${room.config.questionsPerMatch}`}
              </span>
              <span className="question-chip">
                {question.multiplier > 1 ? `DAMAGE x${question.multiplier}` : question.category ?? "Nahwu"}
              </span>
            </div>

            <div className="host-focus-qwrap">
              <h2 className="question-text question-pop-in host-focus-qtext" dir="auto">
                {question.text}
              </h2>
            </div>

            <div className="host-cards-stage host-cards-compact">
              {CARD_LETTERS.map((letter, idx) => {
                const isPicked = feedback?.card === letter;
                const cardState = feedback
                  ? isPicked
                    ? feedback.correct
                      ? "card-picked-correct"
                      : "card-picked-wrong"
                    : "card-dimmed"
                  : isAnswering && match.status === "question"
                  ? "playable-pulse"
                  : "";
                return (
                  <div
                    className={`host-arena-card ${cardState}`}
                    style={{ animationDelay: `${idx * 35}ms` }}
                    key={letter}
                  >
                    <span className="host-card-corner">{letter}</span>
                    <span className="host-card-letter">{letter}</span>
                    <span className="host-card-option" dir="auto">
                      {question.options[idx]}
                    </span>
                    {isPicked && feedback && <span className="host-card-picker">{feedback.playerName}</span>}
                  </div>
                );
              })}
            </div>

            {renderInlineFeedback(feedback, match, room.teams, isReading)}
          </div>
        </div>
      )}

      {!question && !isCountdown && match.status !== "finished" && (
        <div className="match-winner-banner host-finished-match-stage">
          <span className="eyebrow">Ronde {roundNumber} · Laga {matchIndex}</span>
          <h3>Menyiapkan Pertandingan…</h3>
        </div>
      )}
    </article>
  );
}

export function HostMatchGridTile({
  match,
  matchIndex,
  room,
  now,
  density,
  onSelect,
}: {
  match: HostMatchItem;
  matchIndex: number;
  room: RoomSnapshot;
  now: number;
  density: GridDensity;
  onSelect: () => void;
}) {
  const [teamAId, teamBId] = match.teamIds;
  const teamA = room.teams.find((team) => team.id === teamAId);
  const teamB = room.teams.find((team) => team.id === teamBId);
  const hpA = match.hp[teamAId] ?? room.config.startingHp;
  const hpB = match.hp[teamBId] ?? room.config.startingHp;

  const {
    live,
    question,
    feedback,
    isReading,
    isAnswering,
    isCountdown,
    countdownLabel,
    remainingSec,
    phaseProgress,
  } = getMatchTiming(match, room.config, now);

  const hitTeamA = feedback?.targetTeamId === teamAId;
  const hitTeamB = feedback?.targetTeamId === teamBId;
  const hitKey = feedback ? `${match.id}-${live?.questionNumber ?? 0}-${feedback.card}` : "none";
  const winnerTeam = room.teams.find((team) => team.id === match.winnerTeamId);

  const statusText =
    match.status === "finished"
      ? "🏆 Selesai"
      : match.status === "paused"
      ? "⏸ Jeda"
      : isCountdown
      ? `⏳ ${countdownLabel}`
      : isReading
      ? `📖 ${remainingSec}d`
      : isAnswering
      ? `⚡ ${remainingSec}d`
      : "🔒 Tutup";

  const statusTone =
    match.status === "finished"
      ? "finished"
      : match.status === "paused"
      ? "paused"
      : isAnswering
      ? "answering"
      : isReading
      ? "reading"
      : "neutral";

  return (
    <button type="button" className={`panel host-tile ${density}`} onClick={onSelect}>
      <div className="host-tile-head">
        <span className="host-tile-title">
          <strong>Laga {matchIndex}</strong>
          {question && (
            <small>
              {match.tieBreaker ? "TIE" : `${question.number}/${room.config.questionsPerMatch}`}
            </small>
          )}
        </span>
        <span className={`host-tile-status ${statusTone}`}>{statusText}</span>
      </div>

      <div className="host-tile-score">
        <div
          key={hitTeamA ? `tA-${hitKey}` : "tA-idle"}
          className={`score-team score-team-relative host-tile-team ${hitTeamA ? "damage-hit-shake" : ""}`}
        >
          <div className="host-tile-team-row">
            <strong>{teamA?.name ?? "Tim A"}</strong>
            <b>{hpA}</b>
          </div>
          <HpBar hp={hpA} maxHp={room.config.startingHp} variant="green" />
          {hitTeamA && feedback && <span className="floating-dmg-badge">-{feedback.damage}</span>}
        </div>
        <span className="round-mark">VS</span>
        <div
          key={hitTeamB ? `tB-${hitKey}` : "tB-idle"}
          className={`score-team score-team-relative host-tile-team right ${hitTeamB ? "damage-hit-shake" : ""}`}
        >
          <div className="host-tile-team-row">
            <b>{hpB}</b>
            <strong>{teamB?.name ?? "Tim B"}</strong>
          </div>
          <HpBar hp={hpB} maxHp={room.config.startingHp} variant="orange" />
          {hitTeamB && feedback && <span className="floating-dmg-badge">-{feedback.damage}</span>}
        </div>
      </div>

      {question && match.status !== "finished" && !isCountdown && (
        <div className={`phase-track host-tile-track ${isAnswering ? "answering" : ""} ${remainingSec <= 2 && match.status === "question" ? "low" : ""}`}>
          <span style={{ width: `${phaseProgress}%` }} />
        </div>
      )}

      <div className="host-tile-body">
        {isCountdown && (
          <div className="host-tile-countdown">
            <small>Bersiap</small>
            <strong>{countdownLabel}</strong>
          </div>
        )}

        {match.status === "finished" && (
          <div className="host-tile-winner">
            <strong>🏆 {winnerTeam?.name ?? "Pemenang"} Menang!</strong>
            <small>
              Skor akhir {hpA} – {hpB} HP
            </small>
          </div>
        )}

        {question && match.status !== "finished" && !isCountdown && (
          <>
            <p className="host-tile-qtext" dir="auto">
              {question.text}
            </p>
            {density === "duo" ? (
              <div className="host-tile-cards-duo">
                {CARD_LETTERS.map((letter, idx) => {
                  const isPicked = feedback?.card === letter;
                  const state = feedback
                    ? isPicked
                      ? feedback.correct
                        ? "picked-correct"
                        : "picked-wrong"
                      : "dimmed"
                    : "";
                  return (
                    <div className={`host-tile-card-chip ${state}`} key={letter}>
                      <b>{letter}</b>
                      <span dir="auto">{question.options[idx]}</span>
                    </div>
                  );
                })}
              </div>
            ) : density === "quad" ? (
              <div className="host-tile-options-quad">
                {CARD_LETTERS.map((letter, idx) => {
                  const isPicked = feedback?.card === letter;
                  const state = feedback
                    ? isPicked
                      ? feedback.correct
                        ? "picked-correct"
                        : "picked-wrong"
                      : "dimmed"
                    : "";
                  return (
                    <span className={`host-tile-opt-pill ${state}`} key={letter}>
                      <b>{letter}</b>
                      <span dir="auto">{question.options[idx]}</span>
                    </span>
                  );
                })}
              </div>
            ) : (
              <div className="host-tile-pips">
                {CARD_LETTERS.map((letter, idx) => {
                  const isPicked = feedback?.card === letter;
                  const state = feedback
                    ? isPicked
                      ? feedback.correct
                        ? "picked-correct"
                        : "picked-wrong"
                      : "dimmed"
                    : "";
                  return (
                    <span
                      className={`host-tile-pip ${state}`}
                      key={letter}
                      title={`${letter}: ${question.options[idx]}`}
                    >
                      {letter}
                    </span>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      <div className={`host-tile-footer ${feedback ? (feedback.correct ? "correct" : "wrong") : ""}`}>
        {feedback ? (
          <span>
            {feedback.correct ? "⚡" : "💥"} {feedback.playerName} [{feedback.card}] · -{feedback.damage} HP
          </span>
        ) : match.status === "finished" ? (
          <span>Klik untuk lihat rincian laga</span>
        ) : match.status === "locked" ? (
          <span>Waktu habis · 0 DMG</span>
        ) : (
          <span>Klik untuk fokus laga ↗</span>
        )}
      </div>
    </button>
  );
}

export function HostTournamentModal({
  room,
  activeTab,
  onChangeTab,
  onClose,
  onSelectMatch,
}: {
  room: RoomSnapshot;
  activeTab: HostModalTab | null;
  onChangeTab: (tab: HostModalTab) => void;
  onClose: () => void;
  onSelectMatch: (matchId: string, round?: number) => void;
}) {
  if (!activeTab) return null;
  const activeMatches = room.matches ?? (room.match ? [room.match] : []);
  const currentRoundEntry = room.bracket?.find((entry) => entry.round === room.currentRound);

  return (
    <div
      className="team-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="team-modal host-data-modal" role="dialog" aria-modal="true" aria-labelledby="host-modal-title">
        <header className="team-modal-head">
          <div>
            <span className="eyebrow">
              Ronde {room.currentRound ?? 1} · {room.code}
            </span>
            <h2 id="host-modal-title">Data Turnamen & Statistik</h2>
          </div>
          <div className="btn-row" style={{ gap: 6 }}>
            <button
              type="button"
              className={`host-tab-pill ${activeTab === "teams" ? "active" : ""}`}
              onClick={() => onChangeTab("teams")}
            >
              Tim ({room.teams.length})
            </button>
            <button
              type="button"
              className={`host-tab-pill ${activeTab === "bracket" ? "active" : ""}`}
              onClick={() => onChangeTab("bracket")}
            >
              Bracket
            </button>
            <button
              type="button"
              className={`host-tab-pill ${activeTab === "leaderboard" ? "active" : ""}`}
              onClick={() => onChangeTab("leaderboard")}
            >
              Leaderboard MVP
            </button>
            <button
              type="button"
              className="team-modal-close"
              onClick={onClose}
              aria-label="Tutup modal data turnamen"
            >
              ×
            </button>
          </div>
        </header>

        <div className="team-modal-body">
          {activeTab === "teams" && (
            <TeamPanel
              teams={room.teams}
              players={room.players}
              championTeamId={room.championTeamId}
              matches={activeMatches}
              maxHp={room.config.startingHp}
              byeTeamId={currentRoundEntry?.byeTeamId}
              onSelectMatch={onSelectMatch}
            />
          )}

          {activeTab === "bracket" && (
            <Bracket
              bracket={room.bracket}
              teams={room.teams}
              maxHp={room.config.startingHp}
              championTeamId={room.championTeamId}
              onSelectMatch={onSelectMatch}
            />
          )}

          {activeTab === "leaderboard" && <Leaderboard entries={room.leaderboard} />}
        </div>
      </section>
    </div>
  );
}
