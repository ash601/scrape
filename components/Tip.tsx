"use client";

// Hover anything wrapped in <Tip> (or its little "?") and a short line says what to do.
export default function Tip({ text, children, q = true }: { text: string; children?: React.ReactNode; q?: boolean }) {
  return (
    <span className="relative inline-flex items-center gap-1.5 group">
      {children}
      {q ? (
        <span className="w-4 h-4 rounded-full border border-white/20 text-[10px] leading-none grid place-items-center text-[color:var(--mist)] cursor-help select-none">?</span>
      ) : null}
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full mt-1.5 z-30 w-max max-w-[260px] rounded-md bg-[#2a1d17] border border-white/15 px-2.5 py-1.5 text-[12px] leading-snug text-[color:var(--warm-ivory)] shadow-xl opacity-0 translate-y-1 transition group-hover:opacity-100 group-hover:translate-y-0 group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
