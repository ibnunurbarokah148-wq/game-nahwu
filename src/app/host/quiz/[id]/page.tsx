"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { CARD_LETTERS, type QuizQuestion } from "@/lib/game";
import { getSocket } from "@/lib/socket";

function createBlankQuestion(index: number): QuizQuestion {
  return {
    id: `q-${Date.now()}-${index}`,
    text: "",
    options: ["", "", "", "", ""],
    correctIndex: 0,
    multiplier: 1,
    category: "Nahwu",
  };
}

export default function QuizEditorPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === "new";
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Nahwu Dasar");
  const [description, setDescription] = useState("");
  const [questions, setQuestions] = useState<QuizQuestion[]>([createBlankQuestion(1)]);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (isNew) return;
    setLoading(true);
    fetch(`/api/quizzes/${id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.quiz) {
          setTitle(data.quiz.title);
          setCategory(data.quiz.category ?? "Nahwu");
          setDescription(data.quiz.description ?? "");
          setQuestions(data.quiz.questions);
        } else {
          setError(data.error ?? "Kuis tidak ditemukan.");
        }
      })
      .catch(() => setError("Gagal memuat data kuis."))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  function updateQuestion(index: number, patch: Partial<QuizQuestion>) {
    setQuestions((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  }

  function updateOption(questionIndex: number, optionIndex: number, value: string) {
    setQuestions((prev) =>
      prev.map((item, idx) => {
        if (idx !== questionIndex) return item;
        const nextOptions = [...item.options] as [string, string, string, string, string];
        nextOptions[optionIndex] = value;
        return { ...item, options: nextOptions };
      })
    );
  }

  function addQuestion() {
    setQuestions((prev) => [...prev, createBlankQuestion(prev.length + 1)]);
  }

  function removeQuestion(index: number) {
    if (questions.length <= 1) return;
    setQuestions((prev) => prev.filter((_, idx) => idx !== index));
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= questions.length) return;
    setQuestions((prev) => {
      const copy = [...prev];
      [copy[index], copy[target]] = [copy[target], copy[index]];
      return copy;
    });
  }

  async function saveQuiz(openRoomAfter = false) {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/quizzes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: isNew ? undefined : id,
          title,
          category,
          description,
          questions,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.quiz) {
        setError(data.error ?? "Gagal menyimpan kuis. Pastikan semua kolom soal & 5 opsi A–E terisi.");
        setSaving(false);
        return;
      }

      if (openRoomAfter) {
        const socket = getSocket();
        socket.emit("host:create", { quizId: data.quiz.id }, (result) => {
          setSaving(false);
          if (result.error) return setError(result.error);
          localStorage.setItem(`host-token:${result.roomId}`, result.hostToken);
          localStorage.setItem(`host-id:${result.roomId}`, result.hostId);
          router.push(`/host/room/${result.roomId}`);
        });
        return;
      }

      setSaving(false);
      setNotice("Kuis berhasil disimpan!");
      if (isNew) {
        router.replace(`/host/quiz/${data.quiz.id}`);
      }
    } catch {
      setSaving(false);
      setError("Terjadi kesalahan saat menyimpan kuis.");
    }
  }

  if (loading) {
    return (
      <main className="shell">
        <header className="topbar"><Brand /></header>
        <div className="panel"><p>Memuat editor kuis…</p></div>
      </main>
    );
  }

  return (
    <main className="shell">
      <header className="topbar">
        <Brand />
        <div className="btn-row">
          <Link className="button secondary" href="/host">Kembali ke dashboard</Link>
          <button type="button" className="button secondary" disabled={saving} onClick={() => saveQuiz(false)}>
            {saving ? "Menyimpan…" : "Simpan kuis"}
          </button>
          <button type="button" className="button" disabled={saving} onClick={() => saveQuiz(true)}>
            Simpan dan buka room
          </button>
        </div>
      </header>

      <div className="page-heading">
        <div>
          <span className="eyebrow">{isNew ? "Kuis Baru" : `Editor Kuis · ${id}`}</span>
          <h1>{title || "Buat Kuis Tim Kartu"}</h1>
          <p className="micro">Setiap soal wajib memiliki 5 pilihan jawaban (Kartu A sampai E) dan 1 jawaban benar.</p>
        </div>
      </div>

      {error && <p className="error" role="alert" style={{ marginBottom: 16 }}>{error}</p>}
      {notice && <div className="feedback" role="status" style={{ marginBottom: 16 }}>{notice}</div>}

      <section className="panel" style={{ marginBottom: 20 }}>
        <h2>Informasi Kuis</h2>
        <div className="settings">
          <div className="field">
            <label htmlFor="quiz-title">Judul Kuis</label>
            <input
              id="quiz-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Contoh: Bab I'rab & Marfu'atul Asma"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="quiz-cat">Kategori</label>
            <input
              id="quiz-cat"
              className="input"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              placeholder="Contoh: Nahwu Lanjutan"
            />
          </div>
        </div>
        <div className="field" style={{ marginBottom: 0 }}>
          <label htmlFor="quiz-desc">Deskripsi Singkat</label>
          <input
            id="quiz-desc"
            className="input"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Penjelasan singkat materi yang diujikan"
          />
        </div>
      </section>

      <div className="question-editor-list">
        {questions.map((question, qIndex) => (
          <section className="panel question-editor-card" key={question.id}>
            <div className="question-editor-head">
              <strong>Soal #{qIndex + 1}</strong>
              <div className="btn-row">
                <select
                  className="input"
                  style={{ minHeight: 36, width: "auto" }}
                  value={question.multiplier}
                  onChange={(event) => updateQuestion(qIndex, { multiplier: Number(event.target.value) })}
                  aria-label="Pengali damage soal"
                >
                  <option value={1}>1x Damage (Normal)</option>
                  <option value={1.5}>1.5x Damage (Sulit)</option>
                  <option value={2}>2x Damage (Boss)</option>
                </select>
                <button
                  type="button"
                  className="button secondary"
                  style={{ minHeight: 36, padding: "0 10px" }}
                  disabled={qIndex === 0}
                  onClick={() => moveQuestion(qIndex, -1)}
                  title="Pindah ke atas"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="button secondary"
                  style={{ minHeight: 36, padding: "0 10px" }}
                  disabled={qIndex === questions.length - 1}
                  onClick={() => moveQuestion(qIndex, 1)}
                  title="Pindah ke bawah"
                >
                  ↓
                </button>
                {questions.length > 1 && (
                  <button
                    type="button"
                    className="button danger"
                    style={{ minHeight: 36, padding: "0 12px" }}
                    onClick={() => removeQuestion(qIndex)}
                  >
                    Hapus
                  </button>
                )}
              </div>
            </div>

            <div className="field">
              <label>Pertanyaan (mendukung teks Arab / Indonesia)</label>
              <input
                className="input"
                dir="auto"
                value={question.text}
                onChange={(event) => updateQuestion(qIndex, { text: event.target.value })}
                placeholder="Ketik pertanyaan di sini…"
              />
            </div>

            <div className="options-editor-grid">
              {CARD_LETTERS.map((letter, optIndex) => {
                const isCorrect = question.correctIndex === optIndex;
                return (
                  <div className={`option-editor-item ${isCorrect ? "correct" : ""}`} key={letter}>
                    <div className="option-editor-top">
                      <span className="answer-letter">{letter}</span>
                      <button
                        type="button"
                        className={`correct-toggle ${isCorrect ? "active" : ""}`}
                        onClick={() => updateQuestion(qIndex, { correctIndex: optIndex })}
                      >
                        {isCorrect ? "✓ Kunci Jawaban Benar" : "Jadikan Jawaban Benar"}
                      </button>
                    </div>
                    <input
                      className="input"
                      dir="auto"
                      value={question.options[optIndex]}
                      onChange={(event) => updateOption(qIndex, optIndex, event.target.value)}
                      placeholder={`Pilihan jawaban kartu ${letter}`}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className="btn-row" style={{ marginTop: 20, justifyContent: "space-between" }}>
        <button type="button" className="button secondary" onClick={addQuestion}>
          Tambah soal baru
        </button>
        <div className="btn-row">
          <button type="button" className="button secondary" disabled={saving} onClick={() => saveQuiz(false)}>
            {saving ? "Menyimpan…" : "Simpan kuis"}
          </button>
          <button type="button" className="button" disabled={saving} onClick={() => saveQuiz(true)}>
            Simpan dan buka room
          </button>
        </div>
      </div>
    </main>
  );
}
