'use client';

/**
 * MediaPicker — shared admin modal to browse, upload, preview, copy-URL and
 * select media from the global Media Library (S3-backed catalog).
 *
 * Reusable across funnels (this phase), courses, emails, SEO… A surface opens it
 * and receives the chosen asset's URL via `onSelect`. All mutations (upload/
 * delete) surface an English toast.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Search, UploadCloud, X } from 'lucide-react';
import { adminMediaApi, getApiErrorMessage, type MediaAsset } from '@coachio/api-client';
import { useToast } from '../toast';
import { MediaPickerPreview } from './MediaPickerPreview';
import { MEDIA_UPLOAD_ACCEPT, useMediaUploader } from './useMediaUploader';

interface MediaPickerProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called with the chosen asset when the admin confirms a selection. */
  onSelect?: (asset: MediaAsset) => void;
  /** Restrict the library view to a kind (e.g. 'image' for SEO/og). */
  kind?: 'image' | 'other';
  selectLabel?: string;
}

const PAGE_SIZE = 24;

export function MediaPicker({ isOpen, onClose, onSelect, kind, selectLabel }: MediaPickerProps) {
  const { error: toastError } = useToast();

  const [items, setItems] = useState<MediaAsset[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<MediaAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminMediaApi.list({ page, page_size: PAGE_SIZE, kind, search: search || undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to load media library'));
    } finally {
      setLoading(false);
    }
  }, [page, kind, search, toastError]);

  const handleUploaded = useCallback((assets: MediaAsset[]) => {
    // Select the last uploaded asset; refresh from page 1 so new files show on top.
    setSelected(assets[assets.length - 1] ?? null);
    setPage((p) => (p !== 1 ? 1 : p));
    if (page === 1) load();
  }, [page, load]);

  const { uploading, progress, isDragging, dragHandlers, uploadFiles } = useMediaUploader({
    onUploaded: handleUploaded,
    enablePaste: isOpen,
  });

  // Reload when opened / page / search changes; reset state on close.
  useEffect(() => {
    if (isOpen) load();
  }, [isOpen, load]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, onClose]);

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = '';
  }

  async function handleDeleted(assetId: string) {
    setItems((prev) => prev.filter((a) => a.id !== assetId));
    setTotal((t) => Math.max(0, t - 1));
    if (selected?.id === assetId) setSelected(null);
  }

  if (!isOpen) return null;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div role="dialog" aria-modal="true" aria-label="Media library" className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/55" onClick={onClose} aria-hidden="true" />

      <div className="relative flex max-h-[90vh] min-h-[80vh] w-full max-w-5xl flex-col overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-modal)]">
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-[var(--coachio-admin-dashboard-border)] px-5 py-4">
          <ImagePlus className="h-5 w-5 text-[var(--coachio-admin-dashboard-accent)]" />
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold text-[var(--coachio-admin-dashboard-text)]">Media Library</p>
            <p className="mt-0.5 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{total} media</p>
          </div>
          <div className="relative hidden sm:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--coachio-admin-dashboard-text-muted)]" />
            <input
              value={search}
              onChange={(e) => { setPage(1); setSearch(e.target.value); }}
              placeholder="Search by file name…"
              className="h-9 w-56 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] pl-8 pr-3 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
            />
          </div>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploading}
            className="inline-flex h-9 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] disabled:opacity-50">
            {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
            {uploading ? `Đang tải ${progress.done}/${progress.total}` : 'Tải lên'}
          </button>
          <input ref={fileInputRef} type="file" accept={MEDIA_UPLOAD_ACCEPT} multiple hidden onChange={onFileChange} />
          <button type="button" onClick={onClose} title="Close"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-[var(--coachio-admin-dashboard-text-muted)] hover:bg-[var(--coachio-admin-dashboard-surface-hover)]">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body: grid + preview */}
        <div className="flex min-h-0 flex-1">
          <div className="relative min-h-0 flex-1 overflow-auto p-4" {...dragHandlers}>
            {isDragging && (
              <div className="pointer-events-none absolute inset-2 z-10 flex flex-col items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-md)] border-2 border-dashed border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-surface)]/90 text-sm font-semibold text-[var(--coachio-admin-dashboard-accent)]">
                <UploadCloud className="h-7 w-7" />
                Thả file vào đây để tải lên
              </div>
            )}
            {loading ? (
              <div className="flex h-40 items-center justify-center text-[var(--coachio-admin-dashboard-text-muted)]">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
                <ImagePlus className="h-8 w-8 opacity-40" />
                Chưa có media. Kéo-thả, dán (Ctrl+V) hoặc bấm Tải lên — có thể chọn nhiều file.
              </div>
            ) : (
              <div className="columns-2 gap-3 sm:columns-3 md:columns-4 [&>*]:mb-3">
                {items.map((a) => (
                  <button key={a.id} type="button" onClick={() => setSelected(a)}
                    className={`group block w-full break-inside-avoid overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-sm)] border ${selected?.id === a.id ? 'border-[var(--coachio-admin-dashboard-accent)] ring-2 ring-[var(--coachio-admin-dashboard-accent)]' : 'border-[var(--coachio-admin-dashboard-border)]'} bg-[var(--coachio-admin-dashboard-surface-muted)]`}>
                    {a.kind === 'image' ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.url} alt={a.original_filename ?? ''} className="h-auto w-full object-contain" loading="lazy" />
                    ) : (
                      <span className="flex min-h-24 w-full items-center justify-center px-2 py-6 text-center text-[10px] text-[var(--coachio-admin-dashboard-text-muted)]">
                        {a.original_filename ?? a.object_key}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-3 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
                <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">‹ Prev</button>
                <span>{page}/{totalPages}</span>
                <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">Next ›</button>
              </div>
            )}
          </div>

          {/* Preview panel */}
          <MediaPickerPreview
            asset={selected}
            onSelect={onSelect}
            selectLabel={selectLabel}
            onDeleted={handleDeleted}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  );
}
