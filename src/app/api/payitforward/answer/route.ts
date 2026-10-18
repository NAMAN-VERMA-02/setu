import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { answerSchema } from "@/lib/validation/payforward";

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

const RULES: { match: string; status: number; message: string }[] = [
  { match: "no help owed", status: 409, message: "You have no answers left to give right now." },
  { match: "not a junior", status: 422, message: "You can only help juniors from your college." },
  { match: "no open question", status: 409, message: "That student has no open question." },
  { match: "helps_one_per_pair", status: 409, message: "You have already answered this student." },
];

/** Answer one junior's open question. Each answer uses up one of the three owed. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("Send a JSON body.", 400);
  }
  const parsed = answerSchema.safeParse(body);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your answer.", 400);

  const { error } = await supabase.rpc("answer_question", {
    p_junior: parsed.data.juniorId,
    p_answer: parsed.data.answer,
  });
  if (error) {
    const hit = RULES.find((r) => error.message.includes(r.match));
    return hit ? fail(hit.message, hit.status) : fail("We could not save your answer. Please try again.", 400);
  }
  return NextResponse.json({ ok: true }, { status: 201 });
}
