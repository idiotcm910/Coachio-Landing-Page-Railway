'use client';

/**
 * AdminMediaManagement — full-page Media Library view for the System Admin.
 *
 * Browse the whole catalog (paginated grid), upload, search, preview, copy URL
 * and delete. Reuses the shared MediaPickerPreview for the right-side panel
 * (DRY with the funnel MediaPicker modal). All mutations surface an English toast.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Search, UploadCloud } from 'lucide-react';
import { adminMediaApi, getApiErrorMessage, type MediaAsset } from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { MediaPickerPreview } from '../shared/media-picker';
import { MEDIA_UPLOAD_ACCEPT, useMediaUploader } from '../shared/media-picker/useMediaUploader';

const PAGE_SIZE = 30;

export function AdminMediaManagement() {
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
      const res = await adminMediaApi.list({ page, page_size: PAGE_SIZE, search: search || undefined });
      setItems(res.items);
      setTotal(res.total);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to load media library'));
    } finally {
      setLoading(false);
    }
  }, [page, search, toastError]);

  useEffect(() => {
    load();
  }, [load]);

  const handleUploaded = useCallback((assets: MediaAsset[]) => {
    setSelected(assets[assets.length - 1] ?? null);
    setPage((p) => (p !== 1 ? 1 : p));
    if (page === 1) load();
  }, [page, load]);

  const { uploading, progress, isDragging, dragHandlers, uploadFiles } = useMediaUploader({
    onUploaded: handleUploaded,
    enablePaste: true,
  });

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files?.length) uploadFiles(e.target.files);
    e.target.value = '';
  }

  function handleDeleted(assetId: string) {
    setItems((prev) => prev.filter((a) => a.id !== assetId));
    setTotal((t) => Math.max(0, t - 1));
    if (selected?.id === assetId) setSelected(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="flex min-h-[70vh] flex-col gap-4 rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-4 shadow-[var(--coachio-admin-dashboard-shadow-sm)] lg:flex-row">
      {/* Left: toolbar + grid */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <p className="mr-auto text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)]">{total} media</p>
          <div className="relative">
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
        </div>

        <div className="relative min-h-0 flex-1" {...dragHandlers}>
          {isDragging && (
            <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-md)] border-2 border-dashed border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-surface)]/90 text-sm font-semibold text-[var(--coachio-admin-dashboard-accent)]">
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
            // Masonry (CSS columns) so each thumbnail keeps the media's natural aspect ratio.
            <div className="columns-2 gap-3 sm:columns-3 md:columns-4 lg:columns-5 [&>*]:mb-3">
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

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-center gap-3 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="disabled:opacity-40">‹ Prev</button>
              <span>{page}/{totalPages}</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="disabled:opacity-40">Next ›</button>
            </div>
          )}
        </div>
      </div>

      {/* Right: preview panel (reused from the funnel media picker) */}
      <div className="w-full shrink-0 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] lg:w-80">
        <MediaPickerPreview asset={selected} onDeleted={handleDeleted} onClose={() => undefined} />
      </div>
    </div>
  );
}
