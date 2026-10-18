"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/fed/client";
import { DOMAINS, DOMAIN_LABEL, OPEN_TO, OPEN_TO_LABEL } from "@/lib/fed/taxonomy";

const NODES = [
  { id: "ngit", label: "NGIT", sub: "Northgate, Delhi", url: process.env.NEXT_PUBLIC_NODE_NGIT_URL },
  { id: "rce", label: "RCE", sub: "Riverbend, Noida", url: process.env.NEXT_PUBLIC_NODE_RCE_URL },
  { id: "pro", label: "Professional", sub: "Not from these colleges", url: process.env.NEXT_PUBLIC_NODE_PRO_URL },
] as const;
type NodeChoice = (typeof NODES)[number]["id"];
const BRANCHES = ["CSE", "IT", "ECE", "ME", "AIML"];
const SKILLS = ["python", "ml", "web", "dsa", "cloud", "design"];
const GOALS = ["ML engineer at a fintech", "Software engineer at a product company", "Data scientist", "Higher studies (GATE or MS)", "Start my own company"];

const chip = (on: boolean) => `rounded-full border-2 px-5 py-3 text-lg font-bold ${on ? "border-[var(--ink)] bg-[var(--ink)] text-white" : "border-[var(--ink)]/25 bg-[var(--surface)]"}`;
const field = "mt-1 w-full rounded-xl border border-[var(--ink)]/25 bg-[var(--surface)] px-4 py-3 text-xl";
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

