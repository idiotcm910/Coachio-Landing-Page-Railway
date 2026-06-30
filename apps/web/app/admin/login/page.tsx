'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
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

  return (
    <main className="grid min-h-screen place-items-center bg-[#f8f8f8] p-6">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-slate-900">Đăng nhập quản trị</h1>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Mật khẩu"
          className="w-full rounded-md border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-slate-900"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-slate-900 px-3 py-2 font-semibold text-white disabled:opacity-60"
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </main>
  );
}
