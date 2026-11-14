// Apify, three calls:
//   GET  /v2/users/me                                        checks a key (free)
//   POST /v2/acts/harvestapi~linkedin-post-comments/runs     starts a scrape
//   GET  /v2/actor-runs/<id>, then /v2/datasets/<id>/items    status, then the comments
// Actor input (from its input schema): posts[], maxItems, scrapeReplies, profileScraperMode ("short").
// "short" is $0.002 a comment and still returns the commenter's name, link and headline (actor.position).

import type { KeyCheck, Row } from "./store";

const API = "https://api.apify.com/v2";
const ACTOR = "harvestapi~linkedin-post-comments";
export const PER_COMMENT = 0.002;

const auth = (key: string) => ({ Authorization: `Bearer ${key}` });

function plainError(status: number, said: string, type = "") {
  // A key that works but whose account can't run anything comes back 403 too: say which it is.
  if (type === "platform-feature-disabled" || /monthly usage|Free plan/i.test(said)) return "Your Apify free $5 for this month is used up. It resets next month (or upgrade on apify.com).";
  if (status === 402 || /credit|balance/i.test(said)) return "Your Apify account is out of credit.";
  if (status === 401 || status === 403) return "Apify didn't accept that key. Copy it again from Apify → Settings → API & Integrations.";
  return `Apify said: ${said || `error ${status}`}`;
}

async function call<T>(key: string, url: string, init: RequestInit = {}): Promise<T> {
  const r = await fetch(url, { ...init, headers: { ...auth(key), "Content-Type": "application/json" }, signal: AbortSignal.timeout(30_000) });
  const j = (await r.json().catch(() => ({}))) as { data?: unknown; error?: { message?: string; type?: string } };
  if (!r.ok) throw new Error(plainError(r.status, j.error?.message || "", j.error?.type));
  return (j.data ?? j) as T;
}

export async function checkKey(key: string): Promise<KeyCheck> {
  const k = key.trim();
  if (!k) return { ok: false, status: "Paste your Apify key first.", checkedAt: Date.now() };
  try {
    const d = await call<{ username?: string }>(k, `${API}/users/me`);
    return { ok: true, status: "Apify key works", user: d.username, checkedAt: Date.now() };
  } catch (e) {
    return { ok: false, status: (e as Error).message, checkedAt: Date.now() };
  }
}

/** Starts the run. Spend is capped at what `max` comments cost, so there's never a surprise bill. */
export async function startRun(key: string, postUrl: string, max: number) {
  const cap = (max * PER_COMMENT + 0.01).toFixed(3);
  const d = await call<{ id: string; defaultDatasetId: string }>(key, `${API}/acts/${ACTOR}/runs?maxTotalChargeUsd=${cap}`, {
    method: "POST",
    body: JSON.stringify({ posts: [postUrl], maxItems: max, scrapeReplies: false, profileScraperMode: "short" }),
  });
  return { runId: d.id, datasetId: d.defaultDatasetId };
}

export async function runStatus(key: string, runId: string) {
  const d = await call<{ status: string; usageTotalUsd?: number; statusMessage?: string }>(key, `${API}/actor-runs/${runId}`);
  return { status: d.status, cost: d.usageTotalUsd, message: d.statusMessage };
}

type Item = {
  commentary?: string;
  createdAt?: string;
  actor?: { name?: string; linkedinUrl?: string; position?: string; pictureUrl?: string; profilePicture?: string | { url?: string } };
};

export async function datasetRows(key: string, datasetId: string): Promise<Row[]> {
  const r = await fetch(`${API}/datasets/${datasetId}/items?clean=true&format=json`, { headers: auth(key), signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(plainError(r.status, ""));
  const items = (await r.json()) as Item[];
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.actor)
    .map((it) => ({
      name: (it.actor?.name || "").trim(),
      headline: (it.actor?.position || "").trim(),
      profile: (it.actor?.linkedinUrl || "").split("?")[0].trim(),
      comment: (it.commentary || "").trim(),
      date: (it.createdAt || "").slice(0, 10),
      pic: (it.actor?.pictureUrl || (typeof it.actor?.profilePicture === "string" ? it.actor.profilePicture : it.actor?.profilePicture?.url) || "").trim(),
    }));
}
