import Link from 'next/link';
import { Home } from 'lucide-react';

export const metadata = {
  title: '404 — Không tìm thấy trang | Coachio',
  description: 'Trang bạn tìm không tồn tại hoặc đã được di chuyển.',
};

// App Router 404 cho toàn bộ landing FE. Server component.
export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-deepBlack px-4 py-16 text-textDark">
      <div className="w-full max-w-xl text-center">
        <h1 className="font-pixel text-[7rem] leading-none text-neonOrange sm:text-[9rem]">
          404
        </h1>
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-textDark sm:text-3xl">
          Không tìm thấy trang
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base font-medium leading-relaxed text-textGray">
          Trang bạn đang tìm không tồn tại, đã bị xóa hoặc đường dẫn không chính xác.
        </p>
        <div className="mt-8 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-neonOrange px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#e0700f]"
          >
            <Home className="h-4 w-4" />
            Về trang chủ
          </Link>
        </div>
      </div>
    </main>
  );
}
