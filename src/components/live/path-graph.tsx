"use client";

import { COLLEGE_COLOUR } from "@/lib/fed/client";

export type GraphPerson = { pid: string; node: string; role: string; gradYear: number | null; title: string | null; company: string | null };
export type GraphEdge = { a: string; b: string; p: number };
export type HopState = "waiting" | "sent" | "accepted" | "declined" | "cancelled";

type Props = {
  people: GraphPerson[];
  edges: GraphEdge[];
  source: string;
  target: string;
  /** the chosen path, requester first */
  best: string[];
  /** the fewest-hops path, drawn dimmed for comparison */
  shortest?: string[];
  /** state of each hop on the chosen path, keyed "from|to" */
  hops?: Record<string, HopState>;
  names?: Record<string, string>;
  offlineNodes?: string[];
  height?: number;
};

const W = 1000;
const STATE_COLOUR: Record<HopState, string> = { waiting: "#a1a1aa", sent: "#f59e0b", accepted: "#22c55e", declined: "#ef4444", cancelled: "#d4d4d8" };
const key = (a: string, b: string) => `${a}|${b}`;

function shortLabel(p: GraphPerson, name?: string): string {
  if (name) return name.split(" ")[0];
  // a professional has no graduation year: show their role instead ("Cardiologist", "CTO")
  if (p.role === "professional") {
    const words = (p.title ?? "Professional").split(" ");
    let out = words[0];
    for (const w of words.slice(1)) {
      if ((out + " " + w).length > 16) break;
      out += ` ${w}`;
    }
    return out; // "Product Designer", "Full-stack & ML", "Cardiologist"
  }
  const yr = p.gradYear ? ` ’${String(p.gradYear).slice(-2)}` : "";
  return `${p.node.toUpperCase()}${yr}`;
}

/** Layered graph: columns by distance from the requester, the chosen path drawn bold and animated. */
export function PathGraph({ people, edges, source, target, best, shortest = [], hops, names = {}, offlineNodes = [], height = 460 }: Props) {
  // distance from the requester along drawn edges
  const dist = new Map<string, number>([[source, 0]]);
  const queue = [source];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const e of edges) {
      const other = e.a === cur ? e.b : e.b === cur ? e.a : null;
      if (other && !dist.has(other)) {
        dist.set(other, dist.get(cur)! + 1);
        queue.push(other);
      }
    }
  }
  // the best path always defines the columns of its own people
  best.forEach((pid, i) => dist.set(pid, i));
  dist.set(target, Math.max(best.length - 1, dist.get(target) ?? 0));

  const columns = new Map<number, string[]>();
  for (const p of people) {
    const d = dist.get(p.pid) ?? 1;
    columns.set(d, [...(columns.get(d) ?? []), p.pid]);
  }
  const maxCol = Math.max(...columns.keys(), 1);
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, pids] of columns) {
    // path members sit in the middle, extras fan out above and below
    const sorted = [...pids].sort((a, b) => Number(best.includes(b)) - Number(best.includes(a)));
    sorted.forEach((pid, i) => {
      const slot = i === 0 ? 0 : (i % 2 ? 1 : -1) * Math.ceil(i / 2);
      pos.set(pid, { x: 70 + (d / maxCol) * (W - 140), y: height / 2 + slot * 120 });
    });
  }

  const onBest = new Set(best.slice(0, -1).map((a, i) => key(a, best[i + 1])));
  const onShort = new Set(shortest.slice(0, -1).map((a, i) => key(a, shortest[i + 1])));
  const state = (a: string, b: string): HopState | undefined => hops?.[key(a, b)] ?? hops?.[key(b, a)];

  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label="Route graph" className="h-auto w-full">
      {edges.map((e) => {
        const a = pos.get(e.a);
        const b = pos.get(e.b);
        if (!a || !b) return null;
        const hopSt = state(e.a, e.b);
        // a hop with a state (even a declined one) is part of the story and stays highlighted
        const isBest = onBest.has(key(e.a, e.b)) || onBest.has(key(e.b, e.a)) || (hopSt !== undefined && hopSt !== "cancelled");
        const isShort = !isBest && (onShort.has(key(e.a, e.b)) || onShort.has(key(e.b, e.a)));
        const st = isBest ? (hopSt ?? "waiting") : undefined;
        const colour = isBest ? (hops ? STATE_COLOUR[st!] : "var(--ink)") : "var(--muted)";
        return (
          <g key={key(e.a, e.b)}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={colour}
              strokeWidth={isBest ? 6 : isShort ? 3 : 1.5}
              strokeDasharray={isShort ? "8 8" : isBest && st === "sent" ? "14 10" : undefined}
              opacity={isBest ? 1 : isShort ? 0.7 : 0.35}
              className={isBest ? "route-link" : undefined}
              pathLength={isBest ? 1 : undefined}
            />
            {(isBest || isShort) && (
              // the comparison path's label sits nearer its start so it never lands on another person's name
              <text x={a.x + (b.x - a.x) * (isBest ? 0.5 : 0.3)} y={a.y + (b.y - a.y) * (isBest ? 0.5 : 0.3) - 10} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink)" paintOrder="stroke" stroke="var(--paper)" strokeWidth="5">
                {Math.round(e.p * 100)}%
              </text>
            )}
            {st === "declined" && (
              <text x={(a.x + b.x) / 2} y={(a.y + b.y) / 2 + 26} textAnchor="middle" fontSize="28" fontWeight="900" fill="#ef4444">
                ✕
              </text>
            )}
          </g>
        );
      })}

      {people.map((p) => {
        const at = pos.get(p.pid);
        if (!at) return null;
        const offline = offlineNodes.includes(p.node);
        const acceptedHere = best.some((b, i) => i > 0 && b === p.pid && state(best[i - 1], b) === "accepted");
        const isSource = p.pid === source;
        const ring = offline ? "#a1a1aa" : COLLEGE_COLOUR[p.node] ?? "var(--ink)";
        return (
          <g key={p.pid} opacity={offline ? 0.45 : 1}>
            {acceptedHere && <circle cx={at.x} cy={at.y} r={40} fill="none" stroke="#22c55e" strokeWidth="3" opacity="0.5" />}
            <circle cx={at.x} cy={at.y} r={30} fill="var(--surface)" stroke={ring} strokeWidth={best.includes(p.pid) ? 6 : 3} />
            <text x={at.x} y={at.y + 8} textAnchor="middle" fontSize="22" fontWeight="900" fill="var(--ink)">
              {isSource ? "YOU" : p.pid === target ? "★" : acceptedHere ? "✓" : p.role === "alum" ? "A" : p.role === "professional" ? "P" : "S"}
            </text>
            <text x={at.x} y={at.y + 56} textAnchor="middle" fontSize="20" fontWeight="700" fill="var(--ink)">
              {shortLabel(p, names[p.pid])}
            </text>
            <text x={at.x} y={at.y + 78} textAnchor="middle" fontSize="16" fill="var(--muted)">
              {p.company ?? (p.role === "student" ? "student" : "")}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
