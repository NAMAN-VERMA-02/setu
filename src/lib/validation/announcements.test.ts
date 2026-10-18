import { describe, expect, it } from "vitest";
import { announcementSchema } from "./announcements";

describe("announcementSchema", () => {
  it("accepts a plain announcement and an event with a date", () => {
    expect(announcementSchema.safeParse({ kind: "announcement", title: "Placement drive", body: "Details soon." }).success).toBe(true);
    expect(announcementSchema.safeParse({ kind: "event", title: "Alumni meet", body: "Join us", eventAt: "2026-11-02T10:00:00+05:30" }).success).toBe(true);
  });
  it("needs a date for events and none for announcements", () => {
    expect(announcementSchema.safeParse({ kind: "event", title: "Alumni meet", body: "Join us" }).success).toBe(false);
    expect(announcementSchema.safeParse({ kind: "announcement", title: "Placement drive", body: "x", eventAt: "2026-11-02T10:00:00Z" }).success).toBe(false);
  });
  it("rejects short titles and empty bodies", () => {
    expect(announcementSchema.safeParse({ kind: "announcement", title: "Hi", body: "x" }).success).toBe(false);
    expect(announcementSchema.safeParse({ kind: "announcement", title: "Hello there", body: " " }).success).toBe(false);
  });
});
