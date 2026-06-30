'use client';

/**
 * MediaPickerPreview — right-side panel of the MediaPicker: large preview,
 * metadata, Copy URL, Select, and Delete (with confirm). Non-image assets show
 * filename/type/size instead of an image render.
 */

import { useState } from 'react';
import { Check, Copy, Loader2, Trash2 } from 'lucide-react';
import { adminMediaApi, getApiErrorMessage, type MediaAsset } from '@coachio/api-client';
import { useToast } from '../toast';
import { ConfirmDialog } from '../ConfirmDialog';

interface MediaPickerPreviewProps {
  asset: MediaAsset | null;
  onSelect?: (asset: MediaAsset) => void;
  selectLabel?: string;
  onDeleted: (assetId: string) => void;
  onClose: () => void;
}

function formatSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

export function MediaPickerPreview({ asset, onSelect, selectLabel, onDeleted, onClose }: MediaPickerPreviewProps) {
  const { success, error: toastError } = useToast();
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!asset) {
    return (
      <div className="hidden w-72 shrink-0 items-center justify-center border-l border-[var(--coachio-admin-dashboard-border)] p-5 text-center text-sm text-[var(--coachio-admin-dashboard-text-muted)] md:flex">
        Select a media item to preview.
      </div>
    );
  }

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(asset!.url);
      setCopied(true);
      success('Media URL copied');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toastError('Failed to copy URL');
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await adminMediaApi.remove(asset!.id);
      success('Media deleted');
      onDeleted(asset!.id);
      setConfirmOpen(false);
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Failed to delete media'));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="hidden w-72 shrink-0 flex-col border-l border-[var(--coachio-admin-dashboard-border)] md:flex">
      <div className="flex-1 overflow-auto p-4">
        {/* Preview */}
        <div className="mb-4 flex aspect-video items-center justify-center overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)]">
          {asset.kind === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={asset.url} alt={asset.original_filename ?? ''} className="max-h-full max-w-full object-contain" />
          ) : (
            <span className="px-3 text-center text-xs text-[var(--coachio-admin-dashboard-text-muted)]">{asset.content_type ?? 'file'}</span>
          )}
        </div>

        {/* Metadata */}
        <dl className="space-y-2 text-xs">
          <div>
            <dt className="text-[var(--coachio-admin-dashboard-text-muted)]">File name</dt>
            <dd className="break-all font-medium text-[var(--coachio-admin-dashboard-text)]">{asset.original_filename ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[var(--coachio-admin-dashboard-text-muted)]">Type</dt>
            <dd className="font-medium text-[var(--coachio-admin-dashboard-text)]">{asset.content_type ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-[var(--coachio-admin-dashboard-text-muted)]">Size</dt>
            <dd className="font-medium text-[var(--coachio-admin-dashboard-text)]">{formatSize(asset.file_size)}</dd>
          </div>
          <div>
            <dt className="text-[var(--coachio-admin-dashboard-text-muted)]">URL</dt>
            <dd className="break-all text-[var(--coachio-admin-dashboard-text-soft)]">{asset.url}</dd>
          </div>
        </dl>
      </div>

      {/* Actions */}
      <div className="space-y-2 border-t border-[var(--coachio-admin-dashboard-border)] p-4">
        {onSelect && (
          <button type="button" onClick={() => { onSelect(asset); onClose(); }}
            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)]">
            {selectLabel ?? 'Select this media'}
          </button>
        )}
        <button type="button" onClick={copyUrl}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-sm font-medium text-[var(--coachio-admin-dashboard-text)] hover:bg-[var(--coachio-admin-dashboard-surface-hover)]">
          {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          {copied ? 'Copied' : 'Copy URL'}
        </button>
        <button type="button" onClick={() => setConfirmOpen(true)}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] text-sm font-medium text-[var(--coachio-admin-dashboard-danger-text)] hover:bg-[var(--coachio-admin-dashboard-surface-hover)]">
          <Trash2 className="h-4 w-4" />
          Delete
        </button>
      </div>

      <ConfirmDialog
        isOpen={confirmOpen}
        title="Delete media?"
        description="This media may be in use in custom HTML, emails or SEO. Deleting it will break any links pointing to it. Continue?"
        confirmLabel="Delete"
        tone="danger"
        isConfirming={deleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}
