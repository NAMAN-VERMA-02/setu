import { describe, expect, it } from "vitest";
import { messageError } from "./types";

describe("messageError", () => {
  it("explains each guard in plain language", () => {
    expect(messageError("you are no longer connected").status).toBe(403);
    expect(messageError("connect first").status).toBe(403);
    expect(messageError("too many messages, slow down").status).toBe(429);
    expect(messageError("not in this conversation").status).toBe(403);
    expect(messageError("anything else").status).toBe(400);
  });
});
