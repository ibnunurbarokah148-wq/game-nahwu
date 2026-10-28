"use client";

import Link from "next/link";
import { useState } from "react";
import type { AnswerFeedback, BracketRound, LeaderboardEntry, Player, Team } from "@/lib/game";

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
  return (
    <div className="hp-track" role="progressbar" aria-valuenow={hp} aria-valuemin={0} aria-valuemax={maxHp}>
      <span
        style={{
          width: `${pct}%`,
          background: variant === "orange" ? "#b85b37" : "var(--green)",
          marginLeft: variant === "orange" ? "auto" : undefined,
        }}
      />
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
  return (
    <div className={`feedback ${feedback.correct ? "" : "wrong"}`} role="status" style={{ marginTop: 14 }}>
      <strong>{feedback.playerName}</strong> mengangkat kartu <b>{feedback.card}</b> ·{" "}
      {feedback.correct
        ? `${feedback.damage} damage ke ${targetName}.`
        : `Kurang tepat. ${targetName} kehilangan ${feedback.damage} HP.`}
      {typeof feedback.responseMs === "number" && (
        <span className="micro"> ({(feedback.responseMs / 1000).toFixed(1)} dtk)</span>
      )}
    </div>
  );
}

export function TeamPanel({
  teams,
  players,
  championTeamId,
  highlightTeamId,
  selfPlayerId,
}: {
  teams: Team[];
  players: Player[];
  championTeamId?: string;
  highlightTeamId?: string;
  selfPlayerId?: string;
}) {
  if (teams.length === 0) return null;
  return (
    <div className="team-columns">
      {teams.map((team) => {
        const isChampion = championTeamId === team.id;
        const isMine = highlightTeamId === team.id;
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
              </span>
            </h3>
            {team.playerIds.map((playerId) => {
              const player = players.find((item) => item.id === playerId);
              if (!player) return null;
              const isSelf = player.id === selfPlayerId;
              return (
                <div className={`team-player ${isSelf ? "self-player" : ""}`} key={playerId}>
                  <span className="avatar">{player.avatar}</span>
                  <span className="player-meta">
                    <strong>
                      {player.name} {isSelf && <span className="self-tag">Kamu</span>}
                    </strong>
                    {!player.connected && <small>Terputus sementara · kartu dioper ke tim</small>}
                  </span>
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
}: {
  bracket?: BracketRound[];
  teams: Team[];
  maxHp: number;
  championTeamId?: string;
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
                <div className="bracket-match-card" key={match.id}>
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
                    {match.winnerTeamId && <span>PEMENANG: {teamName(match.winnerTeamId)}</span>}
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

  async function copyJoinLink() {
    const url = typeof window !== "undefined" ? `${window.location.origin}${joinPath}` : joinPath;
    await navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1600);
  }

  const cells = Array.from({ length: 81 }, (_, idx) => {
    const row = Math.floor(idx / 9);
    const col = idx % 9;
    const isCorner = (row < 3 && col < 3) || (row < 3 && col > 5) || (row > 5 && col < 3);
    if (isCorner) return true;
    const charCode = code.charCodeAt((row * 9 + col) % code.length) || 65;
    return ((charCode + row * 7 + col * 13) % 3) !== 0;
  });

  return (
    <div className="panel join-share-box">
      <div className="qr-badge" aria-label={`Kode visual room ${code}`}>
        <div className="qr-grid">
          {cells.map((filled, idx) => (
            <span key={idx} className={filled ? "qr-dot on" : "qr-dot"} />
          ))}
        </div>
        <small className="micro">{joinPath}</small>
      </div>
      <div className="join-share-actions">
        <span className="eyebrow">Kode Masuk Room</span>
        <div className="big-code" style={{ margin: "4px 0 6px" }}>{code}</div>
        <p className="micro" style={{ marginBottom: 14 }}>
          Masukkan kode 6 karakter di halaman utama atau bagikan tautan langsung kepada pemain.
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
