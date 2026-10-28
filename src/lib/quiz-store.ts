import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Quiz, QuizQuestion } from "./game";
import { SEED_QUIZZES } from "./quiz";

const DATA_FILE = join(process.cwd(), "data", "quizzes.json");

function ensureStore(): Quiz[] {
  try {
    if (!existsSync(DATA_FILE)) {
      mkdirSync(dirname(DATA_FILE), { recursive: true });
      writeFileSync(DATA_FILE, JSON.stringify(SEED_QUIZZES, null, 2), "utf8");
      return structuredClone(SEED_QUIZZES);
    }
    const raw = readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Quiz[];
    if (!Array.isArray(parsed) || parsed.length === 0) {
      writeFileSync(DATA_FILE, JSON.stringify(SEED_QUIZZES, null, 2), "utf8");
      return structuredClone(SEED_QUIZZES);
    }
    return parsed;
  } catch {
    return structuredClone(SEED_QUIZZES);
  }
}

function saveStore(quizzes: Quiz[]): void {
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(quizzes, null, 2), "utf8");
}

export function listQuizzes(): Quiz[] {
  return ensureStore();
}

export function getQuizById(id?: string): Quiz {
  const quizzes = ensureStore();
  if (id) {
    const found = quizzes.find((quiz) => quiz.id === id);
    if (found) return found;
  }
  return quizzes[0] ?? SEED_QUIZZES[0];
}

export function upsertQuiz(input: {
  id?: string;
  title: string;
  description: string;
  category: string;
  questions: Omit<QuizQuestion, "id"> & { id?: string } extends infer Q ? Q[] : never;
}): Quiz {
  const quizzes = ensureStore();
  const id = input.id?.trim() || `quiz-${randomUUID().slice(0, 8)}`;
  const normalizedQuestions: QuizQuestion[] = input.questions.map((question, idx) => ({
    id: question.id?.trim() || `q-${idx + 1}-${randomUUID().slice(0, 4)}`,
    text: question.text.trim(),
    options: [
      question.options[0].trim(),
      question.options[1].trim(),
      question.options[2].trim(),
      question.options[3].trim(),
      question.options[4].trim(),
    ],
    correctIndex: Math.min(4, Math.max(0, Number(question.correctIndex) || 0)),
    multiplier: Number(question.multiplier) > 0 ? Number(question.multiplier) : 1,
    category: question.category?.trim() || input.category.trim(),
  }));

  const updated: Quiz = {
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category.trim() || "Nahwu",
    updatedAt: new Date().toISOString(),
    questions: normalizedQuestions,
  };

  const existingIndex = quizzes.findIndex((quiz) => quiz.id === id);
  if (existingIndex >= 0) {
    quizzes[existingIndex] = updated;
  } else {
    quizzes.unshift(updated);
  }
  saveStore(quizzes);
  return updated;
}

export function deleteQuizById(id: string): boolean {
  const quizzes = ensureStore();
  if (quizzes.length <= 1) return false;
  const filtered = quizzes.filter((quiz) => quiz.id !== id);
  if (filtered.length === quizzes.length) return false;
  saveStore(filtered);
  return true;
}
