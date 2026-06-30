'use client';

/**
 * useMediaUploader — shared upload logic for the Media Library surfaces
 * (the funnel MediaPicker modal and the full-page AdminMediaManagement).
 *
 * Supports uploading MANY files at once, drag & drop and clipboard paste.
 * The backend endpoint takes one file per request, so we validate client-side
 * (type + size) and upload sequentially, reporting per-file progress. All
 * outcomes surface a Vietnamese toast.
 */

import { useCallback, useEffect, useState } from 'react';
import { adminMediaApi, getApiErrorMessage, type MediaAsset } from '@coachio/api-client';
import { useToast } from '../toast';

/** Mirrors the backend whitelist (app/utils/constants.py). */
const ALLOWED_MIME = ['image/png', 'image/jpeg', 'image/webp'];
export const MEDIA_UPLOAD_ACCEPT = 'image/png,image/jpeg,image/webp';
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

interface UploadProgress {
  done: number;
  total: number;
}

interface UseMediaUploaderOptions {
  /** Called with the successfully uploaded assets after a batch completes. */
  onUploaded?: (assets: MediaAsset[]) => void;
  /** When true, listens for clipboard paste of image files on the document. */
  enablePaste?: boolean;
}

function validate(file: File): string | null {
  if (!ALLOWED_MIME.includes(file.type)) return `${file.name}: định dạng không hỗ trợ`;
  if (file.size > MAX_FILE_SIZE) return `${file.name}: vượt quá 15MB`;
  return null;
}

export function useMediaUploader({ onUploaded, enablePaste }: UseMediaUploaderOptions = {}) {
  const { success, error: toastError } = useToast();
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress>({ done: 0, total: 0 });
  const [isDragging, setIsDragging] = useState(false);

  const uploadFiles = useCallback(
    async (input: FileList | File[]): Promise<MediaAsset[]> => {
      const files = Array.from(input);
      if (!files.length) return [];

      const valid: File[] = [];
      const rejected: string[] = [];
      for (const file of files) {
        const reason = validate(file);
        if (reason) rejected.push(reason);
        else valid.push(file);
      }
      if (rejected.length) {
        const preview = rejected.slice(0, 3).join('; ');
        toastError(`Bỏ qua ${rejected.length} file: ${preview}${rejected.length > 3 ? '…' : ''}`);
      }
      if (!valid.length) return [];

      setUploading(true);
      setProgress({ done: 0, total: valid.length });
      const uploaded: MediaAsset[] = [];
      let failed = 0;
      let lastError = '';
      for (let i = 0; i < valid.length; i += 1) {
        try {
          uploaded.push(await adminMediaApi.upload(valid[i]));
        } catch (e) {
          failed += 1;
          lastError = getApiErrorMessage(e, 'Tải lên thất bại');
        }
        setProgress({ done: i + 1, total: valid.length });
      }
      setUploading(false);

      if (uploaded.length) {
        success(uploaded.length === 1 ? 'Đã tải lên 1 file' : `Đã tải lên ${uploaded.length} file`);
        onUploaded?.(uploaded);
      }
      if (failed) toastError(`${failed} file tải lên thất bại: ${lastError}`);
      return uploaded;
    },
    [success, toastError, onUploaded],
  );

  // Clipboard paste of image files (e.g. screenshots).
  useEffect(() => {
    if (!enablePaste) return undefined;
    const onPaste = (e: ClipboardEvent) => {
      const images = Array.from(e.clipboardData?.files ?? []).filter((f) => f.type.startsWith('image/'));
      if (images.length) uploadFiles(images);
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [enablePaste, uploadFiles]);

  const dragHandlers = {
    onDragOver: (e: React.DragEvent) => {
      if (e.dataTransfer.types?.includes('Files')) {
        e.preventDefault();
        setIsDragging(true);
      }
    },
    onDragLeave: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files?.length) uploadFiles(e.dataTransfer.files);
    },
  };

  return { uploading, progress, isDragging, dragHandlers, uploadFiles };
}
