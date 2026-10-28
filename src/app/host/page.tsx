"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { getSocket } from "@/lib/socket";
import type { Quiz } from "@/lib/game";

export default function HostDashboardPage() {
  const router = useRouter();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [hostName, setHostName] = useState("Ustadz / Host");
  const [loading, setLoading] = useState(true);
  const [busyQuizId, setBusyQuizId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const savedName = localStorage.getItem("host-profile-name");
    if (savedName) setHostName(savedName);
    loadQuizzes();
  }, []);

  async function loadQuizzes() {
    setLoading(true);
    try {
      const response = await fetch("/api/quizzes");
      const data = await response.json();
      if (Array.isArray(data.quizzes)) setQuizzes(data.quizzes);
    } catch {
      setError("Gagal memuat daftar kuis.");
    } finally {
      setLoading(false);
    }
  }

  function handleNameChange(value: string) {
    setHostName(value);
    localStorage.setItem("host-profile-name", value);
  }

  function openRoomWithQuiz(quizId: string) {
    setBusyQuizId(quizId);
    setError("");
    const socket = getSocket();
    socket.emit("host:create", { quizId }, (result) => {
      setBusyQuizId(null);
      if (result.error) return setError(result.error);
      localStorage.setItem(`host-token:${result.roomId}`, result.hostToken);
      localStorage.setItem(`host-id:${result.roomId}`, result.hostId);
      router.push(`/host/room/${result.roomId}`);
    });
  }

  async function handleDelete(id: string, title: string) {
    if (!window.confirm(`Hapus kuis "${title}"?`)) return;
    setError("");
    const response = await fetch(`/api/quizzes/${id}`, { method: "DELETE" });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error ?? "Gagal menghapus kuis.");
      return;
    }
    await loadQuizzes();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Brand />
        <div className="btn-row">
          <Link className="button secondary" href="/">Beranda</Link>
          <Link className="button" href="/host/quiz/new">Buat kuis baru</Link>
        </div>
      </header>

      <div className="page-heading">
        <div>
          <span className="eyebrow">Dashboard Host</span>
          <h1>Bank Kuis & Turnamen</h1>
          <p className="micro">Kelola paket soal Nahwu/Shorof, atur kunci jawaban A–E, lalu buka room turnamen kapan saja.</p>
        </div>
        <div className="host-profile-box">
          <label htmlFor="host-name" className="micro">Nama Host / Pengajar</label>
          <input
            id="host-name"
            className="input"
            style={{ minHeight: 40 }}
            value={hostName}
            onChange={(event) => handleNameChange(event.target.value)}
            placeholder="Nama Host"
          />
        </div>
      </div>

      {error && <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p>}

      {loading ? (
        <div className="panel"><p>Memuat daftar kuis…</p></div>
      ) : (
        <div className="quiz-card-grid">
          {quizzes.map((quiz) => (
            <article className="panel quiz-card" key={quiz.id}>
              <div>
                <div className="quiz-card-top">
                  <span className="badge-pill">{quiz.category || "Nahwu"}</span>
                  <small className="micro">{quiz.questions.length} Soal</small>
                </div>
                <h2 style={{ marginTop: 10 }}>{quiz.title}</h2>
                <p className="panel-sub">{quiz.description || "Tanpa deskripsi."}</p>
              </div>
              <div className="btn-row" style={{ marginTop: 14 }}>
                <button
                  type="button"
                  className="button"
                  disabled={busyQuizId === quiz.id}
                  onClick={() => openRoomWithQuiz(quiz.id)}
                >
                  {busyQuizId === quiz.id ? "Membuka…" : "Buka room"}
                </button>
                <Link className="button secondary" href={`/host/quiz/${quiz.id}`}>
                  Edit soal
                </Link>
                {quizzes.length > 1 && (
                  <button
                    type="button"
                    className="button danger"
                    onClick={() => handleDelete(quiz.id, quiz.title)}
                  >
                    Hapus
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
