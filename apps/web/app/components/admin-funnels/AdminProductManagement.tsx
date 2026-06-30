'use client';

import { useEffect, useState } from 'react';
import { AlertCircle, Loader2, Package, Plus, Pencil, Trash2 } from 'lucide-react';
import { adminProductsApi, getApiErrorMessage, type Product, type ProductInput, type ProductStatus } from '@coachio/api-client';
import { useToast } from '../shared/toast';

const PRODUCT_TYPE_OPTIONS = ['agents_skill', 'ebook', 'template', 'service', 'other'];
// Friendly labels for product types (falls back to the raw key).
const PRODUCT_TYPE_LABELS: Record<string, string> = {
  agents_skill: 'Agent Skills',
};
const STATUS_OPTIONS: ProductStatus[] = ['draft', 'active', 'archived'];

const STATUS_LABELS: Record<ProductStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  archived: 'Archived',
};

const emptyForm = (): ProductInput => ({
  name: '',
  slug: '',
  description: '',
  base_price: 0,
  type: 'service',
  status: 'draft',
  thumbnail_url: '',
});

export function AdminProductManagement() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductInput>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let mounted = true;
    adminProductsApi
      .list()
      .then((data) => { if (mounted) setProducts(data); })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Failed to load products')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, []);

  function openCreate() {
    setForm(emptyForm());
    setEditingId(null);
    setFormError('');
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setForm({
      name: product.name,
      slug: product.slug,
      description: product.description ?? '',
      base_price: product.base_price,
      type: product.type,
      status: product.status,
      thumbnail_url: product.thumbnail_url ?? '',
    });
    setEditingId(product.id);
    setFormError('');
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.slug.trim()) {
      setFormError('Name and slug are required.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        const updated = await adminProductsApi.update(editingId, form);
        setProducts((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
      } else {
        const created = await adminProductsApi.create(form);
        setProducts((prev) => [created, ...prev]);
      }
      setShowForm(false);
      success(editingId ? 'Product updated' : 'Product created');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save product');
      setFormError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(productId: string) {
    if (!confirm('Delete this product?')) return;
    try {
      await adminProductsApi.remove(productId);
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      success('Product deleted');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to delete product');
      setError(msg);
      toastError(msg);
    }
  }

  return (
    <section className="space-y-6">
      {/* Header card */}
      <div className="flex flex-col gap-4 rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-1 text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-accent)]">
            <Package className="h-4 w-4" />
            Products
          </div>
          <h2 className="text-2xl font-semibold text-[var(--coachio-admin-dashboard-text)]">Product Management</h2>
          <p className="mt-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">Create and manage products used as sources for sales funnels.</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-11 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)]"
        >
          <Plus className="h-5 w-5" />
          Add product
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
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Inline form */}
      {showForm && (
        <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <h3 className="mb-4 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">
            {editingId ? 'Edit product' : 'Create product'}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Name *</span>
              <input
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="Product name"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Slug *</span>
              <input
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                placeholder="my-product"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Base price (VND) *</span>
              <input
                type="number"
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={form.base_price}
                onChange={(e) => setForm((f) => ({ ...f, base_price: Number(e.target.value) }))}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Type</span>
              <select
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              >
                {PRODUCT_TYPE_OPTIONS.map((t) => (
                  <option key={t} value={t}>{PRODUCT_TYPE_LABELS[t] ?? t}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Status</span>
              <select
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ProductStatus }))}
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 sm:col-span-2">
              <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Description</span>
              <textarea
                rows={2}
                className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
                value={form.description ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Short description"
              />
            </label>

          </div>
          {formError && (
            <p className="mt-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{formError}</p>
          )}
          <div className="mt-4 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editingId ? 'Save changes' : 'Create product'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="inline-flex h-9 items-center px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && (
        <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
          <div className="hidden grid-cols-[minmax(0,1fr)_120px_120px_100px_100px] border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-5 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)] md:grid">
            <span>Name / Slug</span>
            <span>Type</span>
            <span>Base price</span>
            <span>Status</span>
            <span>Actions</span>
          </div>
          {products.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <Package className="mx-auto h-10 w-10 text-[var(--coachio-admin-dashboard-text-soft)]" />
              <p className="mt-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">No products yet.</p>
            </div>
          ) : (
            products.map((product) => (
              <div
                key={product.id}
                className="grid gap-3 border-b border-[var(--coachio-admin-dashboard-border-subtle)] px-5 py-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_120px_120px_100px_100px] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{product.name}</p>
                  <p className="mt-0.5 truncate text-xs text-[var(--coachio-admin-dashboard-text-muted)]">/{product.slug}</p>
                </div>
                <span className="text-sm text-[var(--coachio-admin-dashboard-text-muted)]">{product.type}</span>
                <span className="text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">
                  {product.base_price.toLocaleString('vi-VN')}₫
                </span>
                <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">
                  {STATUS_LABELS[product.status] ?? product.status}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(product)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] hover:text-[var(--coachio-admin-dashboard-text)]"
                    aria-label="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(product.id)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-danger-border)] text-[var(--coachio-admin-dashboard-danger-text)] hover:bg-[var(--coachio-admin-dashboard-danger-bg)]"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
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
