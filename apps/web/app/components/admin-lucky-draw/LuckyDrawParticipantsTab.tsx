'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Download, Link2, Loader2, Lock, Plus, RefreshCw, Search, Trash2, Unlock, Users } from 'lucide-react';
import {
  adminLuckyEventsApi,
  getApiErrorMessage,
  type LuckyEvent,
  type LuckyParticipant,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { cardClass, ghostButtonClass, inputClass, labelClass, primaryButtonClass } from './luckyDrawStyles';

interface LuckyDrawParticipantsTabProps {
  event: LuckyEvent;
  onUpdated: (event: LuckyEvent) => void;
}

export function LuckyDrawParticipantsTab({ event, onUpdated }: LuckyDrawParticipantsTabProps) {
  const { success, error: toastError } = useToast();
  const [participants, setParticipants] = useState<LuckyParticipant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState(false);

  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [adding, setAdding] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [slug, setSlug] = useState(event.slug ?? '');
  const [savingSlug, setSavingSlug] = useState(false);

  const isOpen = event.status === 'open';

  // Re-seed the slug input when switching events.
  useEffect(() => {
    setSlug(event.slug ?? '');
  }, [event.id, event.slug]);

  // The public registration link prefers the slug; falls back to the token.
  const publicLinkKey = event.slug || event.public_token || '';
  const publicLinkPreview = publicLinkKey ? `${typeof window !== 'undefined' ? window.location.origin : ''}/draw/${publicLinkKey}` : '';

  // Input fields only (skip rich_text/image display blocks) — used to label answers.
  const inputFields = useMemo(
    () => (event.form_schema ?? []).filter((f) => f.type !== 'rich_text' && f.type !== 'image'),
    [event.form_schema],
  );

  function formatAnswer(raw: unknown): string {
    if (raw === null || raw === undefined || raw === '') return '—';
    if (Array.isArray(raw)) return raw.length ? raw.join(', ') : '—';
    return String(raw);
  }

  // Chuỗi tìm kiếm gộp: id + tên + SĐT + toàn bộ giá trị câu trả lời (gồm email).
  function searchBlob(p: LuckyParticipant): string {
    const answers = Object.values((p.answers ?? {}) as Record<string, unknown>).map((v) =>
      Array.isArray(v) ? v.join(' ') : String(v ?? ''),
    );
    return [p.id, p.display_name, p.phone ?? '', ...answers].join(' ').toLowerCase();
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return participants;
    return participants.filter((p) => searchBlob(p).includes(q));
  }, [participants, query]);

  function csvCell(value: unknown): string {
    const s = value === null || value === undefined ? '' : String(value);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function handleExport() {
    const headers = ['No.', 'ID', 'Display name', 'Phone', ...inputFields.map((f) => f.label || f.key), 'Source', 'Created at'];
    const rows = filtered.map((p, i) => {
      const answers = (p.answers ?? {}) as Record<string, unknown>;
      return [
        i + 1,
        p.id,
        p.display_name,
        p.phone ?? '',
        ...inputFields.map((f) => {
          const v = answers[f.key];
          return Array.isArray(v) ? v.join(', ') : v ?? '';
        }),
        p.source ?? '',
        p.created_at ?? '',
      ];
    });
    const csv = [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    // BOM để Excel đọc đúng tiếng Việt.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    const safeTitle = (event.title || 'event').replace(/[^\p{L}\p{N}]+/gu, '-');
    a.href = url;
    a.download = `participants-${safeTitle}-${stamp}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success(`Exported ${filtered.length} participants to Excel (CSV)`);
  }

  async function loadParticipants(silent = false) {
    if (silent) setRefreshing(true);
    try {
      const list = await adminLuckyEventsApi.listParticipants(event.id);
      setParticipants(list);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to load participants'));
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadParticipants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event.id]);

  async function handleToggleStatus() {
    setTogglingStatus(true);
    try {
      const updated = await adminLuckyEventsApi.setStatus(event.id, isOpen ? 'lock' : 'open');
      onUpdated(updated);
      success(updated.status === 'open' ? 'Registration opened' : 'Registration locked');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to change event status'));
    } finally {
      setTogglingStatus(false);
    }
  }

  async function handleCopyLink() {
    try {
      // Prefer the friendly slug; fall back to the (fetched) public token.
      let key = event.slug ?? '';
      if (!key) {
        const info = await adminLuckyEventsApi.getToken(event.id);
        key = info.public_token;
      }
      const url = `${window.location.origin}/draw/${key}`;
      await navigator.clipboard.writeText(url);
      success('Registration link copied');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to copy registration link'));
    }
  }

  async function handleSaveSlug() {
    setSavingSlug(true);
    try {
      const updated = await adminLuckyEventsApi.update(event.id, { slug: slug.trim() || null });
      onUpdated(updated);
      setSlug(updated.slug ?? '');
      success('Registration link updated');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to update registration link'));
    } finally {
      setSavingSlug(false);
    }
  }

  async function handleAdd() {
    if (!newName.trim()) {
      toastError('Display name is required');
      return;
    }
    setAdding(true);
    try {
      const created = await adminLuckyEventsApi.addParticipant(event.id, {
        display_name: newName.trim(),
        ...(newPhone.trim() ? { phone: newPhone.trim() } : {}),
      });
      setParticipants((prev) => [...prev, created]);
      setNewName('');
      setNewPhone('');
      success('Participant added');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to add participant'));
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(participant: LuckyParticipant) {
    try {
      await adminLuckyEventsApi.removeParticipant(event.id, participant.id);
      setParticipants((prev) => prev.filter((p) => p.id !== participant.id));
      success('Participant removed');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to remove participant'));
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${cardClass}`}>
        <div className="flex items-center gap-2 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">
          <Users className="h-5 w-5 text-[var(--coachio-admin-dashboard-text-soft)]" />
          {query.trim() ? `${filtered.length} / ${participants.length}` : participants.length} participants
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => loadParticipants(true)} disabled={refreshing} className={ghostButtonClass}>
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button type="button" onClick={handleCopyLink} className={ghostButtonClass}>
            <Link2 className="h-4 w-4" />
            Copy registration link
          </button>
          <button
            type="button"
            onClick={handleToggleStatus}
            disabled={togglingStatus}
            className={primaryButtonClass}
          >
            {togglingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : isOpen ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
            {isOpen ? 'Lock registration' : 'Open registration'}
          </button>
        </div>
      </div>

      {/* Custom link slug */}
      <div className={`flex flex-wrap items-end gap-3 ${cardClass}`}>
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className={labelClass}>Custom link slug (optional)</span>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-[var(--coachio-admin-dashboard-text-soft)]">/draw/</span>
            <input
              className={`${inputClass} min-w-0 flex-1`}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="feedback-workshop"
            />
          </div>
          <span className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
            Lowercase letters, numbers and hyphens. Leave blank to use the default link.
          </span>
        </label>
        <button type="button" onClick={handleSaveSlug} disabled={savingSlug} className={primaryButtonClass}>
          {savingSlug ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          Save link
        </button>
      </div>
      {publicLinkPreview && (
        <p className="px-1 text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
          Public link: <span className="font-mono text-[var(--coachio-admin-dashboard-text)]">{publicLinkPreview}</span>
        </p>
      )}

      {/* Search + Export */}
      <div className={`flex flex-wrap items-center gap-3 ${cardClass}`}>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--coachio-admin-dashboard-text-soft)]" />
          <input
            className={`${inputClass} w-full pl-9`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, name, phone, email…"
          />
        </div>
        <button type="button" onClick={handleExport} disabled={filtered.length === 0} className={ghostButtonClass}>
          <Download className="h-4 w-4" />
          Export Excel
        </button>
      </div>

      {/* Manual add */}
      <div className={`flex flex-wrap items-end gap-3 ${cardClass}`}>
        <label className="flex flex-1 flex-col gap-1">
          <span className={labelClass}>Display name</span>
          <input className={inputClass} value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Nguyễn Văn A" />
        </label>
        <label className="flex w-48 flex-col gap-1">
          <span className={labelClass}>Phone (optional)</span>
          <input className={inputClass} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="0901234567" />
        </label>
        <button type="button" onClick={handleAdd} disabled={adding} className={primaryButtonClass}>
          {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add participant
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex items-center gap-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading participants…
        </div>
      ) : participants.length === 0 ? (
        <div className={`${cardClass} text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]`}>No participants yet.</div>
      ) : filtered.length === 0 ? (
        <div className={`${cardClass} text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]`}>
          No participants match “{query}”.
        </div>
      ) : (
        <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)]">
          {filtered.map((p, i) => {
            const answers = (p.answers ?? {}) as Record<string, unknown>;
            const hasAnswers = Object.keys(answers).length > 0;
            const expanded = expandedId === p.id;
            return (
              <div
                key={p.id}
                className={`${i % 2 ? 'bg-[var(--coachio-admin-dashboard-surface-muted)]' : 'bg-[var(--coachio-admin-dashboard-surface)]'}`}
              >
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{p.display_name}</p>
                    <p className="text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
                      <span className="font-mono" title={p.id}>#{p.id.slice(0, 8)}</span>
                      {p.phone ? ` · ${p.phone}` : ''}
                      {p.source ? ` · ${p.source}` : ''}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {hasAnswers && (
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : p.id)}
                        className={ghostButtonClass}
                        aria-expanded={expanded}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        {expanded ? 'Hide answers' : 'View answers'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemove(p)}
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-danger-text)] transition hover:bg-[var(--coachio-admin-dashboard-danger-bg)]"
                      aria-label="Remove participant"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                {expanded && hasAnswers && (
                  <div className="border-t border-[var(--coachio-admin-dashboard-border)] px-4 py-3">
                    <dl className="grid gap-2 sm:grid-cols-2">
                      {inputFields.map((field) => (
                        <div key={field.key} className="min-w-0">
                          <dt className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">{field.label || field.key}</dt>
                          <dd className="break-words text-sm text-[var(--coachio-admin-dashboard-text)]">{formatAnswer(answers[field.key])}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
