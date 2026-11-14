"use client";

// The one screen: key row, paste a post link, the table (sample row until a real run), Download CSV,
// and your past scrapes.

import { useCallback, useEffect, useState } from "react";
import ConnectStrip, { keyOk, type PublicConfig } from "./ConnectStrip";
import PageHeader from "./PageHeader";
import Tip from "./Tip";
import { FolderIcon, PowerIcon } from "./icons";

type Row = { name: string; headline: string; profile: string; comment: string; date: string; pic?: string };
type Scrape = { id: string; postUrl: string; createdAt: number; max: number; status: "running" | "done" | "failed"; error?: string; costUsd?: number; rows: Row[] };
type Past = { id: string; postUrl: string; createdAt: number; status: Scrape["status"]; count: number };

const PER = 0.002;
const SAMPLE: Row = { name: "Priya Sharma", headline: "Founder @ SaaSly", profile: "https://www.linkedin.com/in/priya-sharma", comment: "So true. We saw the same thing when we…", date: "" };
const LAST = "scrape:last";

const money = (n: number) => `$${n.toFixed(2)}`;
const shortLink = (u: string) => u.replace(/^https?:\/\/(www\.)?/, "");
const postLabel = (u: string) => {
  const m = u.match(/linkedin\.com\/posts\/([^_/?#]+)/);
  return m ? m[1] : shortLink(u).slice(0, 38) + (shortLink(u).length > 38 ? "…" : "");
};
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* private window */
    }
  },
};

