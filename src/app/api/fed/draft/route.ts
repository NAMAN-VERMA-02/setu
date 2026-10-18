import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import Anthropic from "@anthropic-ai/sdk";
import { fedLlmConfig } from "@/lib/fed/llm";
import { fail, getSession, loadDirectory, ok } from "@/lib/fed/server";
import { DOMAIN_LABEL } from "@/lib/fed/taxonomy";

const body = z.object({ target: z.string().min(3) });

const fallbackStudent = (title: string, company: string) =>
  `Hi,\n\nI’m a student at a college where someone with a path like yours once stood in my shoes. I’m aiming for a role like yours at ${company} (${title}). Could you spare 15 minutes to tell me what you wish you had known at my stage?\n\nThank you for considering it.\n{myName}`;

const fallbackProfessional = (me: string, title: string, company: string) =>
  `Hi,\n\nI work as ${me}. I’m looking for someone with your experience (${title}, ${company}) for a project in my field. Could we talk for 15 minutes so I can explain what I need and hear whether it is something you would enjoy?\n\nThank you for considering it.\n{myName}`;

const TIMEOUT_MS = 8000;

/**
 * Drafts the intro message. The prompt holds pseudonymous facts only (the target's public title and company,
 * the requester's college). `{myName}` is filled in on the requester's own device from their college's server,
 * so no name ever reaches the model or the hub. Falls back to a template after 8 seconds or on any error.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return fail("Pick a persona or join first.", 401);
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return fail("Pick someone to reach.", 400);
  const dir = await loadDirectory();
  const target = dir.get(parsed.data.target);
  if (!target) return fail("Unknown person.", 404);
  const title = target.public_title ?? "your role";
  const company = target.public_company ?? "your company";

  // Only public job-card facts go into the prompt (never the sender's private words).
  const sender = dir.get(session.pid);
  const professional = sender?.role === "professional";
  const me = professional ? `a ${sender?.public_title ?? "professional"} in ${DOMAIN_LABEL[sender?.branch_code ?? ""] ?? "my field"}`.toLowerCase().replace(/^a ([aeiou])/, "an $1") : "";

  const prompt = professional
    ? `Write a warm, respectful intro request of 60 to 80 words from ${me} to a ${title} at ${company}.
The sender is looking for someone with the recipient's experience for a project in their own field. Say that in general terms: do not invent project details, names, numbers or results.
Rules: one clear ask (a 15-minute call). No flattery. Start with "Hi," and end with the placeholder {myName} on its own line as the signature. Output only the message.`
    : `Write a warm, respectful intro request of 60 to 80 words from a student to a senior.
Facts you may use: the senior is a ${title} at ${company}. The student studies at ${session.node.toUpperCase()} and is currently where the senior once was.
Rules: one clear ask (15 minutes or one question). No flattery. Do not invent facts, names or numbers. Start with "Hi," and end with the placeholder {myName} on its own line as the signature. Output only the message.`;

  const config = fedLlmConfig();
  if (config) {
    try {
      const work =
        config.provider === "anthropic"
          ? new Anthropic({ apiKey: config.apiKey })
              .messages.create({ model: config.model, max_tokens: 300, messages: [{ role: "user", content: prompt }] })
              .then((r) => r.content.map((b) => (b.type === "text" ? b.text : "")).join(""))
          : new GoogleGenAI({ apiKey: config.apiKey }).models.generateContent({ model: config.model, contents: prompt, config: { maxOutputTokens: 300 } }).then((r) => r.text ?? "");
      const text = (await Promise.race([work, new Promise<string>((_, rej) => setTimeout(() => rej(new Error("timeout")), TIMEOUT_MS))])).trim();
      if (text.length > 40 && text.includes("{myName}")) return ok({ draft: text });
      if (text.length > 40) return ok({ draft: `${text}\n{myName}` });
    } catch {
      // use the template
    }
  }
  return ok({ draft: professional ? fallbackProfessional(me, title, company) : fallbackStudent(title, company), fallback: true });
}
