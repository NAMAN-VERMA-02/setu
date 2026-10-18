import { NextResponse, type NextRequest } from "next/server";
import { extractFromPdf } from "@/lib/llm/extract";
import { readLlmConfig } from "@/lib/llm/config";
import { createClient } from "@/lib/supabase/server";
import { SYSTEM_PROMPT, calendarNote, modelOutputSchema, normalizeDraft } from "@/lib/llm/journey";

export const maxDuration = 60;

const MAX_BYTES = 5 * 1024 * 1024;
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

// Best-effort per-instance limiter. A shared (database-backed) limit comes with the rate-limit work.
const recent = new Map<string, number[]>();
function allowed(userId: string): boolean {
  const now = Date.now();
  const hits = (recent.get(userId) ?? []).filter((t) => now - t < WINDOW_MS);
  if (hits.length >= MAX_PER_WINDOW) {
    recent.set(userId, hits);
    return false;
  }
  hits.push(now);
  recent.set(userId, hits);
  return true;
}

const fail = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Sign in to continue.", 401);

  const config = readLlmConfig();
  if (!config) return fail("PDF import is not configured yet.", 503);

  const { data: profile } = await supabase.from("users").select("batch").eq("id", user.id).single();
  if (!profile) return fail("Finish signing up first.", 403);

  if (!allowed(user.id)) return fail("Too many imports. Try again later.", 429);

  let file: File | null = null;
  try {
    const form = await request.formData();
    const f = form.get("file");
    file = f instanceof File ? f : null;
  } catch {
    return fail("Upload a PDF file.", 400);
  }
  if (!file) return fail("Upload a PDF file.", 400);
  if (file.size === 0 || file.size > MAX_BYTES) return fail("The PDF must be under 5 MB.", 413);

  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    return fail("That file is not a PDF.", 415);
  }

  // The PDF is processed in memory and never stored.
  const result = await extractFromPdf({
    config,
    system: SYSTEM_PROMPT,
    pdf: bytes,
    text: calendarNote(profile.batch),
    schema: modelOutputSchema,
  });

  if (result.ok) return NextResponse.json({ draft: normalizeDraft(result.data) });
  if (result.reason === "unavailable") return fail("Import failed. Fill the form by hand instead.", 502);
  return fail("We could not read that PDF. Fill the form by hand instead.", 422);
}
