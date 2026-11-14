import { NextResponse } from "next/server";
import { checkKey } from "../../../lib/apify";
import { publicConfig, readConfig, reveal, ROOT, writeConfig } from "../../../lib/store";

// The key row.
//   GET                              → { config } (never the key)
//   POST { action: "save-key", key } → checked with Apify; saved only if it works
//   POST { action: "check-key" }     → checks the saved key again
//   POST { action: "reveal" }        → opens my-scrapes/ in Explorer / Finder
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const out = (extra: object = {}) => NextResponse.json({ ok: true, config: publicConfig(), ...extra });

export async function GET() {
  return out();
}

export async function POST(req: Request) {
  try {
    const b = (await req.json().catch(() => ({}))) as { action?: string; key?: string };
    if (b.action === "save-key") {
      const res = await checkKey(b.key || "");
      if (res.ok) writeConfig({ apiKey: (b.key || "").trim(), check: res });
      return out({ result: res });
    }
    if (b.action === "check-key") {
      const key = readConfig().apiKey;
      if (!key) return out({ result: { ok: false, status: "No key yet." } });
      const res = await checkKey(key);
      writeConfig({ check: res });
      return out({ result: res });
    }
    if (b.action === "reveal") {
      reveal(ROOT);
      return out();
    }
    return NextResponse.json({ ok: false, error: "unknown action" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 400 });
  }
}
