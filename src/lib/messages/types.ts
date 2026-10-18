export type ThreadItem = {
  id: string;
  other: { id: string; name: string; role: string; headline: string | null };
  preview: string | null;
  lastMessageAt: string;
  unread: boolean;
};

export type MessageItem = { id: string; senderId: string; body: string; createdAt: string };

/** Turns a database error from the message guard into something a person can act on. */
export function messageError(message: string): { error: string; status: number } {
  if (/no longer connected|connect first/.test(message)) return { error: "You can only message people you are connected to.", status: 403 };
  if (/too many messages/.test(message)) return { error: "You are sending a lot. Give it a minute.", status: 429 };
  if (/not in this conversation/.test(message)) return { error: "That conversation is not yours.", status: 403 };
  return { error: "We could not send that. Please try again.", status: 400 };
}
