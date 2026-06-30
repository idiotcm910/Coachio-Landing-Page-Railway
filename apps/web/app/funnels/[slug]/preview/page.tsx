import { FunnelPreviewClient } from './FunnelPreviewClient';

interface Props {
  params: { slug: string };
}

/**
 * Admin-only landing preview for any funnel status (draft/unpublished).
 * Auth gating and data fetching are handled entirely in FunnelPreviewClient
 * (CSR) so that the admin token is available in the browser.
 * No generateMetadata: this page must not be indexed (draft content).
 */
export const metadata = {
  robots: { index: false, follow: false },
};

export default function FunnelPreviewPage({ params }: Props) {
  return <FunnelPreviewClient slug={params.slug} />;
}
