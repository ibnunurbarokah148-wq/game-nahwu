"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { AnswerFeedback, BracketRound, LeaderboardEntry, MatchView, Player, Team } from "@/lib/game";
import { encodeQrMatrix } from "@/lib/qr";

export function HpBar({
  hp,
  maxHp,
  variant = "green",
}: {
  hp: number;
  maxHp: number;
  variant?: "green" | "orange";
}) {
  const pct = Math.max(0, Math.min(100, (hp / Math.max(1, maxHp)) * 100));
  const lowHp = pct > 0 && pct <= 25;
  return (
    <div
      className={`hp-track ${lowHp ? "low-hp" : ""} ${variant === "orange" ? "orange" : ""}`}
      role="progressbar"
      aria-valuenow={hp}
      aria-valuemin={0}
      aria-valuemax={maxHp}
    >
      <span className="hp-trail" style={{ width: `${pct}%` }} />
      <span className="hp-fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function DamagePopup({
  feedback,
  teams,
}: {
  feedback?: AnswerFeedback;
  teams: Team[];
}) {
  if (!feedback) return null;
  const targetName = teams.find((team) => team.id === feedback.targetTeamId)?.name ?? "Tim";
  const isFast = typeof feedback.responseMs === "number" && feedback.responseMs <= 1800;
  return (
    <div className={`feedback feedback-animated ${feedback.correct ? "" : "wrong"}`} role="status" style={{ marginTop: 14 }}>
      <div className="feedback-head">
        <span className={`impact-badge ${feedback.correct ? "hit" : "self"}`}>
          {feedback.correct ? "⚡ SERANGAN MASUK" : "💥 SENJATA MAKAN TUAN"}
        </span>
        <span className="dmg-chip">-{feedback.damage} HP</span>
      </div>
      <div className="feedback-body">
        <strong>{feedback.playerName}</strong> mengangkat kartu{" "}
        <span className="picked-card-pill">{feedback.card}</span> ·{" "}
        {feedback.correct
          ? `${feedback.damage} damage ke ${targetName}.`
          : `Kurang tepat. ${targetName} kehilangan ${feedback.damage} HP.`}
        {typeof feedback.responseMs === "number" && (
          <span className="response-badges">
            <span className="time-chip">{(feedback.responseMs / 1000).toFixed(1)} dtk</span>
            {isFast && feedback.correct && <span className="fast-chip">⚡ BONUS CEPAT</span>}
          </span>
        )}
      </div>
    </div>
  );
}

