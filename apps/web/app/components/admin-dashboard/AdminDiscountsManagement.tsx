'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Globe, Loader2, Plus, Pencil, Trash2, Star, X, ChevronDown, Lock } from 'lucide-react';
import {
  adminDiscountsApi, adminFunnelsApi, getApiErrorMessage,
  type Discount, type DiscountInput, type DiscountType, type DiscountUpdateInput,
  type DiscountDefaultActivationInput, type DiscountDefaultOwner, type DiscountScopeOwner,
  type Funnel,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { DateTimeField } from '../shared/date-time-field';
import { Checkbox } from '../shared/checkbox';

const DISCOUNT_TYPE_LABELS: Record<DiscountType, string> = {
  percent: 'Percentage (%)',
  fixed: 'Fixed (VND)',
};

function emptyForm(): DiscountInput {
  return { code: '', discount_type: 'percent', discount_value: 0, is_active: true, starts_at: null, ends_at: null, max_redemptions: null, scopes: [] };
}

type ScopeEntry = { owner_type: 'funnel'; owner_id: string };

/**
 * System-admin global Discounts page: manage the global discount pool (CRUD) and,
 * for each discount, set/unset it as a DEFAULT for any funnel or course.
 */
export function AdminDiscountsManagement() {
  const [discounts, setDiscounts] = useState<Discount[]>([]);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<DiscountInput>(emptyForm());
  // Scopes selected in the form (create or edit)
  const [formScopes, setFormScopes] = useState<ScopeEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // Detailed dialog shown when the default⊆scope invariant is violated (clearer than a toast).
  const [scopeIssue, setScopeIssue] = useState<string | null>(null);
  // Defaults chosen inline while CREATING a new code (one-step: create + assign)
  const [createDefaults, setCreateDefaults] = useState<DiscountDefaultActivationInput[]>([]);
  const [createPickerId, setCreatePickerId] = useState('');
  // Per-discount default-owner management
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [defaultsByDiscount, setDefaultsByDiscount] = useState<Record<string, DiscountDefaultOwner[]>>({});
  const [pickerId, setPickerId] = useState('');
  const [busyDefault, setBusyDefault] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    Promise.all([
      adminDiscountsApi.list(),
      adminFunnelsApi.list().catch(() => [] as Funnel[]),
    ])
      .then(([d, f]) => { if (mounted) { setDiscounts(d); setFunnels(f); } })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Failed to load discounts')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  function openCreate() {
    setForm(emptyForm()); setEditingId(null); setFormError('');
    setFormScopes([]);
    setCreateDefaults([]); setCreatePickerId('');
    setShowForm(true);
  }

  function ownerLabel(owner: DiscountDefaultActivationInput | ScopeEntry): string {
    return funnels.find((o) => o.id === owner.owner_id)?.title ?? owner.owner_id;
  }

  function addCreateDefault() {
    if (!createPickerId) return;
    setCreateDefaults((prev) =>
      prev.some((o) => o.owner_type === 'funnel' && o.owner_id === createPickerId)
        ? prev
        : [...prev, { owner_type: 'funnel', owner_id: createPickerId }],
    );
    setCreatePickerId('');
  }

  function removeCreateDefault(owner: DiscountDefaultActivationInput) {
    setCreateDefaults((prev) => prev.filter((o) => !(o.owner_type === owner.owner_type && o.owner_id === owner.owner_id)));
  }

  /** Toggle a funnel/course in the formScopes list. */
  function toggleScope(entry: ScopeEntry) {
    setFormScopes((prev) => {
      const exists = prev.some((s) => s.owner_type === entry.owner_type && s.owner_id === entry.owner_id);
      return exists
        ? prev.filter((s) => !(s.owner_type === entry.owner_type && s.owner_id === entry.owner_id))
        : [...prev, entry];
    });
  }

  function openEdit(d: Discount) {
    setForm({ code: d.code, discount_type: d.discount_type, discount_value: d.discount_value, is_active: d.is_active, starts_at: d.starts_at ?? null, ends_at: d.ends_at ?? null, max_redemptions: d.max_redemptions ?? null });
    // Filter to funnel scopes only (course scopes not supported in this product).
    setFormScopes((d.scopes ?? []).filter((s) => s.owner_type === 'funnel').map((s) => ({ owner_type: 'funnel' as const, owner_id: s.owner_id })));
    setEditingId(d.id); setFormError(''); setShowForm(true);
  }

  async function handleSave() {
    if (!form.code.trim()) { setFormError('Discount code is required.'); return; }
    setSaving(true); setFormError('');
    try {
      if (editingId) {
        const payload: DiscountUpdateInput = { ...form, scopes: formScopes };
        const updated = await adminDiscountsApi.update(editingId, payload);
        setDiscounts((prev) => prev.map((d) => (d.id === editingId ? updated : d)));
        success('Đã cập nhật mã giảm giá');
      } else {
        const payload: DiscountInput = { ...form, defaults: createDefaults, scopes: formScopes };
        const created = await adminDiscountsApi.create(payload);
        setDiscounts((prev) => [created, ...prev]);
        // Seed the defaults cache so expanding the new code shows them immediately
        if (createDefaults.length) {
          setDefaultsByDiscount((prev) => ({
            ...prev,
            [created.id]: createDefaults.map((o) => ({ ...o, owner_name: ownerLabel(o) })),
          }));
        }
        success(
          createDefaults.length
            ? `Đã tạo mã giảm giá và đặt mặc định cho ${createDefaults.length} mục`
            : 'Đã tạo mã giảm giá',
        );
      }
      setShowForm(false);
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save discount code');
      // The default⊆scope conflict gets a detailed dialog instead of a terse toast.
      if (/scope/i.test(msg)) { setScopeIssue(msg); }
      else { setFormError(msg); toastError(msg); }
    } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this discount code?')) return;
    try {
      await adminDiscountsApi.remove(id);
      setDiscounts((prev) => prev.filter((d) => d.id !== id));
      success('Đã xóa mã giảm giá');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Delete failed');
      setError(msg); toastError(msg);
    }
  }

  async function toggleDefaults(id: string) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    setPickerId('');
    if (!defaultsByDiscount[id]) {
      try {
        const rows = await adminDiscountsApi.listDefaults(id);
        setDefaultsByDiscount((prev) => ({ ...prev, [id]: rows }));
      } catch (e) { toastError(getApiErrorMessage(e, 'Failed to load defaults')); }
    }
  }

  async function addDefault(discountId: string) {
    if (!pickerId) return;
    // No client-side scope filtering: let the admin pick any funnel. If it's outside
    // the discount's scope, the API returns 422 and we open the detailed dialog below.
    setBusyDefault(true);
    try {
      await adminDiscountsApi.setDefault(discountId, { ownerType: 'funnel', ownerId: pickerId });
      const rows = await adminDiscountsApi.listDefaults(discountId);
      setDefaultsByDiscount((prev) => ({ ...prev, [discountId]: rows }));
      setPickerId('');
      success('Đã đặt làm mặc định cho funnel này');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to set default');
      if (/scope/i.test(msg)) { setScopeIssue(msg); }
      else { toastError(msg); }
    }
    finally { setBusyDefault(false); }
  }

  async function removeDefault(discountId: string, owner: DiscountDefaultOwner) {
    setBusyDefault(true);
    try {
      await adminDiscountsApi.unsetDefault(discountId, { ownerType: owner.owner_type, ownerId: owner.owner_id });
      setDefaultsByDiscount((prev) => ({
        ...prev,
        [discountId]: (prev[discountId] ?? []).filter((o) => !(o.owner_type === owner.owner_type && o.owner_id === owner.owner_id)),
      }));
      success('Đã bỏ mặc định');
    } catch (e) { toastError(getApiErrorMessage(e, 'Failed to remove default')); }
    finally { setBusyDefault(false); }
  }

  const inputClass = 'rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';

  /** Render the "Applicable to" scope selector in the form. */
  function renderScopeSelector() {
    return (
      <div className="mt-4 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">Applicable to</p>
            <p className="mt-0.5 text-[11px] text-[var(--coachio-admin-dashboard-text-muted)]">
              Leave empty to allow this code on all funnels (global).
            </p>
          </div>
          {formScopes.length === 0
            ? <span className="inline-flex items-center gap-1 rounded-full border border-[var(--coachio-admin-dashboard-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--coachio-admin-dashboard-text-muted)]"><Globe className="h-3 w-3" /> Global</span>
            : <span className="text-[11px] font-semibold text-[var(--coachio-admin-dashboard-accent)]">{formScopes.length} selected</span>
          }
        </div>

        {/* Selected chips */}
        {formScopes.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {formScopes.map((s) => (
              <span key={`${s.owner_type}-${s.owner_id}`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)]">
                <span className="text-[10px] uppercase opacity-70">Funnel</span>
                {ownerLabel(s)}
                <button type="button" onClick={() => toggleScope(s)} aria-label={`Remove ${ownerLabel(s)}`} className="rounded-full p-0.5 hover:bg-[var(--coachio-admin-dashboard-danger-bg)] hover:text-[var(--coachio-admin-dashboard-danger-text)]"><X className="h-3 w-3" /></button>
              </span>
            ))}
          </div>
        )}

        {/* Funnel checklist */}
        {funnels.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Funnels</p>
            <div className="max-h-36 overflow-y-auto rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-1">
              {funnels.map((f) => {
                const checked = formScopes.some((s) => s.owner_type === 'funnel' && s.owner_id === f.id);
                return (
                  <Checkbox
                    key={f.id}
                    checked={checked}
                    onChange={() => toggleScope({ owner_type: 'funnel', owner_id: f.id })}
                    label={f.title}
                    className="w-full rounded px-2 py-1.5 hover:bg-[var(--coachio-admin-dashboard-surface-muted)]"
                  />
                );
              })}
            </div>
          </div>
        )}

      </div>
    );
  }

  /** Inline scope badge(s) shown in the discount list row. */
  function renderScopeBadge(d: Discount) {
    if (!d.scopes || d.scopes.length === 0) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full border border-[var(--coachio-admin-dashboard-border)] px-2 py-0.5 text-[11px] font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          <Globe className="h-3 w-3" /> Global
        </span>
      );
    }
    const funnelCount = d.scopes.filter((s) => s.owner_type === 'funnel').length;
    const parts: string[] = [];
    if (funnelCount) parts.push(`${funnelCount} funnel${funnelCount > 1 ? 's' : ''}`);
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--coachio-admin-dashboard-accent)]" title={d.scopes.map((s) => resolveScopeName(s)).join(', ')}>
        <Lock className="h-3 w-3" /> {parts.join(' + ')}
      </span>
    );
  }

  /** Resolve display name for a scope entry using the loaded funnel catalog. */
  function resolveScopeName(s: DiscountScopeOwner): string {
    if (s.owner_name) return s.owner_name;
    return funnels.find((o) => o.id === s.owner_id)?.title ?? s.owner_id;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Discounts</h3>
          <p className="mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
            Global discount pool. Set "Applicable to" to restrict a code to specific funnels/courses. Expand a code to configure auto-apply defaults.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)]">
          <Plus className="h-4 w-4" /> New code
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--coachio-admin-dashboard-accent)]" /> Loading...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {showForm && (
        <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <h4 className="mb-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{editingId ? 'Edit discount code' : 'Create discount code'}</h4>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Code *</span>
              <input className={`${inputClass} uppercase`} value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="SALE20" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Discount type</span>
              <select className={inputClass} value={form.discount_type} onChange={(e) => setForm((f) => ({ ...f, discount_type: e.target.value as DiscountType }))}>
                {Object.entries(DISCOUNT_TYPE_LABELS).map(([v, l]) => (<option key={v} value={v}>{l}</option>))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Discount value</span>
              <input type="number" className={inputClass} value={form.discount_value} onChange={(e) => setForm((f) => ({ ...f, discount_value: Number(e.target.value) }))} />
            </label>
            <DateTimeField label="Starts at" value={form.starts_at ?? ''} onChange={(v) => setForm((f) => ({ ...f, starts_at: v || null }))} />
            <DateTimeField label="Ends at" value={form.ends_at ?? ''} onChange={(v) => setForm((f) => ({ ...f, ends_at: v || null }))} />
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Max redemptions</span>
              <input type="number" className={inputClass} value={form.max_redemptions ?? ''} onChange={(e) => setForm((f) => ({ ...f, max_redemptions: e.target.value ? Number(e.target.value) : null }))} placeholder="Unlimited" />
            </label>
            <div className="flex items-center">
              <Checkbox
                checked={form.is_active ?? true}
                onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
                label="Active"
              />
            </div>
          </div>

          {/* ── Applicable to (scope) — DISTINCT from auto-apply defaults ── */}
          {renderScopeSelector()}

          {/* ── Auto-apply defaults (only for create) ── */}
          {!editingId && (
            <div className="mt-4 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] p-3">
              <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">Auto-apply as default for (optional)</p>
              <p className="mt-0.5 text-[11px] text-[var(--coachio-admin-dashboard-text-muted)]">
                The code will auto-apply at checkout for the funnels/courses listed here. This is separate from "Applicable to" — a default must also be within scope.
              </p>
              {createDefaults.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {createDefaults.map((o) => (
                    <span key={`${o.owner_type}-${o.owner_id}`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)]">
                      <span className="text-[10px] uppercase opacity-70">Funnel</span>
                      {ownerLabel(o)}
                      <button type="button" onClick={() => removeCreateDefault(o)} className="rounded-full p-0.5 hover:bg-[var(--coachio-admin-dashboard-danger-bg)] hover:text-[var(--coachio-admin-dashboard-danger-text)]" aria-label={`Remove ${ownerLabel(o)}`}><X className="h-3 w-3" /></button>
                    </span>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-end gap-2">
                <select className={`${inputClass} min-w-[220px]`} value={createPickerId} onChange={(e) => setCreatePickerId(e.target.value)}>
                  <option value="">Select funnel...</option>
                  {funnels
                    // Show all funnels (even out-of-scope) — the save call validates and
                    // surfaces a detailed dialog if a default is outside the scope.
                    .filter((o) => !createDefaults.some((d) => d.owner_type === 'funnel' && d.owner_id === o.id))
                    .map((o) => (<option key={o.id} value={o.id}>{o.title}</option>))}
                </select>
                <button type="button" disabled={!createPickerId} onClick={addCreateDefault} className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50">
                  <Plus className="h-4 w-4" /> Add
                </button>
              </div>
            </div>
          )}

          {formError && <p className="mt-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{formError}</p>}
          <div className="mt-4 flex gap-3">
            <button type="button" onClick={handleSave} disabled={saving} className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}{editingId ? 'Save changes' : 'Create code'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="inline-flex h-9 items-center px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">Cancel</button>
          </div>
        </div>
      )}

      {!isLoading && (
        <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          {discounts.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)]">No discount codes yet.</p>
          ) : discounts.map((d) => (
            <div key={d.id} className="border-b border-[var(--coachio-admin-dashboard-border-subtle)] last:border-b-0">
              <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                <code className="min-w-0 break-all text-xs font-bold text-[var(--coachio-admin-dashboard-accent)]">{d.code}</code>
                <span className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{DISCOUNT_TYPE_LABELS[d.discount_type]}</span>
                <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{d.discount_type === 'percent' ? `${d.discount_value}%` : `${d.discount_value.toLocaleString('vi-VN')}₫`}</span>
                <span className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">Used {d.redeemed_count}</span>
                <span className={`text-xs font-semibold ${d.is_active ? 'text-[var(--coachio-admin-dashboard-success-text)]' : 'text-[var(--coachio-admin-dashboard-text-muted)]'}`}>{d.is_active ? 'On' : 'Off'}</span>
                {/* Applicable to — scope badge */}
                {renderScopeBadge(d)}
                <div className="ml-auto flex gap-2">
                  <button type="button" onClick={() => toggleDefaults(d.id)} className="inline-flex h-7 items-center gap-1 rounded border border-[var(--coachio-admin-dashboard-border)] px-2 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-accent)]">
                    <Star className="h-3.5 w-3.5" /> Auto-apply <ChevronDown className={`h-3.5 w-3.5 transition ${expandedId === d.id ? 'rotate-180' : ''}`} />
                  </button>
                  <button type="button" onClick={() => openEdit(d)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"><Pencil className="h-3.5 w-3.5" /></button>
                  <button type="button" onClick={() => handleDelete(d.id)} className="inline-flex h-7 w-7 items-center justify-center rounded border border-[var(--coachio-admin-dashboard-danger-border)] text-[var(--coachio-admin-dashboard-danger-text)]"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>

              {expandedId === d.id && (() => {
                const owners = defaultsByDiscount[d.id] ?? [];
                const funnelDefaults = owners.filter((o) => o.owner_type === 'funnel');
                const renderChip = (o: DiscountDefaultOwner) => (
                  <span key={`${o.owner_type}-${o.owner_id}`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--coachio-admin-dashboard-accent)]">
                    {o.owner_name ?? o.owner_id}
                    <button type="button" disabled={busyDefault} onClick={() => removeDefault(d.id, o)} className="rounded-full p-0.5 hover:bg-[var(--coachio-admin-dashboard-danger-bg)] hover:text-[var(--coachio-admin-dashboard-danger-text)]" aria-label={`Remove ${o.owner_name ?? o.owner_id}`}><X className="h-3 w-3" /></button>
                  </span>
                );
                return (
                  <div className="space-y-4 border-t border-[var(--coachio-admin-dashboard-border-subtle)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-4 py-4">
                    <div>
                      <p className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
                        Auto-apply as default in <span className="text-[var(--coachio-admin-dashboard-accent)]">{owners.length}</span> place{owners.length === 1 ? '' : 's'}
                      </p>
                      <p className="mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
                        This code auto-applies at checkout for each place listed here. Distinct from "Applicable to" scope — a default must also be within scope.
                      </p>
                    </div>

                    {owners.length === 0 ? (
                      <p className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-dashed border-[var(--coachio-admin-dashboard-border)] px-3 py-2 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
                        Not a default anywhere yet. Pick a funnel below and click "Add".
                      </p>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        {funnelDefaults.length ? funnelDefaults.map(renderChip) : <span className="text-xs text-[var(--coachio-admin-dashboard-text-muted)]">—</span>}
                      </div>
                    )}

                    {/* Add control */}
                    <div className="rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-3">
                      <p className="mb-2 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)]">Add a funnel</p>
                      {d.scopes?.length ? (
                        <p className="mb-2 text-[11px] text-[var(--coachio-admin-dashboard-text-muted)]">
                          This code is scoped. Picking a funnel outside its scope will be rejected on save with an explanation.
                        </p>
                      ) : null}
                      <div className="flex flex-wrap items-end gap-2">
                        <select className={`${inputClass} min-w-[220px]`} value={pickerId} onChange={(e) => setPickerId(e.target.value)}>
                          <option value="">Select funnel...</option>
                          {funnels.map((o) => (
                            <option key={o.id} value={o.id}>{o.title}</option>
                          ))}
                        </select>
                        <button type="button" disabled={!pickerId || busyDefault} onClick={() => addDefault(d.id)} className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50">
                          {busyDefault ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          ))}
        </div>
      )}
      {/* Detailed dialog: default⊆scope conflict — clearer guidance than a toast. */}
      {scopeIssue && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4" role="presentation">
          <button
            type="button"
            aria-label="Close dialog"
            className="absolute inset-0 cursor-default bg-slate-950/50 backdrop-blur-sm"
            onClick={() => setScopeIssue(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-5 shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <AlertCircle className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">
                  Default vs. Applicable scope conflict
                </h3>
                <p className="mt-1 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
                  Couldn&apos;t save: an owner is set to <b>auto-apply (default)</b> but is{' '}
                  <b>not included</b> in this code&apos;s “Applicable to” scope.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setScopeIssue(null)}
                aria-label="Close"
                className="ml-auto rounded-full p-1 text-[var(--coachio-admin-dashboard-text-muted)] hover:bg-[var(--coachio-admin-dashboard-surface-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Exact reason from the server (names the conflicting owner). */}
            <div className="mt-3 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
              {scopeIssue}
            </div>

            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
                How to fix (pick one)
              </p>
              <ul className="mt-2 space-y-2">
                {[
                  <>Add that owner to <b>“Applicable to”</b> so it&apos;s both allowed and auto-applied.</>,
                  <>Remove that owner from <b>“Auto-apply as default”</b> first, then narrow the scope.</>,
                  <>Leave <b>“Applicable to” empty</b> (Global) — then any default is valid.</>,
                ].map((text, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-[var(--coachio-admin-dashboard-text)]">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--coachio-admin-dashboard-accent-soft)] text-[11px] font-bold text-[var(--coachio-admin-dashboard-accent)]">
                      {i + 1}
                    </span>
                    <span>{text}</span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="mt-4 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-[11px] text-[var(--coachio-admin-dashboard-text-muted)]">
              Rule: every “Auto-apply as default” owner must be within “Applicable to” (default ⊆ scope). An empty scope applies everywhere.
            </p>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setScopeIssue(null)}
                className="inline-flex h-9 items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] hover:bg-[var(--coachio-admin-dashboard-accent-hover)]"
              >
                Got it
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
