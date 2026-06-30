'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// Trang chủ redirect tới funnel mặc định (slug cấu hình qua env, fallback placeholder).
const DEFAULT_FUNNEL_SLUG = process.env.NEXT_PUBLIC_DEFAULT_FUNNEL_SLUG ?? '';

export default function HomePage() {
  const router = useRouter();
  useEffect(() => {
    if (DEFAULT_FUNNEL_SLUG) router.replace(`/funnels/${DEFAULT_FUNNEL_SLUG}`);
  }, [router]);
  if (!DEFAULT_FUNNEL_SLUG) {
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
