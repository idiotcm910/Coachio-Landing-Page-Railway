'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { fetchPublicHomepage } from '@coachio/api-client';
import { FunnelLandingClient } from './components/funnels/FunnelLandingClient';

// Trang chủ: nếu admin đã chọn 1 funnel làm homepage (site-homepage), render landing
// của funnel đó ngay tại `/` (URL giữ nguyên). Nếu chưa chọn (type "none"), fallback về
// funnel mặc định cấu hình qua env.
const DEFAULT_FUNNEL_SLUG = process.env.NEXT_PUBLIC_DEFAULT_FUNNEL_SLUG ?? '';

export default function HomePage() {
  const router = useRouter();
  const [slug, setSlug] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;
    fetchPublicHomepage()
      .then((home) => {
        if (!active) return;
        if (home.type === 'funnel' && home.funnel) {
          setSlug(home.funnel.slug);
          setResolved(true);
          return;
        }
        // type "none" — giữ hành vi mặc định: redirect tới funnel mặc định nếu có.
        if (DEFAULT_FUNNEL_SLUG) {
          router.replace(`/funnels/${DEFAULT_FUNNEL_SLUG}`);
        }
        setResolved(true);
      })
      .catch(() => {
        if (!active) return;
        if (DEFAULT_FUNNEL_SLUG) router.replace(`/funnels/${DEFAULT_FUNNEL_SLUG}`);
        setResolved(true);
      });
    return () => {
      active = false;
    };
  }, [router]);

  // Selected funnel homepage — render its landing in place at `/`.
  if (slug) {
    return <FunnelLandingClient slug={slug} />;
  }

  // No custom homepage and no default configured.
  if (resolved && !DEFAULT_FUNNEL_SLUG) {
    return (
      <main className="grid min-h-screen place-items-center bg-white text-slate-600">
        <p>Chưa cấu hình funnel mặc định.</p>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-white text-slate-600">
      <Loader2 className="h-6 w-6 animate-spin" />
    </main>
  );
}
