/** Media Library — shared catalog of files stored on S3 (admin). */

export type MediaKind = 'image' | 'other';

/** A single catalogued media asset (mirrors backend MediaAssetResponse). */
export interface MediaAsset {
  id: string;
  object_key: string;
  /** Public CDN/S3 URL — reusable in custom HTML, email, SEO. */
  url: string;
  content_type: string | null;
  kind: MediaKind;
  file_size: number | null;
  original_filename: string | null;
  uploaded_by: string | null;
  created_at: string;
}

/** Query for the paginated media listing. */
export interface MediaListQuery {
  page?: number;
  page_size?: number;
  kind?: MediaKind;
  search?: string;
}

/** Paginated media listing response. */
export interface MediaListResponse {
  items: MediaAsset[];
  total: number;
  page: number;
  page_size: number;
}
