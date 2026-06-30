import type { MediaAsset } from '@coachio/api-client';

/** Escape a string for safe use inside an HTML double-quoted attribute. */
function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Build the HTML snippet to insert when an admin picks a media asset.
 * Images → an <img> tag with escaped src/alt; other kinds → the bare URL.
 * The URL is a server-generated CDN path but we escape it defensively since it
 * lands inside admin-authored custom HTML / email bodies.
 */
export function buildMediaSnippet(asset: MediaAsset): string {
  if (asset.kind === 'image') {
    const src = escapeHtmlAttr(asset.url);
    const alt = escapeHtmlAttr(asset.original_filename ?? '');
    return `<img src="${src}" alt="${alt}" />`;
  }
  return asset.url;
}
