import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, stateless tokens for the Live Network. The hub stores none of them.
 *  - session cookie: who this browser is ({pid, node}), signed with HUB_SESSION_SECRET
 *  - viewer token: lets a browser read names straight from one college node, signed with that node's secret
 *  - hop token: the link a person opens to say yes or no to one hop, signed with HOP_TOKEN_SECRET
 */

const b64 = (s: string | Buffer) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString("utf8");

function mac(secret: string, data: string): Buffer {
  return createHmac("sha256", secret).update(data).digest();
}

function equal(a: Buffer, b: Buffer): boolean {
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(secret: string, payload: string): string {
  return `${payload}.${b64(mac(secret, payload))}`;
}

function open(secret: string, token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  let given: Buffer;
  try {
    given = Buffer.from(token.slice(dot + 1), "base64url");
  } catch {
    return null;
  }
  return equal(mac(secret, payload), given) ? payload : null;
}

// ---- session -------------------------------------------------------------------------------

export const SESSION_COOKIE = "setu_fed";
export type FedSession = { pid: string; node: string };

export function signSession(secret: string, s: FedSession): string {
  return sign(secret, b64(JSON.stringify(s)));
}

export function verifySession(secret: string, token: string | undefined | null): FedSession | null {
  if (!token) return null;
  const payload = open(secret, token);
  if (!payload) return null;
  try {
    const s = JSON.parse(unb64(payload)) as FedSession;
    return typeof s.pid === "string" && typeof s.node === "string" ? s : null;
  } catch {
    return null;
  }
}

// ---- viewer token --------------------------------------------------------------------------

export const VIEWER_TTL_SECONDS = 2 * 60 * 60;

export function mintViewerToken(secret: string, pid: string, now = Date.now(), ttl = VIEWER_TTL_SECONDS): string {
  return sign(secret, b64(JSON.stringify({ pid, exp: Math.floor(now / 1000) + ttl })));
}

export function verifyViewerToken(secret: string, token: string, now = Date.now()): { pid: string } | null {
  const payload = open(secret, token);
  if (!payload) return null;
  try {
    const v = JSON.parse(unb64(payload)) as { pid: string; exp: number };
    return typeof v.pid === "string" && v.exp > Math.floor(now / 1000) ? { pid: v.pid } : null;
  } catch {
    return null;
  }
}

// ---- hop token -----------------------------------------------------------------------------

const HOP_MAC_LENGTH = 22;

export function hopToken(secret: string, hopId: string): string {
  return `${b64(hopId)}.${b64(mac(secret, hopId)).slice(0, HOP_MAC_LENGTH)}`;
}

export function verifyHopToken(secret: string, token: string): string | null {
  const dot = token.indexOf(".");
  if (dot < 1) return null;
  let hopId: string;
  try {
    hopId = unb64(token.slice(0, dot));
  } catch {
    return null;
  }
  const expected = Buffer.from(b64(mac(secret, hopId)).slice(0, HOP_MAC_LENGTH));
  const given = Buffer.from(token.slice(dot + 1));
  return equal(expected, given) ? hopId : null;
}

export function hopUrl(siteUrl: string, secret: string, hopId: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/h/${hopToken(secret, hopId)}`;
}
