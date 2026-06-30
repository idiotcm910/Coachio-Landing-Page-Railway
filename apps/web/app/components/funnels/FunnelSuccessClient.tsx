'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { funnelsApi, getApiErrorMessage } from '@coachio/api-client';
import type { FunnelOrderStatus } from '@coachio/api-client';
import { LandingSectionFrame } from '../landing-shared/LandingSectionFrame';
import { useFunnelPageView } from './use-funnel-page-view';
import { FunnelSuccessSkeleton } from './funnel-skeletons';

interface FunnelSuccessClientProps {
  slug: string;
  orderId: string | null;
}

const POLL_INTERVAL = 2000;
const MAX_POLL_TIME = 30_000; // 30s — order should already be SUCCESS at this point

export function FunnelSuccessClient({ slug, orderId }: FunnelSuccessClientProps) {
  const [orderStatus, setOrderStatus] = useState<FunnelOrderStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useFunnelPageView(slug, 'success');

  // Confetti canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!orderId) {
      setLoading(false);
      return;
    }

    const startTime = Date.now();

    const poll = async () => {
      try {
        const status = await funnelsApi.getFunnelOrderStatus(orderId);
        setOrderStatus(status);
        setLoading(false);

        // Keep polling until SUCCESS or timeout (order may still be PENDING on first hit for paid orders)
        if (status.status !== 'SUCCESS' && Date.now() - startTime < MAX_POLL_TIME) {
          pollingRef.current = setTimeout(poll, POLL_INTERVAL);
        }
      } catch (err) {
        setError(getApiErrorMessage(err, 'Không thể tải thông tin đơn hàng'));
        setLoading(false);
      }
    };

    poll();

    return () => {
      if (pollingRef.current) clearTimeout(pollingRef.current);
    };
  }, [orderId]);

  // Confetti animation (same logic as PaymentSuccessModal)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#ff7a1a', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6'];
    const confetti = Array.from({ length: 150 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      r: Math.random() * 6 + 4,
      d: Math.random() * 150 + 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      tilt: Math.random() * 10 - 10,
      tiltAngle: 0,
      tiltAngleIncrement: Math.random() * 0.07 + 0.05,
    }));

    let animId: number;
    const startTime = performance.now();
    const SPAWN_DURATION = 5000;

    function draw(now: number) {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const stopSpawning = now - startTime > SPAWN_DURATION;

      confetti.forEach((c, i) => {
        ctx.beginPath();
        ctx.lineWidth = c.r;
        ctx.strokeStyle = c.color;
        ctx.moveTo(c.x + c.tilt + c.r / 4, c.y);
        ctx.lineTo(c.x + c.tilt, c.y + c.tilt + c.r / 4);
        ctx.stroke();

        c.tiltAngle += c.tiltAngleIncrement;
        c.y += (Math.cos(c.d) + 3 + c.r / 2) / 2;
        c.x += Math.sin(c.d);
        c.tilt = Math.sin(c.tiltAngle) * 15;

        if (c.y > canvas.height && !stopSpawning) {
          confetti[i] = { ...c, x: Math.random() * canvas.width, y: -20, tilt: Math.random() * 10 - 10 };
        }
      });

      if (stopSpawning && confetti.every((c) => c.y > canvas.height)) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
      }

      animId = requestAnimationFrame(draw);
    }

    animId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animId);
  }, []);

  const zaloLink = orderStatus?.zalo_link;
  // Admin-authored HTML replaces the whole thank-you page (tokens already resolved
  // server-side). Rendered in an isolated srcdoc iframe — same as the landing builder.
  const customHtml = (orderStatus?.success_config as { html?: string } | null | undefined)?.html?.trim();

  if (customHtml && !error) {
    return (
      <main className="min-h-screen bg-white">
        <LandingSectionFrame html={customHtml} frameId={`success-${orderId ?? 'page'}`} title="Trang cảm ơn" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-50" />

      <div className="relative z-[51] w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        {loading && !orderStatus && <FunnelSuccessSkeleton />}

        {error && (
          <p className="text-red-600">{error}</p>
        )}

        {(!loading || orderStatus) && !error && (
          <>
            <div className="mb-4 text-6xl">🎉</div>
            <h2 className="mb-2 text-2xl font-bold text-gray-900">CHÚC MỪNG!</h2>
            <p className="mb-6 text-gray-600">
              Bạn đã đăng ký thành công!
            </p>

            {zaloLink && (
              <a
                href={zaloLink}
                target="_blank"
                rel="noreferrer"
                className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-500 py-4 text-lg font-bold text-white transition hover:bg-blue-600"
              >
                <ExternalLink className="h-5 w-5" />
                TRUY CẬP NHÓM ZALO
              </a>
            )}

            <a
              href={`/funnels/${slug}`}
              className="flex w-full items-center justify-center rounded-xl bg-orange-500 py-4 text-lg font-bold text-white transition hover:bg-orange-600"
            >
              VỀ TRANG SẢN PHẨM
            </a>
          </>
        )}
      </div>
    </main>
  );
}
