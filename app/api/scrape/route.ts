import { writeFileSync } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { datasetRows, runStatus, startRun } from "../../../lib/apify";
import { CSV_DIR, ensureDirs, listScrapes, newId, readConfig, readScrape, saveScrape, toCsv, writeConfig, type Scrape } from "../../../lib/store";

// Scrapes.
//   GET                 → { list }  your past scrapes
//   GET ?id=…           → { scrape }  while running, asks Apify how it's going (and saves the rows when done)
//   GET ?csv=…          → the CSV file (also saved in my-scrapes/csv/)
//   POST { url, max }   → starts a scrape, returns { scrape }
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status });

async function refresh(s: Scrape): Promise<Scrape> {
  if (s.status !== "running" || !s.runId) return s;
  const key = readConfig().apiKey;
  if (!key) return s;
  const st = await runStatus(key, s.runId);
  if (st.status === "READY" || st.status === "RUNNING") return s;
  if (st.status === "SUCCEEDED" || (st.status === "ABORTED" && s.datasetId)) {
    // ABORTED with a dataset = it hit the spend cap; keep what it got.
    s.rows = await datasetRows(key, s.datasetId!);
    s.status = "done";
  } else {
    s.status = "failed";
    s.error = st.message || `Apify run ${st.status.toLowerCase()}`;
  }
  s.costUsd = st.cost;
  saveScrape(s);
  return s;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  try {
    const csv = q.get("csv");
    if (csv) {
      const s = readScrape(csv);
      if (!s) return bad("not found", 404);
      const body = toCsv(s.rows);
      ensureDirs();
      writeFileSync(path.join(CSV_DIR(), `${s.id}.csv`), body);
      const slug = (s.postUrl.match(/linkedin\.com\/(?:posts|feed\/update)\/([^/?#]+)/)?.[1] || "post").replace(/[^a-z0-9-]+/gi, "-").slice(0, 40);
      return new Response(body, {
        headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="commenters-${slug}.csv"`, "cache-control": "no-store" },
      });
    }
    const id = q.get("id");
    if (id) {
      const s = readScrape(id);
      if (!s) return bad("not found", 404);
      return NextResponse.json({ ok: true, scrape: await refresh(s) });
    }
    return NextResponse.json({ ok: true, list: listScrapes() });
  } catch (e) {
    return bad((e as Error).message);
  }
}

export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { url?: string; max?: number };
    const url = (b.url || "").trim();
    if (!/^https?:\/\/([a-z]+\.)?linkedin\.com\/(posts|feed\/update)\//i.test(url)) return bad("That isn't a LinkedIn post link.");
    const max = Math.max(1, Math.min(Math.round(Number(b.max) || 200), 2000));
    const key = readConfig().apiKey;
    if (!key) return bad("Add your Apify key first.");
    writeConfig({ max });
    const run = await startRun(key, url, max);
    const s: Scrape = { id: newId(), postUrl: url, createdAt: Date.now(), max, status: "running", ...run, rows: [] };
    saveScrape(s);
    return NextResponse.json({ ok: true, scrape: s });
  } catch (e) {
    return bad((e as Error).message);
  }
}
