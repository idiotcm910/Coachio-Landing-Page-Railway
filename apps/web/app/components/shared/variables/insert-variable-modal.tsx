'use client';

/**
 * InsertVariableModal — a reusable dialog for inserting merge variables into an
 * HTML editor. Generic over the variable set: callers pass `variables`
 * ({ key, label, group }) and an `onInsert(token)` handler.
 *
 * Shared by the funnel email editor and the funnel checkout editor (and any other
 * editor that renders {{tokens}} server-side).
 *
 * Interaction:
 *   - Click a variable  → insert {{token}} at the cursor; modal stays open for more.
 *   - Copy icon         → copy {{token}} to the clipboard (does not insert).
 *   - Search + tabs      → filter by label/token, or by group.
 */

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, Plus, Search, X } from 'lucide-react';
import { useToast } from '../toast';

export interface InsertVariable {
  key: string;
  label: string;
  group: string;
  /** Optional admin-authored description (shown under the token). */
  description?: string | null;
  /** Literal text to insert/copy and display. Defaults to `{{key}}`. */
  token?: string;
}

export interface InsertVariableGroupMeta {
  title: string;
  hint?: string;
  order: number;
  /** When true the group's tab is always shown, even with zero variables. */
  alwaysShow?: boolean;
}

interface InsertVariableModalProps {
  open: boolean;
  onClose: () => void;
  variables: InsertVariable[];
  /**
   * Insert the token at the cursor in the target editor. When omitted the modal
   * runs in copy-only mode (no cursor target) — clicking a row copies it.
   */
  onInsert?: (token: string) => void;
  /** Optional per-group display config. Unknown groups fall back to a generic label. */
  groupMeta?: Record<string, InsertVariableGroupMeta>;
  title?: string;
  subtitle?: string;
}

const DEFAULT_GROUP_META: Record<string, InsertVariableGroupMeta> = {
  funnel: { title: 'Funnel & Product', hint: 'Product name, prices, links', order: 0 },
  order: { title: 'Order & Customer', hint: 'Buyer, order code, payment', order: 1 },
  custom: { title: 'Custom variables', hint: 'Your own funnel variables', order: 2, alwaysShow: true },
};

