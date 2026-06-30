'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Copy, GitBranch, Loader2, Plus } from 'lucide-react';
import { adminFunnelsApi, adminProductsApi, getApiErrorMessage, type Funnel, type FunnelCreateInput, type Product } from '@coachio/api-client';
import { FunnelStatusBadge } from './FunnelStatusBadge';
import { useToast } from '../shared/toast';

const CURRENCY_OPTIONS = ['VND', 'USD'];

export function AdminFunnelList() {
  const router = useRouter();
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState<Partial<FunnelCreateInput>>({ currency: 'VND', title: '', slug: '', product_id: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let mounted = true;
    Promise.all([adminFunnelsApi.list(), adminProductsApi.list()])
      .then(([fl, pl]) => {
        if (mounted) { setFunnels(fl); setProducts(pl); }
      })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Failed to load funnels')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  async function handleCreate() {
    if (!createForm.title?.trim() || !createForm.slug?.trim() || !createForm.product_id) {
      setCreateError('Title, slug and product are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const newFunnel = await adminFunnelsApi.create(createForm as FunnelCreateInput);
      success('Funnel created');
      router.push(`/admin/funnels/${newFunnel.id}/edit/landing`);
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to create funnel');
      setCreateError(msg);
      toastError(msg);
      setCreating(false);
    }
  }

  async function handleClone(funnel: Funnel) {
    const newSlug = prompt('Enter a new slug for the cloned funnel:', `${funnel.slug}-copy`);
    if (!newSlug?.trim()) return;
    try {
      const cloned = await adminFunnelsApi.clone(funnel.id, { slug: newSlug.trim() });
      setFunnels((prev) => [cloned, ...prev]);
      success('Funnel cloned');
      router.push(`/admin/funnels/${cloned.id}/edit/landing`);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to clone funnel'));
    }
  }

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-1 text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-accent)]">
            <GitBranch className="h-4 w-4" />
            Sales funnels
          </div>
          <h2 className="text-2xl font-semibold text-[var(--coachio-admin-dashboard-text)]">Funnel Management</h2>
          <p className="mt-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">Create and manage sales funnels linked to products.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowCreate(true); setCreateError(''); }}
          className="inline-flex h-11 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)]"
        >
          <Plus className="h-5 w-5" />
          Create funnel
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--coachio-admin-dashboard-accent)]" />
          Loading...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <h3 className="mb-4 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Create new funnel</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Title *</span>
              <input
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={createForm.title ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="June Funnel"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Slug *</span>
              <input
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={createForm.slug ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="june-funnel"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Product *</span>
              <select
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={createForm.product_id ?? ''}
                onChange={(e) => setCreateForm((f) => ({ ...f, product_id: e.target.value }))}
              >
                <option value="">-- Select product --</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Currency</span>
              <select
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={createForm.currency ?? 'VND'}
                onChange={(e) => setCreateForm((f) => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>
          {createError && <p className="mt-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{createError}</p>}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50"
            >
              {creating && <Loader2 className="h-4 w-4 animate-spin" />}
              Create & edit
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="inline-flex h-9 items-center px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <div className="hidden grid-cols-[minmax(0,1fr)_140px_180px] border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)] md:grid">
            <span>Funnel</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {funnels.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <GitBranch className="mx-auto h-10 w-10 text-[var(--coachio-admin-dashboard-text-soft)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">No funnels yet.</p>
            </div>
          ) : (
            funnels.map((funnel) => (
              <div
                key={funnel.id}
                className="grid gap-3 border-b border-[var(--coachio-admin-dashboard-border-subtle)] px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_140px_180px] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{funnel.title}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--coachio-admin-dashboard-text-muted)]">/{funnel.slug}</p>
                </div>
                <FunnelStatusBadge status={funnel.status} />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/admin/funnels/${funnel.id}/edit/landing`)}
                    className="inline-flex h-8 items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleClone(funnel)}
                    className="inline-flex h-8 items-center gap-1 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    Clone
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
