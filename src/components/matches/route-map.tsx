import { hierarchy, tree } from "d3-hierarchy";
import { linkHorizontal } from "d3-shape";
import type { RouteMapData } from "@/lib/scoring/routes";

type Datum = { name: string; count: number; kind: "root" | "route" | "place"; decision?: string };

const COLORS: Record<string, string> = {
  job: "var(--blue)",
  gate: "var(--yellow)",
  startup: "var(--red-tile)",
  higher_studies: "var(--sage)",
  other: "var(--stone)",
};

const W = 760;
const ROW = 40;
const PAD_Y = 24;
const COL = [96, 330, 600]; // x of root, route, place columns
const MIN_STROKE = 3;
const MAX_STROKE = 26;

/**
 * Branching map of what the matched seniors did next. D3 does the layout maths;
 * React renders the SVG, so nothing touches the DOM directly.
 */
export function RouteMap({ data, semester }: { data: RouteMapData; semester: number }) {
  if (data.total === 0 || data.branches.length === 0) return null;

  const root = hierarchy<Datum>({
    name: `You, semester ${semester}`,
    count: data.total,
    kind: "root",
    children: data.branches.map((b) => ({
      name: b.label,
      count: b.count,
      kind: "route" as const,
      decision: b.decision,
      children: b.destinations.map((d) => ({ name: d.label, count: d.count, kind: "place" as const, decision: b.decision })),
    })),
  } as Datum & { children: Datum[] });

  const leaves = root.leaves().length;
  const H = leaves * ROW + PAD_Y * 2;
  // tree() lays out depth along x and breadth along y; we use y for rows.
  const laid = tree<Datum>().size([H - PAD_Y * 2, 1])(root);
  const pos = (n: { depth: number; x: number }) => ({ x: COL[n.depth], y: n.x + PAD_Y });

  const stroke = (count: number) =>
    Math.max(MIN_STROKE, Math.min(MAX_STROKE, (count / data.total) * MAX_STROKE * 1.6));

  const link = linkHorizontal<{ source: [number, number]; target: [number, number] }, [number, number]>()
    .source((d) => d.source)
    .target((d) => d.target);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true" focusable="false">
      {laid.links().map((l, i) => {
        const s = pos(l.source);
        const t = pos(l.target);
        return (
          <path
            key={i}
            d={link({ source: [s.x + (l.source.depth === 0 ? 8 : 70), s.y], target: [t.x - 8, t.y] }) ?? ""}
            className="route-link"
            fill="none"
            stroke={COLORS[l.target.data.decision ?? "other"]}
            strokeOpacity={0.9}
            strokeWidth={stroke(l.target.data.count)}
            strokeLinecap="round"
            pathLength={1}
            style={{ animationDelay: `${l.target.depth * 0.25 + i * 0.04}s` }}
          />
        );
      })}

      {laid.descendants().map((n, i) => {
        const { x, y } = pos(n);
        if (n.data.kind === "root") {
          return (
            <g key={i}>
              <circle cx={x} cy={y} r={9} fill="var(--ink)" />
              <text x={x - 16} y={y + 4} textAnchor="end" className="fill-[var(--ink)] text-[15px] font-bold">
                You
              </text>
              <text x={x - 16} y={y + 22} textAnchor="end" className="fill-[var(--muted)] text-[12px]">
                semester {semester}
              </text>
            </g>
          );
        }
        if (n.data.kind === "route") {
          return (
            <g key={i}>
              <rect x={x - 8} y={y - 15} width={146} height={30} rx={15} fill={COLORS[n.data.decision ?? "other"]} />
              <text x={x + 4} y={y + 5} className="fill-[var(--ink)] text-[13px] font-bold">
                {n.data.count} · {n.data.name}
              </text>
            </g>
          );
        }
        return (
          <g key={i}>
            <circle cx={x - 8} cy={y} r={4} fill="var(--ink)" />
            <text x={x + 4} y={y + 4} className="fill-[var(--ink)] text-[13px]">
              {n.data.name}
              <tspan className="fill-[var(--muted)]"> · {n.data.count}</tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

const SENTENCE: Record<string, string> = {
  job: "took a job",
  gate: "went for GATE or other exams",
  startup: "joined a startup",
  higher_studies: "went for higher studies",
  other: "did something else",
};

/** Plain-language version of the map, shown beside the drawing. */
export function routeSentence(data: RouteMapData): string {
  return data.branches.map((b) => `${b.count} ${SENTENCE[b.decision] ?? "did something else"}`).join(", ");
}

/** Stacked version of the map for narrow screens. */
export function RouteList({ data }: { data: RouteMapData }) {
  return (
    <ul className="space-y-3">
      {data.branches.map((b) => (
        <li key={b.decision}>
          <span
            className="inline-block rounded-full px-3 py-1 text-sm font-bold text-[var(--ink)]"
            style={{ background: COLORS[b.decision] ?? COLORS.other }}
          >
            {b.count} · {b.label}
          </span>
          {b.destinations.length > 0 && (
            <ul className="mt-2 ml-4 space-y-1 border-l-2 border-[var(--ink)]/15 pl-3 text-sm">
              {b.destinations.map((d) => (
                <li key={d.label}>
                  {d.label} <span className="text-[var(--muted)]">· {d.count}</span>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
