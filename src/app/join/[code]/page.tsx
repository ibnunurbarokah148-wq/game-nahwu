"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { getSocket } from "@/lib/socket";

const AVATARS = ["🦊", "🐼", "🦉", "🐯", "🐸", "🐙", "🦁", "🐨"];

export default function JoinByCodePage() {
  const { code: rawCode } = useParams<{ code: string }>();
  const router = useRouter();
  const initialCode = (rawCode ?? "").toUpperCase().slice(0, 6);
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("🦊");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function handleJoin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const normalizedCode = code.trim().toUpperCase();
    const socket = getSocket();
    const token = localStorage.getItem(`player-token:${normalizedCode}`) ?? undefined;
    socket.emit("room:join", { code: normalizedCode, name, avatar, token }, (result) => {
      setBusy(false);
      if (result.error || !result.roomId || !result.playerId || !result.token) {
        return setError(result.error ?? "Gagal bergabung ke room.");
      }
      localStorage.setItem(`player-token:${normalizedCode}`, result.token);
      localStorage.setItem(`player-token-room:${result.roomId}`, result.token);
      localStorage.setItem(`player-id:${result.roomId}`, result.playerId);
      router.push(`/play/${result.roomId}`);
    });
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Brand />
        <Link className="status-tag" href="/">← Halaman utama</Link>
      </header>
      <section className="join-standalone">
        <form className="join-panel" onSubmit={handleJoin}>
          <span className="eyebrow">Undangan Room</span>
          <h1 className="panel-title" style={{ fontSize: 30, marginTop: 6 }}>Masuk ke Arena</h1>
          <p className="micro">Isi nama panggilan dan pilih avatar untuk bergabung ke tim.</p>
          <div className="field">
            <label htmlFor="room-code">Kode room</label>
            <input
              id="room-code"
              className="input code"
              autoComplete="off"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="player-name">Nama panggilan</label>
            <input
              id="player-name"
              className="input"
              autoComplete="nickname"
              maxLength={20}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Contoh: Zaid"
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label>Pilih Avatar</label>
            <div className="avatar-picker">
              {AVATARS.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`avatar-option ${avatar === item ? "selected" : ""}`}
                  onClick={() => setAvatar(item)}
                  aria-pressed={avatar === item}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <button className="button full" type="submit" disabled={busy}>
            {busy ? "Menghubungkan…" : "Gabung ke Room"}
          </button>
          {error && <p role="alert" className="error">{error}</p>}
        </form>
      </section>
    </main>
  );
}