export function TeamPanel({
  teams,
  players,
  championTeamId,
  highlightTeamId,
  selfPlayerId,
  matches,
  maxHp,
  byeTeamId,
  onSelectMatch,
}: {
  teams: Team[];
  players: Player[];
  championTeamId?: string;
  highlightTeamId?: string;
  selfPlayerId?: string;
  matches?: MatchView[];
  maxHp?: number;
  byeTeamId?: string;
  onSelectMatch?: (matchId: string, round?: number) => void;
}) {
  if (teams.length === 0) return null;
  return (
    <div className="team-columns">
      {teams.map((team) => {
        const isChampion = championTeamId === team.id;
        const isMine = highlightTeamId === team.id;
        const isBye = byeTeamId === team.id;
        const teamMatch = matches?.find((match) => match.teamIds.includes(team.id));
        const opponentId = teamMatch?.teamIds.find((id) => id !== team.id);
        const opponentName = teams.find((candidate) => candidate.id === opponentId)?.name;
        const teamHp = teamMatch?.hp[team.id];
        const wonRound = teamMatch?.winnerTeamId === team.id;
        const teamMembers = team.playerIds
          .map((playerId) => players.find((item) => item.id === playerId))
          .filter((item): item is Player => Boolean(item));
        const totalTeamDmg = teamMembers.reduce(
          (sum, member) => sum + (member.stats?.damageDealt ?? 0),
          0
        );

        return (
          <div
            className={`team-box ${isChampion ? "champion-box" : ""} ${isMine ? "my-team-box" : ""}`}
            key={team.id}
          >
            <h3>
              <span>{team.name}</span>
              <span className="btn-row" style={{ gap: 5 }}>
                {isMine && <span className="badge-pill mine">Tim Kamu</span>}
                {isChampion && <span className="badge-pill">Juara</span>}
                {!isChampion && isBye && <span className="badge-pill">BYE</span>}
                {!isChampion && wonRound && <span className="badge-pill">Menang Ronde</span>}
                {typeof teamHp === "number" && (
                  <span className="team-hp-chip">♥ {teamHp} HP</span>
                )}
              </span>
            </h3>

            {typeof teamHp === "number" && typeof maxHp === "number" && (
              <div style={{ marginBottom: 10 }}>
                <HpBar hp={teamHp} maxHp={maxHp} variant="green" />
              </div>
            )}

            <div className="team-stat-line">
              <span>
                {teamMembers.length} anggota
                {opponentName ? ` · vs ${opponentName}` : ""}
              </span>
              <span className="btn-row" style={{ gap: 6 }}>
                <span>Total {totalTeamDmg} DMG</span>
                {teamMatch && onSelectMatch && (
                  <button
                    type="button"
                    className="mini-link-btn"
                    onClick={() => onSelectMatch(teamMatch.id, teamMatch.round)}
                  >
                    Lihat laga →
                  </button>
                )}
              </span>
            </div>

            {teamMembers.map((player) => {
              const isSelf = player.id === selfPlayerId;
              const stats = player.stats;
              return (
                <div className={`team-player ${isSelf ? "self-player" : ""}`} key={player.id}>
                  <span className="avatar">{player.avatar}</span>
                  <span className="player-meta">
                    <strong>
                      {player.name} {isSelf && <span className="self-tag">Kamu</span>}
                    </strong>
                    {!player.connected && (
                      <small>Terputus sementara · kartu dioper ke tim</small>
                    )}
                  </span>
                  {stats && (
                    <span className="member-stat-pill">
                      <b>{stats.damageDealt} DMG</b>
                      <small>
                        {stats.correctAnswers}B / {stats.wrongAnswers}S
                      </small>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

export function Bracket({
  bracket,
  teams,
  maxHp,
  championTeamId,
  onSelectMatch,
}: {
  bracket?: BracketRound[];
  teams: Team[];
  maxHp: number;
  championTeamId?: string;
  onSelectMatch?: (matchId: string, round?: number) => void;
}) {
  if (!bracket || bracket.length === 0) return null;
  const teamName = (id?: string) => teams.find((team) => team.id === id)?.name ?? id ?? "Menunggu";

  return (
    <div className="team-columns">
      {bracket.map((round) => (
        <div className="team-box" key={round.round}>
          <div className="question-top" style={{ marginBottom: 12 }}>
            <span>RONDE {round.round}</span>
            <span>{round.matches.length} LAGA</span>
          </div>
          <div className="player-list">
            {round.matches.map((match) => {
              const [teamA, teamB] = match.teamIds;
              const hpA = match.hp[teamA] ?? maxHp;
              const hpB = match.hp[teamB] ?? maxHp;
              return (
                <div
                  className={`bracket-match-card ${onSelectMatch ? "clickable" : ""}`}
                  key={match.id}
                >
                  <div className="question-top" style={{ fontSize: 11, marginBottom: 8 }}>
                    <span>
                      {match.tieBreaker
                        ? "TIE-BREAKER"
                        : match.status === "finished"
                        ? "SELESAI"
                        : match.status === "paused"
                        ? "DIJEDA"
                        : "BERLANGSUNG"}
                    </span>
                    <span className="btn-row" style={{ gap: 6 }}>
                      {match.winnerTeamId && <span>PEMENANG: {teamName(match.winnerTeamId)}</span>}
                      {onSelectMatch && (
                        <button
                          type="button"
                          className="mini-link-btn"
                          onClick={() => onSelectMatch(match.id, round.round)}
                        >
                          Lihat →
                        </button>
                      )}
                    </span>
                  </div>
                  <div className="bracket-vs-row">
                    <div className={`bracket-team-pill ${match.winnerTeamId === teamA ? "winner" : ""}`}>
                      <strong>{teamName(teamA)}</strong>
                      <b>{hpA} HP</b>
                    </div>
                    <span className="round-mark">VS</span>
                    <div className={`bracket-team-pill orange ${match.winnerTeamId === teamB ? "winner" : ""}`}>
                      <strong>{teamName(teamB)}</strong>
                      <b>{hpB} HP</b>
                    </div>
                  </div>
                </div>
              );
            })}
            {round.byeTeamId && (
              <div className="bracket-match-card">
                <div className="question-top" style={{ fontSize: 11, marginBottom: 6 }}>
                  <span>LOLOS OTOMATIS (BYE)</span>
                </div>
                <div className="bracket-team-pill winner">
                  <strong>{teamName(round.byeTeamId)}</strong>
                  <b>BYE</b>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      {championTeamId && (
        <div className="team-box champion-box">
          <span className="eyebrow">Pemenang Akhir</span>
          <h3 style={{ fontSize: 22, marginTop: 6, marginBottom: 4 }}>{teamName(championTeamId)}</h3>
          <p className="micro">Juara turnamen kuis tim kartu.</p>
        </div>
      )}
    </div>
  );
}

export function Leaderboard({ entries }: { entries?: LeaderboardEntry[] }) {
  if (!entries || entries.length === 0) return null;
  return (
    <div className="player-list">
      {entries.map((entry, index) => (
        <div className={`player-row ${index === 0 && entry.damageDealt > 0 ? "mvp-row" : ""}`} key={entry.playerId}>
          <span className="answer-letter">{index + 1}</span>
          <span className="avatar">{entry.avatar}</span>
          <span className="player-meta">
            <strong>
              {entry.playerName}{" "}
              {index === 0 && entry.damageDealt > 0 && <span className="badge-pill">MVP</span>}
            </strong>
            <small>
              {entry.teamName ?? "Belum ada tim"} · Benar {entry.correctAnswers} · Salah {entry.wrongAnswers}
              {entry.avgResponseMs > 0 ? ` · ${(entry.avgResponseMs / 1000).toFixed(1)} dtk` : ""}
            </small>
          </span>
          <strong className="room-code" style={{ fontSize: 16, letterSpacing: "-.02em" }}>
            {entry.damageDealt} DMG
          </strong>
        </div>
      ))}
    </div>
  );
}

export function JoinShareBox({ code, roomId }: { code: string; roomId: string }) {
  const [copiedLink, setCopiedLink] = useState(false);
  const joinPath = `/join/${code}`;
  const [joinUrl, setJoinUrl] = useState(joinPath);

  useEffect(() => {
    setJoinUrl(`${window.location.origin}${joinPath}`);
  }, [joinPath]);

  async function copyJoinLink() {
    await navigator.clipboard.writeText(joinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1600);
  }

  const matrix = useMemo(() => encodeQrMatrix(joinUrl), [joinUrl]);
  const qrSize = matrix.length;

  return (
    <div className="panel join-share-box">
      <div className="qr-badge" aria-label={`Kode QR bergabung ke room ${code}`}>
        <svg
          className="qr-svg"
          viewBox={`-2 -2 ${qrSize + 4} ${qrSize + 4}`}
          role="img"
          aria-label={`QR Code untuk ${joinPath}`}
        >
          <rect x={-2} y={-2} width={qrSize + 4} height={qrSize + 4} fill="#ffffff" rx={1.5} />
          {matrix.map((row, r) =>
            row.map((dark, c) =>
              dark ? <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="#17221b" /> : null
            )
          )}
        </svg>
        <small className="micro">{joinPath}</small>
      </div>
      <div className="join-share-actions">
        <span className="eyebrow">Kode Masuk Room</span>
        <div className="big-code" style={{ margin: "4px 0 6px" }}>{code}</div>
        <p className="micro" style={{ marginBottom: 14 }}>
          Scan QR atau masukkan kode 6 karakter di halaman utama untuk bergabung.
        </p>
        <div className="btn-row">
          <button type="button" className="button secondary" onClick={copyJoinLink}>
            {copiedLink ? "Tautan tersalin" : "Salin tautan join"}
          </button>
          <Link className="button secondary" href={`/display/${roomId}`} target="_blank">
            Buka layar proyektor
          </Link>
        </div>
      </div>
    </div>
  );
}