export default function ScrapeView() {
  const [cfg, setCfg] = useState<PublicConfig | null>(null);
  const [url, setUrl] = useState("");
  const [max, setMax] = useState(200);
  const [cur, setCur] = useState<Scrape | null>(null);
  const [past, setPast] = useState<Past[]>([]);
  const [err, setErr] = useState("");
  const [starting, setStarting] = useState(false);
  const [off, setOff] = useState(false);

  const loadList = useCallback(
    () =>
      fetch("/api/scrape")
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) setPast(j.list);
          return (j.list || []) as Past[];
        }),
    [],
  );
  const open = useCallback(async (id: string) => {
    const j = await fetch(`/api/scrape?id=${encodeURIComponent(id)}`).then((r) => r.json());
    if (j.ok) {
      setCur(j.scrape);
      setUrl(j.scrape.postUrl);
      store.set(LAST, id);
    }
  }, []);

  useEffect(() => {
    fetch("/api/connect")
      .then((r) => r.json())
      .then((j) => {
        if (j.config) {
          setCfg(j.config);
          if (j.config.max) setMax(j.config.max);
        }
      });
    // Reopen the scrape you were last on (or the newest one).
    loadList().then((list) => {
      const last = store.get(LAST);
      const id = last && list.some((p) => p.id === last) ? last : list[0]?.id;
      if (id) void open(id);
    });
  }, [loadList, open]);

  // While a run is going, ask every 3 s.
  useEffect(() => {
    if (cur?.status !== "running") return;
    const t = setInterval(async () => {
      const j = await fetch(`/api/scrape?id=${cur.id}`).then((r) => r.json()).catch(() => null);
      if (j?.ok && j.scrape.status !== "running") {
        setCur(j.scrape);
        loadList();
      }
    }, 3000);
    return () => clearInterval(t);
  }, [cur?.id, cur?.status, loadList]);

  const start = async () => {
    setErr("");
    setStarting(true);
    try {
      const j = await fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url, max }) }).then((r) => r.json());
      if (!j.ok) return setErr(j.error || "That didn't work.");
      setCur(j.scrape);
      store.set(LAST, j.scrape.id);
      loadList();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setStarting(false);
    }
  };

  const turnOff = async () => {
    try {
      await fetch("/api/shutdown", { method: "POST" });
    } catch {
      /* it's going down either way */
    }
    setOff(true);
  };

  if (off)
    return (
      <div className="min-h-[70vh] grid place-items-center text-center">
        <div>
          <h1 className="font-display text-[28px] leading-none">Scrape is off</h1>
          <p className="mt-2 text-[13px] text-[color:var(--mist)]">Close this tab. Double-click START to open it again.</p>
        </div>
      </div>
    );

  const running = cur?.status === "running";
  const done = cur?.status === "done";
  const rows = done ? cur!.rows : [];
  const ok = keyOk(cfg);

  return (
    <div>
      <PageHeader
        eyebrow="LinkedIn"
        title="Scrape"
        actions={
          <div className="flex items-center gap-2">
            <button className="px-3 py-2 rounded-xl text-[13px] text-[color:var(--mist)] hover:text-[color:var(--warm-ivory)] flex items-center gap-1.5" onClick={() => fetch("/api/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reveal" }) })}>
              <FolderIcon size={15} /> Open folder
            </button>
            <button className="glass-flat px-3 py-2 rounded-xl text-[13px] text-[color:var(--mist)] hover:text-red-300 flex items-center gap-1.5" title="Stops Scrape (your scrapes stay)" onClick={turnOff}>
              <PowerIcon size={15} /> Turn off
            </button>
          </div>
        }
      />

      <ConnectStrip cfg={cfg} onChange={setCfg} />

      <section className="grid gap-3 md:grid-cols-[260px_1fr] items-start border-t border-white/10 pt-5 pb-6">
        <div className="text-[15px] pt-2"><Tip text="Open the post on LinkedIn → click … (top right of the post) → Copy link to post → paste it here.">1 · Paste a LinkedIn post link</Tip></div>
        <div className="flex flex-col gap-2.5">
          <input className="field w-full rounded-lg px-3 py-2.5 text-[14px]" placeholder="https://linkedin.com/posts/…" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && url.trim() && ok && !running && start()} />
          <div className="flex items-center gap-3 flex-wrap">
            <button className="btn-ember px-4 py-2.5 rounded-lg text-[14px] disabled:opacity-50" disabled={!url.trim() || !ok || running || starting} onClick={start}>
              {running || starting ? "Getting comments…" : "Get commenters"}
            </button>
            <Tip text="Click to pull everyone who commented on that post. Takes about 30 seconds." />
            <Tip q={false} text="The most comments to get. It also caps what you pay (each comment ≈ $0.002).">
            <label className="flex items-center gap-1.5 text-[12px] text-[color:var(--mist)]">
              max
              <input type="number" min={1} max={2000} className="field w-[72px] rounded-md px-2 py-1 text-[13px]" value={max} onChange={(e) => setMax(Math.max(1, Math.min(2000, Number(e.target.value) || 1)))} />
              ≈ {money(max * PER)}
            </label>
            </Tip>
          </div>
          {err ? <div className="text-[12px] text-[#fca5a5]">{err}</div> : null}
        </div>
      </section>

      <section className="pb-6">
        <div className="text-[14px] mb-2.5 flex items-center gap-3 flex-wrap">
          {done ? (
            <>
              <span className="text-[color:var(--warm-ivory)]">{rows.length} comments</span>
              <span className="text-[12px] text-[color:var(--mist)] truncate max-w-[60ch]">{shortLink(cur!.postUrl)}</span>
            </>
          ) : (
            <span className="text-[color:var(--mist)]">You&apos;ll get, for every person who commented:</span>
          )}
        </div>
        {running ? (
          <div className="glass-flat rounded-xl px-4 py-4 text-[13px] text-[color:var(--mist)]">
            <span className="listening inline-block w-2 h-2 rounded-full bg-[color:var(--hot-ember)] mr-2 align-middle" />
            Getting comments… (about 30 s)
          </div>
        ) : cur?.status === "failed" ? (
          <div className="glass-flat rounded-xl px-4 py-4 text-[13px] text-[#fca5a5]">{cur.error || "That run didn't work."}</div>
        ) : done && !rows.length ? (
          <div className="glass-flat rounded-xl px-4 py-4 text-[13px] text-[color:var(--mist)]">No comments on that post.</div>
        ) : (
          <div className="grid gap-2.5 grid-cols-[repeat(auto-fill,minmax(280px,1fr))] max-h-[560px] overflow-auto scroll-slim pr-1">
            {(done ? rows : [SAMPLE]).map((r, i) => (
              <div key={i} className={`glass-flat rounded-xl p-3.5 flex gap-3 ${done ? "" : "opacity-60"}`}>
                {r.pic ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={r.pic} alt="" className="w-11 h-11 rounded-full object-cover shrink-0 bg-white/10" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-11 h-11 rounded-full shrink-0 grid place-items-center bg-[rgba(245,92,47,0.18)] text-[color:var(--warm-ivory)] text-[14px]">
                    {r.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?"}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-[color:var(--warm-ivory)] truncate">{r.name}</span>
                    {!done ? <span className="font-mono text-[9.5px] tracking-[0.14em] px-1.5 py-0.5 rounded bg-white/10 text-[color:var(--mist)]">EXAMPLE</span> : null}
                  </div>
                  {r.headline ? <div className="text-[12px] text-[color:var(--mist)] truncate">{r.headline}</div> : null}
                  <div className="text-[13px] mt-1.5 line-clamp-3">&ldquo;{r.comment}&rdquo;</div>
                  <a className="inline-block mt-2 text-[12px] text-[color:var(--hot-ember)] hover:underline" href={r.profile} target="_blank" rel="noreferrer">
                    Open profile ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="mt-2.5 text-[12px] text-[color:var(--mist)]">
          100 comments ≈ $0.20 · Apify&apos;s free $5 a month covers ~2,500
          {done && typeof cur?.costUsd === "number" ? <> · this one cost {money(cur.costUsd)}</> : null}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-[260px_1fr] items-start border-t border-white/10 pt-5">
        <div>
          <Tip text="Saves the list as a spreadsheet you can open in Excel or Google Sheets.">
          {done && rows.length ? (
            <a className="btn-ember inline-block px-4 py-2.5 rounded-lg text-[14px]" href={`/api/scrape?csv=${cur!.id}`} download>
              Download CSV
            </a>
          ) : (
            <button className="btn-ember px-4 py-2.5 rounded-lg text-[14px] opacity-40" disabled>
              Download CSV
            </button>
          )}
          </Tip>
        </div>
        <div>
          <div className="text-[14px] mb-2"><Tip text="Every post you scraped. Click one to see its people again.">Your scrapes</Tip></div>
          {past.length ? (
            <ul className="flex flex-col gap-1">
              {past.map((p) => (
                <li key={p.id}>
                  <button
                    className={`w-full text-left flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] border ${cur?.id === p.id ? "border-[color:var(--hot-ember)]/60 bg-white/5" : "border-white/5 hover:border-white/20"}`}
                    onClick={() => open(p.id)}
                  >
                    <span className="truncate flex-1">{postLabel(p.postUrl)}</span>
                    <span className="text-[12px] text-[color:var(--mist)] whitespace-nowrap">
                      {p.status === "running" ? "running…" : p.status === "failed" ? "failed" : `${p.count} comments`} · {new Date(p.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-[12px] text-[color:var(--mist)]">None yet.</div>
          )}
        </div>
      </section>
    </div>
  );
}
