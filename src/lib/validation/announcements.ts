import { z } from "zod";

export const announcementSchema = z
  .object({
    kind: z.enum(["announcement", "event"]),
    title: z.string().trim().min(3, "Give it a clear title.").max(120),
    body: z.string().trim().min(1, "Write a few lines.").max(2000),
    eventAt: z.string().datetime({ offset: true }).optional(),
  })
  .refine((v) => v.kind === "event" || !v.eventAt, { message: "Only events have a date.", path: ["eventAt"] })
  .refine((v) => v.kind !== "event" || Boolean(v.eventAt), { message: "Add the date and time of the event.", path: ["eventAt"] });

export type AnnouncementInput = z.infer<typeof announcementSchema>;

export type AnnouncementItem = {
  id: string;
  kind: "announcement" | "event";
  title: string;
  body: string;
  eventAt: string | null;
  createdAt: string;
  mine: boolean;
};
