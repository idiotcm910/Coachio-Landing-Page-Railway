'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

/**
 * Vòng quay trúng thưởng (prize wheel). Presentational + imperative:
 *   - `startFree()` spins the wheel continuously (visual filler while the
 *     server decides the winner).
 *   - `stopAt(index, onRest)` decelerates so the segment at `index` lands under
 *     the top pointer, then invokes `onRest`.
 * The animation never decides the outcome — the parent passes the index of the
 * server-selected winner. See design.md (decision 3).
 */
export interface LuckyDrawWheelHandle {
  startFree: () => void;
  stopAt: (index: number, onRest: () => void) => void;
  stop: () => void;
}

const PALETTE = ['#f59e0b', '#a855f7', '#14b8a6', '#3b82f6', '#ec4899', '#22c55e'];
const R = 48;
const CENTER = 50;

// Point on the rim at `angle` degrees measured clockwise from the top.
function rim(angle: number, radius = R): [number, number] {
  const a = (angle * Math.PI) / 180;
  return [CENTER + radius * Math.sin(a), CENTER - radius * Math.cos(a)];
}

function segmentPath(i: number, seg: number): string {
  const [x0, y0] = rim(i * seg);
  const [x1, y1] = rim((i + 1) * seg);
  const largeArc = seg > 180 ? 1 : 0;
  return `M ${CENTER} ${CENTER} L ${x0.toFixed(3)} ${y0.toFixed(3)} A ${R} ${R} 0 ${largeArc} 1 ${x1.toFixed(3)} ${y1.toFixed(3)} Z`;
}

export const LuckyDrawWheel = forwardRef<LuckyDrawWheelHandle, { segments: string[]; total?: number }>(
  function LuckyDrawWheel({ segments, total }, ref) {
    const gRef = useRef<SVGGElement>(null);
    const rotationRef = useRef(0);
    const rafRef = useRef<number | null>(null);
    const restRef = useRef<(() => void) | null>(null);

    const n = Math.max(segments.length, 1);
    const seg = 360 / n;
    // Khi quá đông, ẩn chữ và chỉ hiển thị các nan màu để truyền tải quy mô
    // (người trúng vẫn được công bố ở thẻ kết quả bên dưới).
    const showLabels = n <= 18;
    const labelFont = n > 12 ? 2.2 : n > 8 ? 2.6 : 3.4;

    const apply = () => {
      if (gRef.current) gRef.current.style.transform = `rotate(${rotationRef.current}deg)`;
    };
    const cancelRaf = () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };

    // Fire the pending onRest callback once the deceleration transition ends.
    useEffect(() => {
      const el = gRef.current;
      if (!el) return;
      const onEnd = (e: TransitionEvent) => {
        if (e.propertyName !== 'transform') return;
        const cb = restRef.current;
        restRef.current = null;
        cb?.();
      };
      el.addEventListener('transitionend', onEnd);
      return () => el.removeEventListener('transitionend', onEnd);
    }, []);

    useImperativeHandle(ref, () => ({
      startFree() {
        cancelRaf();
        restRef.current = null;
        if (gRef.current) gRef.current.style.transition = 'none';
        const step = () => {
          rotationRef.current += 14;
          apply();
          rafRef.current = requestAnimationFrame(step);
        };
        rafRef.current = requestAnimationFrame(step);
      },
      stopAt(index, onRest) {
        cancelRaf();
        const center = (index + 0.5) * seg;
        const base = rotationRef.current + 360 * 5; // a few extra full turns
        const align = (((-center - base) % 360) + 360) % 360;
        const target = base + align;
        restRef.current = onRest;
        if (gRef.current) {
          gRef.current.style.transition = 'transform 4.2s cubic-bezier(0.16,1,0.3,1)';
          void gRef.current.getBoundingClientRect(); // flush before changing transform
          rotationRef.current = target;
          apply();
        }
      },
      stop() {
        cancelRaf();
        restRef.current = null;
        if (gRef.current) gRef.current.style.transition = 'none';
      },
    }));

    return (
      <div className="relative aspect-square w-full max-w-[32rem]">
        {/* Con trỏ ở đỉnh */}
        <div
          aria-hidden
          className="absolute left-1/2 top-[-6px] z-10 h-0 w-0 -translate-x-1/2"
          style={{
            borderLeft: '14px solid transparent',
            borderRight: '14px solid transparent',
            borderTop: '24px solid #fcd34d',
            filter: 'drop-shadow(0 3px 6px rgba(0,0,0,0.5))',
          }}
        />
        <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
          <circle cx={CENTER} cy={CENTER} r={R + 1.5} fill="#0b1020" stroke="rgba(255,255,255,0.25)" strokeWidth={0.5} />
          <g ref={gRef} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
            {segments.map((label, i) => {
              const [lx, ly] = rim((i + 0.5) * seg, R * 0.62);
              return (
                <g key={`${i}-${label}`}>
                  <path d={segmentPath(i, seg)} fill={PALETTE[i % PALETTE.length]} stroke="rgba(0,0,0,0.25)" strokeWidth={n > 24 ? 0.12 : 0.3} />
                  {showLabels && (
                    <text
                      x={lx}
                      y={ly}
                      fill="#0b1020"
                      fontSize={labelFont}
                      fontWeight={700}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${(i + 0.5) * seg}, ${lx}, ${ly})`}
                    >
                      {label.length > 14 ? `${label.slice(0, 13)}…` : label}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
          {/* Trục giữa */}
          <circle cx={CENTER} cy={CENTER} r={4} fill="#fcd34d" stroke="#0b1020" strokeWidth={0.6} />
        </svg>
        {/* Tổng số người tham gia — luôn hiển thị để phản ánh đúng quy mô */}
        {typeof total === 'number' && (
          <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full border border-white/25 bg-black/55 px-3 py-1 text-xs font-bold text-amber-200 backdrop-blur">
            {total} người tham gia
          </div>
        )}
      </div>
    );
  },
);
