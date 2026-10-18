export type NotificationKind = "connection_request" | "connection_accepted" | "ask" | "interest" | "vouch" | "announcement";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  link: string | null;
  createdAt: string;
  read: boolean;
};

export const KIND_LABELS: Record<NotificationKind, string> = {
  connection_request: "Connection",
  connection_accepted: "Connection",
  ask: "Request",
  interest: "Opportunity",
  vouch: "Vouch",
  announcement: "College",
};

/** Links are always on this site; anything else is dropped so a notification cannot lead elsewhere. */
export function safeLink(link: string | null): string | null {
  return link && /^\/[A-Za-z0-9/_-]*$/.test(link) ? link : null;
}
