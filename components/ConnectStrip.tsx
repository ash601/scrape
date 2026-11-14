"use client";

// The key row on top: ✓ Apify key when it works, ○ Apify key + "add" when it doesn't.

import { useState } from "react";
import Tip from "./Tip";

export type PublicConfig = {
  hasKey: boolean;
  check?: { ok: boolean; status: string; user?: string; checkedAt: number };
  max?: number;
  root: string;
};

const KEY_LINK = "https://console.apify.com/settings/integrations";
const smallBtn =
  "text-[12px] px-2.5 py-1.5 border border-white/10 rounded-md text-[color:var(--mist)] hover:text-[color:var(--warm-ivory)] hover:border-white/25 disabled:opacity-40 disabled:cursor-not-allowed";
const link = "text-[12px] text-[color:var(--hot-ember)] hover:underline";

const post = (body: object) => fetch("/api/connect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.json());

export const keyOk = (c?: PublicConfig | null) => !!c?.hasKey && !!c?.check?.ok;

export default function ConnectStrip({ cfg, onChange }: { cfg: PublicConfig | null; onChange: (c: PublicConfig) => void }) {
  const [busy, setBusy] = useState("");
  const [key, setKey] = useState("");
  const [err, setErr] = useState("");
  const [open, setOpen] = useState(false);
  const ok = keyOk(cfg);

  const act = async (what: string, body: object) => {
    setBusy(what);
    setErr("");
    try {
      const j = await post(body);
      if (j.config) onChange(j.config);
      if (j.result && !j.result.ok) setErr(j.result.status);
      return j;
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const save = async () => {
    const j = await act("key", { action: "save-key", key });
    if (j?.result?.ok) {
      setKey("");
      setOpen(false);
    }
  };

  return (
    <section className="glass-flat rounded-xl px-4 py-3 mb-6 flex flex-col gap-2">
      <div className="flex items-center gap-3 flex-wrap">
        <Tip text="Your Apify key lets this app fetch the comments. Click add, paste it, Save.">
        <span className="flex items-center gap-2 text-[14px]">
          <span className={ok ? "text-emerald-300" : "text-[color:var(--mist)]"}>{ok ? "✓" : "○"}</span>
          <span className={ok ? "text-[color:var(--warm-ivory)]" : "text-[color:var(--mist)]"}>Apify key</span>
        </span>
        </Tip>
        <button className={link} onClick={() => setOpen((v) => !v)}>{ok ? "change" : "add"}</button>
        <button className="ml-auto text-[12px] text-[color:var(--mist)] hover:text-[color:var(--warm-ivory)] disabled:opacity-40" disabled={!!busy || !cfg?.hasKey} onClick={() => act("check", { action: "check-key" })}>
          {busy === "check" ? "checking…" : "check again"}
        </button>
      </div>
      {open || (!ok && cfg && !cfg.hasKey) ? (
        <div className="flex gap-1.5 items-center flex-wrap">
          <input
            type="password"
            autoComplete="off"
            autoFocus={open}
            className="field flex-1 min-w-[220px] rounded-md px-2.5 py-1.5 text-[13px]"
            placeholder="Paste your Apify key"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && key.trim() && save()}
          />
          <button className={smallBtn} disabled={!key.trim() || !!busy} onClick={save}>{busy === "key" ? "Checking…" : "Save"}</button>
          <Tip q={false} text="Free: apify.com → sign up → Settings → API & Integrations → copy the token."><a className={link} href={KEY_LINK} target="_blank" rel="noreferrer">get a key</a></Tip>
        </div>
      ) : null}
      {err ? <div className="text-[12px] text-[#fca5a5]">{err}</div> : null}
    </section>
  );
}
