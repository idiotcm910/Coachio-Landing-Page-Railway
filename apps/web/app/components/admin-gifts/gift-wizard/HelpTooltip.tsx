'use client';

/**
 * Self-contained CSS-only "?" help tooltip (mirrors the approved mockup's
 * .help/.tip). Shows on hover/focus; no JS state. Used to annotate the advanced
 * audience filters and the "How many & order" label.
 */
export function HelpTooltip({ text }: { text: string }) {
  return (
    <span className="group relative inline-grid h-[15px] w-[15px] cursor-help place-items-center rounded-full border border-[var(--coachio-admin-dashboard-border)] text-[10px] font-bold text-[var(--coachio-admin-dashboard-text-soft)] hover:border-[var(--coachio-admin-dashboard-accent)] hover:text-[var(--coachio-admin-dashboard-accent)]">
      ?
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[135%] left-1/2 z-50 w-52 -translate-x-1/2 translate-y-1 rounded-lg bg-slate-900 px-2.5 py-2 text-[11.5px] font-normal normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-lg transition-opacity duration-150 group-hover:translate-y-0 group-hover:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}
