import { afterEach, describe, expect, it, vi } from "vitest";
import { readNames, type ViewerTokens } from "./client";

const viewer = {
  ngit: { url: "http://ngit.test", token: "t1" },
  rce: { url: "http://rce.test", token: "t2" },
} as unknown as ViewerTokens;

afterEach(() => vi.unstubAllGlobals());

const cards = (names: Record<string, string>) =>
  new Response(JSON.stringify({ cards: Object.entries(names).map(([pid, name]) => ({ pid, name })) }));

describe("readNames when a college node is down", () => {
  it("shows no names for the dead node but still resolves the live one", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.startsWith("http://ngit.test")) throw new TypeError("fetch failed"); // connection refused
        return cards({ rce_1: "Asha" });
      }),
    );
    const out = await readNames(viewer, ["ngit_1", "rce_1"]);
    expect(out).toEqual({ rce_1: "Asha" });
  });

  it("treats an error response as no names", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("bad gateway", { status: 502 })));
    expect(await readNames(viewer, ["ngit_1"])).toEqual({});
  });

  it("gives up on a node that never answers after about 4 seconds", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
          }),
      ),
    );
    const started = Date.now();
    const out = await readNames(viewer, ["ngit_1"]);
    const took = Date.now() - started;
    expect(out).toEqual({});
    expect(took).toBeGreaterThanOrEqual(3500);
    expect(took).toBeLessThan(6000);
  }, 10_000);

  it("never asks a node for people it does not own, and skips nodes the viewer has no token for", async () => {
    const fetchMock = vi.fn(async () => cards({ ngit_1: "Ravi" }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await readNames({ ngit: { url: "http://ngit.test", token: "t1" } } as unknown as ViewerTokens, ["ngit_1", "rce_9"]);
    expect(out).toEqual({ ngit_1: "Ravi" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
