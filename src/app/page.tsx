"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { getSocket } from "@/lib/socket";

export default function HomePage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function joinRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const socket = getSocket();
    const token = localStorage.getItem(`player-token:${code.trim().toUpperCase()}`) ?? undefined;
    socket.emit("room:join", { code, name, avatar, token }, (result) => {
      setBusy(false);
      if (result.error || !result.roomId || !result.playerId || !result.token) return setError(result.error ?? "Gagal bergabung ke room.");
      localStorage.setItem(`player-token:${code.trim().toUpperCase()}`, result.token);
      localStorage.setItem(`player-token-room:${result.roomId}`, result.token);
      localStorage.setItem(`player-id:${result.roomId}`, result.playerId);
      router.push(`/play/${result.roomId}`);
    });
  }

  function createRoom() {
    setBusy(true);
    setError("");
    const socket = getSocket();
    socket.emit("host:create", (result) => {
      setBusy(false);
      if (result.error) return setError(result.error);
      localStorage.setItem(`host-token:${result.roomId}`, result.hostToken);
      localStorage.setItem(`host-id:${result.roomId}`, result.hostId);
      router.push(`/host/room/${result.roomId}`);
    });
  }

  return <main className="shell">
    <header className="topbar">
      <Brand />
      <div className="btn-row">
        <Link className="button secondary" href="/host">Dashboard & Editor Kuis</Link>
        <span className="status-tag">KUIS TIM REAL-TIME</span>
      </div>
    </header>
    <section className="landing">
      <div>
        <span className="eyebrow">Bahasa Arab · Main bareng</span>
        <h1>Angkat kartu.<br />Bela timmu.</h1>
        <p className="lede">Uji nahwu dan mufradat dalam duel cepat. Jawaban benar menyerang lawan, jawaban keliru mengurangi HP tim sendiri.</p>
        <form className="join-panel" onSubmit={joinRoom}>
          <h2 className="panel-title">Masuk ke room</h2>
          <p className="micro">Minta kode 6 karakter dari host untuk mulai bermain.</p>
          <div className="field"><label htmlFor="room-code">Kode room</label><input id="room-code" className="input code" autoComplete="off" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} placeholder="MIS. KARTU7" required /></div>
          <div className="field"><label htmlFor="player-name">Nama panggilan</label><input id="player-name" className="input" autoComplete="nickname" maxLength={20} value={name} onChange={(event) => setName(event.target.value)} placeholder="Nama yang terlihat di tim" required /></div>
          <div className="field"><label htmlFor="player-avatar">Avatar</label><select id="player-avatar" className="input" value={avatar} onChange={(event) => setAvatar(event.target.value)}><option>🦊</option><option>🐼</option><option>🦉</option><option>🐯</option><option>🐸</option><option>🐙</option><option>🦁</option><option>🐨</option></select></div>
          <button className="button full" type="submit" disabled={busy}>{busy ? "Menghubungkan…" : "Gabung room"}</button>
          {error && <p role="alert" className="error">{error}</p>}
        </form>
      </div>
      <div className="proof-board" aria-label="Ilustrasi papan duel kartu">
        <div className="board"><div className="board-head"><span>ARENA KUIS</span><span>RONDE 01</span></div><div className="board-vs"><div className="team-chip">TIM HIJAU<br />♥ 80 HP</div><span className="vs">VS</span><div className="team-chip orange">TIM JINGGA<br />♥ 100 HP</div></div><div className="fake-question">مَا جَمْعُ كِتَابٌ؟</div><div className="fake-cards" aria-hidden="true"><span>A</span><span>B</span><span>C</span><span>D</span><span>E</span></div></div>
        <div className="float-note">Satu kartu bisa ubah duel</div>
      </div>
    </section>
    <section className="section-line">
      <span>Belum punya room? Kelola soal di Dashboard Kuis atau buka room instan:</span>
      <div className="btn-row">
        <Link className="button secondary" href="/host">Kelola Kuis Host</Link>
        <button className="button" type="button" disabled={busy} onClick={createRoom}>{busy ? "Membuat room…" : "Buat room sebagai host"}</button>
      </div>
    </section>
  </main>;
}
