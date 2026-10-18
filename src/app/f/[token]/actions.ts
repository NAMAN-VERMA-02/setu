"use server";

import { redirect } from "next/navigation";
import { replyToForward } from "@/lib/asks/forward";
import { replySchema } from "@/lib/validation/asks";

export async function replyAction(token: string, formData: FormData) {
  const parsed = replySchema.safeParse({ note: formData.get("note")?.toString() ?? "" });
  if (parsed.success) await replyToForward(token, parsed.data.note);
  // Re-render the page: it shows the thank-you state, or "link ended" if the reply no longer applies.
  redirect(`/f/${token}`);
}
