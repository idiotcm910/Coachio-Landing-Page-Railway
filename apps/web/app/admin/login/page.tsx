'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '@coachio/api-client';
import { useToast } from '../../components/shared/toast';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success('Đăng nhập thành công');
      router.replace('/admin');
    } catch {
      toast.error('Email hoặc mật khẩu không đúng');
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    'w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-white px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none transition focus:border-[var(--coachio-admin-dashboard-accent)] focus:ring-2 focus:ring-[var(--coachio-admin-dashboard-accent-soft)]';

  return (
    <main className="grid min-h-screen place-items-center bg-[var(--coachio-admin-dashboard-bg)] p-6 text-[var(--coachio-admin-dashboard-text)]">
      <div className="w-full max-w-sm">
        {/* Brand header — same visual language as the System Admin shell */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div className="mb-3 grid h-12 w-12 place-items-center rounded-[var(--coachio-admin-dashboard-radius-md)] bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)] shadow-[var(--coachio-admin-dashboard-shadow-md)]">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
            Coachio
          </p>
          <h1 className="mt-1 text-2xl font-semibold">System Admin</h1>
          <p className="mt-1 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
            Đăng nhập để quản lý hệ thống
          </p>
        </div>

        {/* Card form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-md)]"
        >
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ban@email.com"
              className={inputCls}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium">
              Mật khẩu
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={inputCls}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-3 py-2.5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] shadow-[var(--coachio-admin-dashboard-shadow-sm)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-[var(--coachio-admin-dashboard-text-soft)]">
          Chỉ dành cho quản trị viên được cấp quyền.
        </p>
      </div>
    </main>
  );
}