export function InsertVariableModal({
  open,
  onClose,
  variables,
  onInsert,
  groupMeta = DEFAULT_GROUP_META,
  title = 'Insert a variable',
  subtitle,
}: InsertVariableModalProps) {
  const [query, setQuery] = useState('');
  const [activeTab, setActiveTab] = useState<string>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [insertedKey, setInsertedKey] = useState<string | null>(null);
  const { success } = useToast();

  const metaFor = (group: string) => groupMeta[group] ?? { title: group, hint: '', order: 99 };
  const tokenFor = (v: InsertVariable) => v.token ?? `{{${v.key}}}`;
  const resolvedSubtitle =
    subtitle ??
    (onInsert
      ? 'Click an item to insert it at the cursor. The modal stays open so you can add several.'
      : 'Click an item to copy it, then paste it into the editor.');

  // ESC to close + body scroll lock + reset search/tab each time it opens.
  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveTab('all');
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Per-group counts drive the tab badges.
  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const v of variables) c[v.group] = (c[v.group] ?? 0) + 1;
    return c;
  }, [variables]);

  // Tabs: 'all' + groups present, plus any group flagged alwaysShow. Ordered by meta.order.
  const tabs = useMemo(() => {
    const present = new Set(variables.map((v) => v.group));
    Object.entries(groupMeta).forEach(([g, m]) => { if (m.alwaysShow) present.add(g); });
    const groups = [...present].sort((a, b) => metaFor(a).order - metaFor(b).order);
    return ['all', ...groups];
  }, [variables, groupMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter by tab + search, then bucket by group preserving a stable section order.
  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = variables.filter((v) => {
      if (activeTab !== 'all' && v.group !== activeTab) return false;
      if (!q) return true;
      return (
        v.key.toLowerCase().includes(q) ||
        v.label.toLowerCase().includes(q) ||
        tokenFor(v).toLowerCase().includes(q)
      );
    });
    const buckets = new Map<string, InsertVariable[]>();
    for (const v of filtered) {
      const arr = buckets.get(v.group) ?? [];
      arr.push(v);
      buckets.set(v.group, arr);
    }
    return [...buckets.entries()]
      .map(([group, items]) => ({ group, items, ...metaFor(group) }))
      .sort((a, b) => a.order - b.order);
  }, [variables, query, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleInsert(v: InsertVariable) {
    if (!onInsert) { void handleCopy(v); return; }
    onInsert(tokenFor(v));
    setInsertedKey(v.key);
    setTimeout(() => setInsertedKey((k) => (k === v.key ? null : k)), 900);
  }

  async function handleCopy(v: InsertVariable) {
    const token = tokenFor(v);
    try {
      await navigator.clipboard.writeText(token);
      setCopiedKey(v.key);
      success(`Đã sao chép ${token}`);
      setTimeout(() => setCopiedKey((k) => (k === v.key ? null : k)), 1500);
    } catch {
      /* clipboard unavailable — click-to-insert still works */
    }
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="flex max-h-[80vh] w-full max-w-[880px] flex-col overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-lg,0_20px_60px_rgba(0,0,0,0.3))]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--coachio-admin-dashboard-border)] px-5 py-4">
          <div>
            <p className="m-0 text-[15px] font-bold text-[var(--coachio-admin-dashboard-text)]">{title}</p>
            <p className="m-0 mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{resolvedSubtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex shrink-0 items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] p-1 text-[var(--coachio-admin-dashboard-text-muted)] hover:bg-[var(--coachio-admin-dashboard-surface-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"
          >
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* Search + tabs */}
        <div className="border-b border-[var(--coachio-admin-dashboard-border)] px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--coachio-admin-dashboard-text-muted)]" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search variables…"
              aria-label="Search variables"
              className="h-9 w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] pl-8 pr-3 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
            />
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {tabs.map((t) => {
              const isActive = t === activeTab;
              const tabLabel = t === 'all' ? 'All' : metaFor(t).title;
              const tabCount = t === 'all' ? variables.length : counts[t] ?? 0;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setActiveTab(t)}
                  className={
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition ' +
                    (isActive
                      ? 'border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)]'
                      : 'border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-text-muted)] hover:border-[var(--coachio-admin-dashboard-accent)]')
                  }
                >
                  {tabLabel}
                  <span className={isActive ? 'opacity-80' : 'opacity-60'}>{tabCount}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {sections.length === 0 ? (
            activeTab === 'custom' && (counts.custom ?? 0) === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">No custom variables yet</p>
                <p className="mx-auto mt-1 max-w-md text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
                  Define custom variables in the funnel’s “Variables” settings. Once added, they appear here and can be
                  inserted into this editor.
                </p>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
                No variables match “{query}”.
              </p>
            )
          ) : (
            <div className="flex flex-col gap-4">
              {sections.map((section) => (
                <div key={section.group}>
                  {activeTab === 'all' && (
                    <div className="mb-2 flex items-baseline gap-2">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
                        {section.title}
                      </span>
                      {section.hint && (
                        <span className="text-[11px] text-[var(--coachio-admin-dashboard-text-muted)]">{section.hint}</span>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {section.items.map((v) => (
                      <div
                        key={v.key}
                        className="group/var flex items-start justify-between gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2 transition hover:border-[var(--coachio-admin-dashboard-accent)] hover:bg-[var(--coachio-admin-dashboard-surface-muted)]"
                      >
                        {/* Click body → insert at cursor (or copy in copy-only mode) */}
                        <button
                          type="button"
                          onClick={() => handleInsert(v)}
                          title={onInsert ? `${v.label} — insert ${tokenFor(v)}` : `${v.label} — copy ${tokenFor(v)}`}
                          className="flex min-w-0 flex-1 flex-col items-start text-left"
                        >
                          <span className="line-clamp-2 w-full break-words text-[13px] font-semibold leading-snug text-[var(--coachio-admin-dashboard-text)]">
                            {v.label}
                          </span>
                          <code className="mt-0.5 w-full break-all font-mono text-xs text-[var(--coachio-admin-dashboard-accent)]">
                            {tokenFor(v)}
                          </code>
                          {v.description && (
                            <span className="mt-1 line-clamp-2 w-full break-words text-[11px] leading-snug text-[var(--coachio-admin-dashboard-text-muted)]">
                              {v.description}
                            </span>
                          )}
                        </button>
                        {/* Insert / copy actions */}
                        <div className="flex shrink-0 items-center gap-0.5 pt-0.5">
                          {insertedKey === v.key ? (
                            <span className="flex items-center gap-1 px-1 text-[11px] font-semibold text-[var(--coachio-admin-dashboard-success-text)]">
                              <Check className="h-3.5 w-3.5" /> Inserted
                            </span>
                          ) : (
                            <>
                              {onInsert && (
                                <button
                                  type="button"
                                  onClick={() => handleInsert(v)}
                                  aria-label={`Insert ${tokenFor(v)}`}
                                  title="Insert at cursor"
                                  className="rounded p-1 text-[var(--coachio-admin-dashboard-text-muted)] opacity-60 transition hover:bg-[var(--coachio-admin-dashboard-surface-muted)] hover:text-[var(--coachio-admin-dashboard-accent)] group-hover/var:opacity-100"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleCopy(v)}
                                aria-label={`Copy ${tokenFor(v)}`}
                                title="Copy"
                                className="rounded p-1 text-[var(--coachio-admin-dashboard-text-muted)] opacity-60 transition hover:bg-[var(--coachio-admin-dashboard-surface-muted)] hover:text-[var(--coachio-admin-dashboard-text)] group-hover/var:opacity-100"
                              >
                                {copiedKey === v.key ? (
                                  <Check className="h-3.5 w-3.5 text-[var(--coachio-admin-dashboard-success-text)]" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[var(--coachio-admin-dashboard-border)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)]"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
