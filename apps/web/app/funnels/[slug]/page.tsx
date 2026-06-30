import { type Metadata } from 'next';
import { FunnelLandingClient } from '../../components/funnels/FunnelLandingClient';
import type { PublicFunnelLanding } from '@coachio/api-client';
import { serverApiBase } from '../../_lib/api-base';

interface Props {
  params: { slug: string };
}

async function fetchFunnel(slug: string): Promise<PublicFunnelLanding | null> {
  const base = serverApiBase();
  try {
    // SEO <meta>/OG được render từ generateMetadata phía server. KHÔNG cache ở tầng
    // Next (no-store) để khi admin lưu SEO là URL công khai phản ánh ngay — backend
    // đã có Redis write-through cache nên call này vẫn nhẹ.
    const res = await fetch(`${base}/api/v1/public/funnels/${slug}`, {
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    // Public endpoint returns the landing payload directly (no `{ data }` envelope);
    // fall back to `json.data` in case a wrapper is added later.
    return ((json?.data ?? json) ?? null) as PublicFunnelLanding | null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const funnel = await fetchFunnel(params.slug);
  if (!funnel) return { title: 'Không tìm thấy trang' };

  const seo = funnel.seo;
  const title = seo.seo_title || funnel.title;
  const description = seo.seo_description || undefined;

  return {
    title,
    description,
    keywords: seo.seo_keywords || undefined,
    alternates: seo.canonical_url ? { canonical: seo.canonical_url } : undefined,
    robots: {
      index: seo.robots_index,
      follow: seo.robots_follow,
    },
    openGraph: {
      title: seo.og_title || title,
      description: seo.og_description || description,
      images: seo.og_image_url ? [{ url: seo.og_image_url }] : undefined,
      type: (seo.og_type as 'website') || 'website',
    },
    twitter: {
      card: (seo.twitter_card as 'summary_large_image') || 'summary_large_image',
      title: seo.twitter_title || title,
      description: seo.twitter_description || description,
      images: seo.twitter_image_url ? [seo.twitter_image_url] : undefined,
    },
    icons: seo.favicon_url ? { icon: seo.favicon_url } : undefined,
  };
}

// Body renders client-side (CSR) so the section iframes are created after hydration
// and their height messages aren't missed (SSR clipped tall sections like the hero).
// SEO <meta>/OG still come from generateMetadata above.
export default function FunnelLandingPage({ params }: Props) {
  return <FunnelLandingClient slug={params.slug} />;
}
