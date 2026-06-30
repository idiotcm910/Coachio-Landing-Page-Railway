'use client';

import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, UserRole } from '@coachio/api-client';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();

  // Login page lives inside the admin segment — render it without auth guard
  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    if (isLoginPage) return;
    if (!isLoading && !isAuthenticated) {
      router.replace('/admin/login');
    }
  }, [isAuthenticated, isLoading, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (isLoading || !isAuthenticated) {
    return <main className="min-h-screen bg-[#f8f8f8] p-10 text-slate-900">Loading...</main>;
  }

  if (user?.role !== UserRole.ADMIN) {
    return <main className="min-h-screen bg-[#f8f8f8] p-10 text-slate-900">Forbidden</main>;
  }

  return <>{children}</>;
}
