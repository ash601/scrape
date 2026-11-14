// Everything lives in my-scrapes/ next to the app:
//   config.json        your Apify key + the last key check (the page never sees the key)
//   scrapes/<id>.json  one per post: link, date, status, rows
//   csv/<id>.csv       written when you press Download CSV

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export const ROOT = process.env.SCRAPE_DATA || path.join(process.cwd(), "my-scrapes");
const SCRAPES = () => path.join(ROOT, "scrapes");
export const CSV_DIR = () => path.join(ROOT, "csv");

export const ensureDirs = () => [ROOT, SCRAPES(), CSV_DIR()].forEach((d) => mkdirSync(d, { recursive: true }));

/** Writes through a temp file, so a crash mid-write can't leave half a file. */
function writeJson(file: string, data: unknown) {
  ensureDirs();
  const tmp = file + ".tmp";
  writeFileSync(tmp, JSON.stringify(data, null, 2));
  renameSync(tmp, file);
}
function readJson<T>(file: string): T | null {
  try {
    // A file saved by Notepad / PowerShell can start with a BOM, which JSON.parse rejects.
    return JSON.parse(readFileSync(file, "utf-8").replace(/^﻿/, "")) as T;
  } catch {
    return null;
  }
}

// ── Config ──────────────────────────────────────────────────────────────────
export interface KeyCheck {
  ok: boolean;
  status: string;
  user?: string;
  checkedAt: number;
}
export interface Config {
  apiKey?: string;
  check?: KeyCheck;
  max?: number;
}
const CONFIG = () => path.join(ROOT, "config.json");
export const readConfig = (): Config => readJson<Config>(CONFIG()) || {};
export function writeConfig(patch: Partial<Config>): Config {
  const next = { ...readConfig(), ...patch };
  for (const k of Object.keys(next) as (keyof Config)[]) if (next[k] === undefined) delete next[k];
  writeJson(CONFIG(), next);
  return next;
}
/** What the page may see: everything but the key. */
export function publicConfig() {
  const { apiKey, ...rest } = readConfig();
  return { ...rest, hasKey: !!apiKey, root: ROOT };
}

// ── Scrapes ─────────────────────────────────────────────────────────────────
export interface Row {
  name: string;
  headline: string;
  profile: string;
  comment: string;
  date: string;
  pic?: string;
}
export interface Scrape {
  id: string;
  postUrl: string;
  createdAt: number;
  max: number;
  status: "running" | "done" | "failed";
  runId?: string;
  datasetId?: string;
  error?: string;
  costUsd?: number;
  rows: Row[];
}
const SAFE_ID = /^[a-z0-9-]+$/i;
const scrapeFile = (id: string) => {
  if (!SAFE_ID.test(id)) throw new Error("bad id");
  return path.join(SCRAPES(), `${id}.json`);
};
export const readScrape = (id: string) => readJson<Scrape>(scrapeFile(id));
export const saveScrape = (s: Scrape) => writeJson(scrapeFile(s.id), s);
export function listScrapes() {
  if (!existsSync(SCRAPES())) return [];
  return readdirSync(SCRAPES())
    .filter((f) => f.endsWith(".json"))
    .map((f) => readJson<Scrape>(path.join(SCRAPES(), f)))
    .filter((s): s is Scrape => !!s)
    .sort((a, b) => b.createdAt - a.createdAt)
    .map(({ rows, ...s }) => ({ id: s.id, postUrl: s.postUrl, createdAt: s.createdAt, status: s.status, count: rows.length }));
}
export const newId = () => `${new Date().toISOString().slice(0, 10)}-${Math.random().toString(36).slice(2, 8)}`;

// ── CSV ─────────────────────────────────────────────────────────────────────
const cell = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export function toCsv(rows: Row[]): string {
  const head = ["Name", "Headline", "Profile link", "Comment", "Comment date"];
  const lines = [head, ...rows.map((r) => [r.name, r.headline, r.profile, r.comment, r.date])].map((l) => l.map((v) => cell(v || "")).join(","));
  // The BOM makes Excel read accents and emoji correctly.
  return "﻿" + lines.join("\r\n") + "\r\n";
}

/** Show a folder in Explorer / Finder. */
export function reveal(target: string): void {
  ensureDirs();
  if (process.platform === "win32") spawn("explorer", [target], { detached: true, stdio: "ignore" }).unref();
  else if (process.platform === "darwin") spawn("open", [target], { detached: true, stdio: "ignore" }).unref();
  else spawn("xdg-open", [target], { detached: true, stdio: "ignore" }).unref();
}
