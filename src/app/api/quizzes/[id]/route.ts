import { NextResponse } from "next/server";
import { deleteQuizById, getQuizById } from "@/lib/quiz-store";

export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const quiz = getQuizById(id);
  if (!quiz || quiz.id !== id) {
    return NextResponse.json({ error: "Kuis tidak ditemukan." }, { status: 404 });
  }
  return NextResponse.json({ quiz });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const deleted = deleteQuizById(id);
  if (!deleted) {
    return NextResponse.json(
      { error: "Kuis tidak dapat dihapus (minimal 1 kuis harus tersisa)." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true });
}