/** 30-second profile for a phone. It goes straight to the chosen server (a college's, or the professional network's). */
export function JoinForm() {
  const router = useRouter();
  const [node, setNode] = useState<NodeChoice>("ngit");
  const [role, setRole] = useState<"student" | "alum">("student");
  const [name, setName] = useState("");
  const [branch, setBranch] = useState("CSE");
  const [sem, setSem] = useState(5);
  const [gradYear, setGradYear] = useState(2022);
  const [cgpa, setCgpa] = useState(7.5);
  const [internship, setInternship] = useState(false);
  const [projects, setProjects] = useState(2);
  const [hackathons, setHackathons] = useState(1);
  const [skills, setSkills] = useState<string[]>(["python"]);
  const [goal, setGoal] = useState(GOALS[0]);
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  // professionals
  const [domain, setDomain] = useState<string>("healthcare");
  const [years, setYears] = useState(8);
  const [city, setCity] = useState("");
  const [offers, setOffers] = useState<string[]>(["healthcare"]);
  const [needs, setNeeds] = useState<string[]>([]);
  const [openTo, setOpenTo] = useState<string[]>(["intros"]);
  const [about, setAbout] = useState("");
  const [open, setOpen] = useState(true);
  const [board, setBoard] = useState(true);
  const [adult, setAdult] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const professional = node === "pro";
  const serverName = NODES.find((n) => n.id === node)?.label ?? "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = NODES.find((n) => n.id === node)?.url;
    if (!url) return setError("That server is not configured.");
    setBusy(true);
    setError("");
    const payload = professional
      ? { name: name.trim(), role: "professional", domain, title: title.trim(), company: company.trim() || null, years_exp: years, city: city.trim() || null, offers, needs, open_to: openTo, about: about.trim() || null, open_to_intros: open, on_leaderboard: board, is_18_plus: adult }
      : {
          name: name.trim(), role, branch, ...(role === "student" ? { sem } : { grad_year: gradYear }), cgpa, internship, projects, hackathons, skills, goal,
          company: role === "alum" ? company.trim() || null : null, title: role === "alum" ? title.trim() || null : null, open_to_intros: open, on_leaderboard: board, is_18_plus: adult,
        };
    try {
      const res = await fetch(`${url}/public/join`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = (await res.json().catch(() => ({}))) as { pid?: string; error?: string };
      if (!res.ok || !body.pid) {
        setBusy(false);
        const known: Record<string, string> = {
          must_be_18_plus: "You need to be 18 or older to join.",
          rate_limited: "Too many sign-ups right now. Wait a minute and try again.",
          title_required: "Add your role, for example “Cardiologist”.",
          domain_required: "Pick the field you work in.",
        };
        return setError(known[body.error ?? ""] ?? "That server could not save your profile.");
      }
      const reg = await api<{ error?: string }>("/api/fed/register", { method: "POST", json: { pid: body.pid, node } });
      if (!reg.ok) {
        setBusy(false);
        return setError(reg.data.error ?? "Setu could not register you.");
      }
      router.push(professional ? "/live/find" : "/live/mirror");
    } catch {
      setBusy(false);
      setError("Could not reach the server. Check your connection and try again.");
    }
  }

  const ready = name.trim() && adult && (professional ? title.trim() && offers.length > 0 : skills.length > 0);
  return (
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-6 px-4 pb-24 pt-6 text-lg">
      <div>
        <p className="text-2xl font-black uppercase tracking-tight">SETU</p>
        <h1 className="mt-2 text-4xl font-black leading-tight">Make your profile in 30 seconds</h1>
        <p className="mt-2 text-[var(--muted)]">It is saved on {professional ? "the professional network’s" : "your college’s"} own server. Setu keeps only a random ID.</p>
      </div>

      <fieldset>
        <legend className="font-bold">Where do you belong?</legend>
        <div className="mt-2 grid grid-cols-3 gap-3">
          {NODES.map((n) => (
            <button key={n.id} type="button" onClick={() => setNode(n.id)} aria-pressed={node === n.id} className={`${chip(node === n.id)} rounded-2xl text-left`}>
              <span className="block text-xl">{n.label}</span>
              <span className="text-sm font-normal opacity-80">{n.sub}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block font-bold">
        Your name
        <input required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" className={field} />
        <span className="text-base font-normal text-[var(--muted)]">Only {serverName === "Professional" ? "the professional network’s" : `${serverName}’s`} server stores this.</span>
      </label>

      {professional ? (
        <>
          <label className="block font-bold">
            The field you work in
            <select value={domain} onChange={(e) => (setDomain(e.target.value), setOffers((o) => (o.includes(e.target.value) ? o : [e.target.value, ...o])))} className={field}>
              {DOMAINS.map((d) => (
                <option key={d} value={d}>
                  {DOMAIN_LABEL[d]}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-4">
            <label className="font-bold">
              Your role
              <input required value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="Cardiologist" className={field} />
            </label>
            <label className="font-bold">
              Organisation
              <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={80} className={field} />
            </label>
            <label className="font-bold">
              Years of experience
              <input type="number" min={0} max={60} value={years} onChange={(e) => setYears(Number(e.target.value))} className={field} />
            </label>
            <label className="font-bold">
              City
              <input value={city} onChange={(e) => setCity(e.target.value)} maxLength={60} className={field} />
            </label>
          </div>
          <fieldset>
            <legend className="font-bold">What can you help others with?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DOMAINS.map((d) => (
                <button key={d} type="button" aria-pressed={offers.includes(d)} onClick={() => setOffers(toggle(offers, d))} className={chip(offers.includes(d))}>
                  {DOMAIN_LABEL[d]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-bold">What kind of help do you need?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {DOMAINS.map((d) => (
                <button key={d} type="button" aria-pressed={needs.includes(d)} onClick={() => setNeeds(toggle(needs, d))} className={chip(needs.includes(d))}>
                  {DOMAIN_LABEL[d]}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="font-bold">I am open to</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {OPEN_TO.map((o) => (
                <button key={o} type="button" aria-pressed={openTo.includes(o)} onClick={() => setOpenTo(toggle(openTo, o))} className={chip(openTo.includes(o))}>
                  {OPEN_TO_LABEL[o]}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block font-bold">
            In your own words: what do you need, or what can you offer?
            <textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={3} maxLength={400} placeholder="I run a clinic. I need a developer who has built health apps." className={field} />
            <span className="text-base font-normal text-[var(--muted)]">Stays on the server. Shown only to someone who has said yes to you.</span>
          </label>
        </>
      ) : (
        <>
          <div className="flex gap-3">
            {(["student", "alum"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)} aria-pressed={role === r} className={chip(role === r)}>
                {r === "student" ? "I’m a student" : "I’m an alum"}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="font-bold">
              Branch
              <select value={branch} onChange={(e) => setBranch(e.target.value)} className={field}>
                {BRANCHES.map((b) => (
                  <option key={b}>{b}</option>
                ))}
              </select>
            </label>
            {role === "student" ? (
              <label className="font-bold">
                Semester
                <select value={sem} onChange={(e) => setSem(Number(e.target.value))} className={field}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="font-bold">
                Graduation year
                <input type="number" min={2010} max={2026} value={gradYear} onChange={(e) => setGradYear(Number(e.target.value))} className={field} />
              </label>
            )}
          </div>

          {role === "alum" && (
            <div className="grid grid-cols-2 gap-4">
              <label className="font-bold">
                Company
                <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={80} className={field} />
              </label>
              <label className="font-bold">
                Role
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} className={field} />
              </label>
            </div>
          )}

          <label className="block font-bold">
            CGPA <span className="font-mono text-2xl">{cgpa.toFixed(1)}</span>
            <input type="range" min={5} max={10} step={0.1} value={cgpa} onChange={(e) => setCgpa(Number(e.target.value))} className="mt-2 h-10 w-full" />
          </label>

          <div className="grid grid-cols-2 gap-4">
            <label className="font-bold">
              Projects
              <input type="number" min={0} max={20} value={projects} onChange={(e) => setProjects(Number(e.target.value))} className={field} />
            </label>
            <label className="font-bold">
              Hackathons
              <input type="number" min={0} max={20} value={hackathons} onChange={(e) => setHackathons(Number(e.target.value))} className={field} />
            </label>
          </div>

          <button type="button" onClick={() => setInternship(!internship)} aria-pressed={internship} className={`${chip(internship)} w-full`}>
            {internship ? "✓ I have done an internship" : "I have not done an internship yet"}
          </button>

          <fieldset>
            <legend className="font-bold">Skills</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <button key={s} type="button" aria-pressed={skills.includes(s)} onClick={() => setSkills(toggle(skills, s))} className={chip(skills.includes(s))}>
                  {s}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="font-bold">What are you aiming for?</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {GOALS.map((g) => (
                <button key={g} type="button" aria-pressed={goal === g} onClick={() => setGoal(g)} className={chip(goal === g)}>
                  {g}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}

      <label className="flex items-start gap-3 font-semibold">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} className="mt-1.5 size-6" />
        Open to intros
      </label>
      <label className="flex items-start gap-3 font-semibold">
        <input type="checkbox" checked={board} onChange={(e) => setBoard(e.target.checked)} className="mt-1.5 size-6" />
        Show me on the leaderboard
      </label>
      <label className="flex items-start gap-3 font-bold">
        <input type="checkbox" required checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-1.5 size-6" />I am 18 or older
      </label>

      {error && (
        <p role="alert" className="rounded-xl bg-[var(--red-tile)]/25 p-4 font-semibold">
          {error}
        </p>
      )}
      <button disabled={busy || !ready} className="w-full rounded-full bg-[var(--ink)] px-6 py-5 text-2xl font-black text-white disabled:opacity-50">
        {busy ? "Saving to the server…" : "Join Setu"}
      </button>
    </form>
  );
}
