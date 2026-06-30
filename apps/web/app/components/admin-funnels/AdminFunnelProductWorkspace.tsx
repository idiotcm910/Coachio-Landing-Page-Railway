'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { adminProductsApi, getApiErrorMessage, type Funnel, type Product, type ProductInput, type ProductStatus } from '@coachio/api-client';
import { useToast } from '../shared/toast';

const PRODUCT_TYPE_OPTIONS = ['course', 'ebook', 'template', 'service', 'other'];
const STATUS_OPTIONS: ProductStatus[] = ['draft', 'active', 'archived'];

interface AdminFunnelProductWorkspaceProps {
  funnel: Funnel;
}

const inputClass =
  'rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';
const labelClass = 'text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]';

/**
 * Menu "Sản phẩm" trong editor funnel — sửa product gắn với funnel.
 * Giá bán của funnel = product.base_price (nguồn giá duy nhất).
 */
export function AdminFunnelProductWorkspace({ funnel }: AdminFunnelProductWorkspaceProps) {
  const [product, setProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    let mounted = true;
    adminProductsApi
      .get(funnel.product_id)
      .then((p) => {
        if (!mounted) return;
        setProduct(p);
        setForm({
          name: p.name,
          slug: p.slug,
          description: p.description ?? '',
          base_price: p.base_price,
          type: p.type,
          status: p.status,
          thumbnail_url: p.thumbnail_url ?? '',
        });
      })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Failed to load product')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [funnel.product_id]);

  function set<K extends keyof ProductInput>(key: K, value: ProductInput[K]) {
    setForm((f) => (f ? { ...f, [key]: value } : f));
  }

  async function handleSave() {
    if (!form) return;
    if (!form.name.trim() || !form.slug.trim()) {
      setError('Name and slug are required.');
      return;
    }
    setSaving(true);
    setError('');
    setSaveOk(false);
    try {
      const updated = await adminProductsApi.update(funnel.product_id, form);
      setProduct(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      success('Product saved');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save product');
      setError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--coachio-admin-dashboard-accent)]" />
      </div>
    );
  }

  if (!form || !product) {
    return <p className="text-sm font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{error || 'Could not load product.'}</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
        <h3 className="mb-1 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">Funnel product</h3>
        <p className="mb-4 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">
          The selling price displayed on the funnel is taken from <strong>Product price</strong> below (token <code className="font-mono">{'{{price}}'}</code>).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Product name</span>
            <input className={inputClass} value={form.name} onChange={(e) => set('name', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Slug</span>
            <input className={inputClass} value={form.slug} onChange={(e) => set('slug', e.target.value)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Product price (VND)</span>
            <input type="number" min={0} className={inputClass} value={form.base_price} onChange={(e) => set('base_price', Number(e.target.value))} />
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Type</span>
            <select className={inputClass} value={form.type} onChange={(e) => set('type', e.target.value)}>
              {PRODUCT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className={labelClass}>Status</span>
            <select className={inputClass} value={form.status} onChange={(e) => set('status', e.target.value as ProductStatus)}>
              {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Thumbnail image (URL)</span>
            <input className={inputClass} value={form.thumbnail_url ?? ''} onChange={(e) => set('thumbnail_url', e.target.value)} placeholder="https://..." />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className={labelClass}>Description</span>
            <textarea rows={3} className={inputClass} value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} />
          </label>
        </div>
      </div>

      {error && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{error}</p>}
      {saveOk && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-success-text)]">Product saved!</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save product
      </button>
    </div>
  );
}
