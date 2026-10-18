import Link from "next/link";
import type { ConnItem } from "@/lib/connections/types";

const GROUPS = [
  { role: "student", label: "Students", icon: "🎓", tone: "var(--blue)" },
  { role: "alumni", label: "Alumni", icon: "💼", tone: "var(--yellow)" },
  { role: "faculty", label: "Faculty", icon: "📚", tone: "var(--sage)" },
  { role: "founder", label: "Founders", icon: "🚀", tone: "var(--red-tile)" },
  { role: "recruiter", label: "Recruiters", icon: "🤝", tone: "var(--stone)" },
  { role: "placement", label: "Institution", icon: "🏛", tone: "var(--stone)" },
] as const;

const W = 800;
const H = 660;
const CX = W / 2;
const CY = H / 2;
const R_GROUP = 210;
const R_MEMBER = 78;
const MAX_MEMBERS = 7;

const initials = (name: string) =>
  name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

/**
 * The hub-and-spoke picture: you in the middle, one spoke per kind of person, and the people
 * you are connected to around each spoke. Decorative; the same people are listed as text below it.
 */
export function NetworkGraph({ connected, youLabel }: { connected: ConnItem[]; youLabel: string }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${connected.length} connections across ${GROUPS.filter((g) => connected.some((c) => c.person.role === g.role)).length} groups`}>
      {GROUPS.map((g, gi) => {
        const angle = (-90 + gi * (360 / GROUPS.length)) * (Math.PI / 180);
        const gx = CX + R_GROUP * Math.cos(angle);
        const gy = CY + R_GROUP * Math.sin(angle);
        const people = connected.filter((c) => c.person.role === g.role);
        const shown = people.slice(0, MAX_MEMBERS);
        const spread = Math.min(Math.PI * 1.5, Math.max(0.0001, (shown.length - 1) * 0.5));

        return (
          <g key={g.role}>
            <line x1={CX} y1={CY} x2={gx} y2={gy} stroke="var(--ink)" strokeOpacity={people.length ? 0.55 : 0.15} strokeWidth={people.length ? 2 : 1} strokeDasharray={people.length ? undefined : "4 6"} />

            {shown.map((c, i) => {
              const a = angle - spread / 2 + (shown.length === 1 ? spread / 2 : (spread * i) / (shown.length - 1));
              const mx = gx + R_MEMBER * Math.cos(a);
              const my = gy + R_MEMBER * Math.sin(a);
              return (
                <g key={c.id} className="node-in" style={{ animationDelay: `${0.3 + gi * 0.08 + i * 0.04}s` }}>
                  <line x1={gx} y1={gy} x2={mx} y2={my} stroke="var(--ink)" strokeOpacity={0.35} />
                  <Link href={`/people/${c.person.id}`} aria-label={c.person.name}>
                    <circle cx={mx} cy={my} r={19} fill="var(--surface)" stroke={g.tone} strokeWidth={4} />
                    <text x={mx} y={my + 4} textAnchor="middle" className="fill-[var(--ink)] text-[11px] font-bold">
                      {initials(c.person.name)}
                    </text>
                  </Link>
                </g>
              );
            })}
            {people.length > shown.length && (
              <text x={gx} y={gy + 54} textAnchor="middle" className="fill-[var(--muted)] text-[12px]">
                +{people.length - shown.length} more
              </text>
            )}

            <circle cx={gx} cy={gy} r={34} fill={g.tone} stroke="var(--ink)" strokeWidth={2} />
            <text x={gx} y={gy + 9} textAnchor="middle" className="text-[26px]">
              {g.icon}
            </text>
            <text x={gx} y={gy - 44} textAnchor="middle" className="fill-[var(--ink)] text-[13px] font-bold">
              {g.label}
              <tspan className="fill-[var(--muted)]"> · {people.length}</tspan>
            </text>
          </g>
        );
      })}

      <circle cx={CX} cy={CY} r={46} fill="var(--ink)" />
      <text x={CX} y={CY + 5} textAnchor="middle" className="fill-white text-[15px] font-black">
        {youLabel}
      </text>
    </svg>
  );
}
