'use client';

import { useRef, useState } from 'react';
import { ImageIcon, Loader2, Upload } from 'lucide-react';
import { adminFunnelsApi, adminMediaApi, getApiErrorMessage, type FunnelLanding, type FunnelSeoInput } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { MediaPicker } from '../shared/media-picker';

interface AdminFunnelSeoPanelProps {
  funnelId: string;
  landing: FunnelLanding;
  onUpdated: (updated: FunnelLanding) => void;
}

const fieldInputClass =
  'rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]';

function Field({ label, value, onChange, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">{label}</span>
      <input
        type={type}
        className={fieldInputClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

/**
 * Image field offering two ways to set the URL: paste/enter a URL directly, or
 * upload an image file (reuses the admin image upload endpoint) which fills the URL.
 */
function ImageUrlField({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const { success, error: toastError } = useToast();

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await adminMediaApi.upload(file);
      onChange(uploaded.url);
      success('Image uploaded');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Image upload failed'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">{label}</span>
      <div className="flex gap-2">
        <input
          type="url"
          className={`${fieldInputClass} min-w-0 flex-1`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? 'Enter URL or upload'}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload image"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          Upload
        </button>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          title="Choose from Media Library"
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 text-xs font-semibold text-[var(--coachio-admin-dashboard-text)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)]"
        >
          <ImageIcon className="h-4 w-4" />
          Library
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      <MediaPicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        kind="image"
        selectLabel="Use this image"
        onSelect={(asset) => onChange(asset.url)}
      />
    </label>
  );
}

export function AdminFunnelSeoPanel({ funnelId, landing, onUpdated }: AdminFunnelSeoPanelProps) {
  const [form, setForm] = useState<FunnelSeoInput>({
    seo_title: landing.seo_title ?? '',
    seo_description: landing.seo_description ?? '',
    seo_keywords: landing.seo_keywords ?? '',
    canonical_url: landing.canonical_url ?? '',
    robots_index: landing.robots_index,
    robots_follow: landing.robots_follow,
    og_title: landing.og_title ?? '',
    og_description: landing.og_description ?? '',
    og_image_url: landing.og_image_url ?? '',
    og_type: landing.og_type ?? '',
    twitter_card: landing.twitter_card ?? '',
    twitter_title: landing.twitter_title ?? '',
    twitter_description: landing.twitter_description ?? '',
    twitter_image_url: landing.twitter_image_url ?? '',
    favicon_url: landing.favicon_url ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState(false);
  const { success, error: toastError } = useToast();

  function set<K extends keyof FunnelSeoInput>(key: K, value: FunnelSeoInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setSaveError('');
    setSaveOk(false);
    try {
      const updated = await adminFunnelsApi.updateLandingSeo(funnelId, form);
      onUpdated(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 3000);
      success('SEO settings saved');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to save SEO settings');
      setSaveError(msg);
      toastError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-bold text-[var(--coachio-admin-dashboard-text)]">SEO settings</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="SEO title" value={form.seo_title ?? ''} onChange={(v) => set('seo_title', v)} placeholder="SEO Title" />
        <Field label="SEO description" value={form.seo_description ?? ''} onChange={(v) => set('seo_description', v)} placeholder="Meta description" />
        <Field label="Keywords" value={form.seo_keywords ?? ''} onChange={(v) => set('seo_keywords', v)} placeholder="keyword1, keyword2" />
        <Field label="Canonical URL" value={form.canonical_url ?? ''} onChange={(v) => set('canonical_url', v)} placeholder="https://..." />
        <ImageUrlField label="Favicon URL" value={form.favicon_url ?? ''} onChange={(v) => set('favicon_url', v)} placeholder="https://..." />
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold text-[var(--coachio-admin-dashboard-text-soft)]">Robots</span>
          <label className="flex items-center gap-2 text-sm text-[var(--coachio-admin-dashboard-text)]">
            <input type="checkbox" checked={form.robots_index ?? true} onChange={(e) => set('robots_index', e.target.checked)} />
            Index
          </label>
          <label className="flex items-center gap-2 text-sm text-[var(--coachio-admin-dashboard-text)]">
            <input type="checkbox" checked={form.robots_follow ?? true} onChange={(e) => set('robots_follow', e.target.checked)} />
            Follow
          </label>
        </div>
      </div>
      <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Open Graph</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="OG Title" value={form.og_title ?? ''} onChange={(v) => set('og_title', v)} />
        <Field label="OG Description" value={form.og_description ?? ''} onChange={(v) => set('og_description', v)} />
        <ImageUrlField label="OG Image URL" value={form.og_image_url ?? ''} onChange={(v) => set('og_image_url', v)} />
        <Field label="OG Type" value={form.og_type ?? ''} onChange={(v) => set('og_type', v)} placeholder="website" />
      </div>
      <h4 className="text-xs font-bold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Twitter Card</h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Twitter Card" value={form.twitter_card ?? ''} onChange={(v) => set('twitter_card', v)} placeholder="summary_large_image" />
        <Field label="Twitter Title" value={form.twitter_title ?? ''} onChange={(v) => set('twitter_title', v)} />
        <Field label="Twitter Description" value={form.twitter_description ?? ''} onChange={(v) => set('twitter_description', v)} />
        <ImageUrlField label="Twitter Image URL" value={form.twitter_image_url ?? ''} onChange={(v) => set('twitter_image_url', v)} />
      </div>

      {saveError && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-danger-text)]">{saveError}</p>}
      {saveOk && <p className="text-xs font-semibold text-[var(--coachio-admin-dashboard-success-text)]">SEO saved!</p>}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50"
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        Save SEO
      </button>
    </div>
  );
}
