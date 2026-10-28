import { NextResponse } from "next/server";
import { z } from "zod";
import { listQuizzes, upsertQuiz } from "@/lib/quiz-store";

const questionSchema = z.object({
  id: z.string().optional(),
  text: z.string().trim().min(1, "Teks soal wajib diisi"),
  options: z.tuple([
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
    z.string().trim().min(1),
  ]),
  correctIndex: z.number().int().min(0).max(4),
  multiplier: z.number().min(0.5).max(5),
  category: z.string().optional(),
});

const quizSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(2, "Judul kuis minimal 2 karakter"),
  description: z.string().trim().default(""),
  category: z.string().trim().default("Nahwu"),
  questions: z.array(questionSchema).min(1, "Minimal 1 soal diperlukan"),
});

export async function GET() {
  return NextResponse.json({ quizzes: listQuizzes() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = quizSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Data kuis tidak valid." },
        { status: 400 }
      );
    }
    const saved = upsertQuiz(parsed.data);
    return NextResponse.json({ quiz: saved });
  } catch {
    return NextResponse.json({ error: "Gagal menyimpan kuis." }, { status: 500 });
  }
}
