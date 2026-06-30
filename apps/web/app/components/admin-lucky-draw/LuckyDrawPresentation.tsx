'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2, Mail, PartyPopper, Phone, RotateCcw, Sparkles, Trophy, Users } from 'lucide-react';
import {
  adminLuckyEventsApi,
  getApiErrorMessage,
  type LuckyEvent,
  type LuckyPrize,
  type LuckyWinner,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';
import { LuckyDrawWheel, type LuckyDrawWheelHandle } from './LuckyDrawWheel';
import { maskEmail, maskPhone } from './luckyDrawMask';

const POLL_INTERVAL_MS = 2000; // Cập nhật số người tham gia gần thời gian thực.
const MIN_SPIN_MS = 1100; // Đảm bảo vòng quay hiển thị đủ lâu dù server phản hồi nhanh.
const WHEEL_CAP = 60; // Số nan tối đa hiển thị; đủ nhiều để phản ánh quy mô đám đông.

function remaining(prize: LuckyPrize) {
  return Math.max(0, prize.quantity - prize.awarded_count);
}

// Lấy ngẫu nhiên tối đa `k` phần tử khác nhau (giữ nguyên khi ít hơn k).
function sample(arr: string[], k: number): string[] {
  if (arr.length <= k) return [...arr];
  const copy = [...arr];
  for (let i = 0; i < k; i += 1) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, k);
}

// Hiệu ứng (aurora / confetti) — định nghĩa cục bộ cho trang trình chiếu.
const STYLES = `
@keyframes ld-float { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(40px,-40px) scale(1.12)} }
@keyframes ld-rise  { 0%{transform:translateY(16px) scale(.92);opacity:0} 100%{transform:translateY(0) scale(1);opacity:1} }
@keyframes ld-fall  { to{ transform:translateY(105vh) rotate(540deg) } }
.ld-blob{position:absolute;border-radius:50%;mix-blend-mode:screen;animation:ld-float 12s ease-in-out infinite}
.ld-rise{animation:ld-rise .7s cubic-bezier(.2,1,.3,1)}
.ld-confetti{position:fixed;top:-12px;width:9px;height:13px;border-radius:2px;z-index:40;animation:ld-fall linear forwards}
@media (prefers-reduced-motion: reduce){ .ld-blob,.ld-rise,.ld-confetti{animation:none!important} }
`;

export function LuckyDrawPresentation({ eventId }: { eventId: string }) {
  const router = useRouter();
  const { error: toastError, success: toastSuccess } = useToast();

  const [event, setEvent] = useState<LuckyEvent | null>(null);
  const [prizes, setPrizes] = useState<LuckyPrize[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [participantCount, setParticipantCount] = useState(0);
  const [winners, setWinners] = useState<LuckyWinner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPrizeId, setSelectedPrizeId] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [wheelSegments, setWheelSegments] = useState<string[]>(['…']);
  const [revealed, setRevealed] = useState<LuckyWinner | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const [countBump, setCountBump] = useState(false);

  const wheelRef = useRef<LuckyDrawWheelHandle>(null);
  const prevCount = useRef(0);
  const confettiHost = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      adminLuckyEventsApi.get(eventId),
      adminLuckyEventsApi.listPrizes(eventId),
      adminLuckyEventsApi.listParticipants(eventId),
      adminLuckyEventsApi.listWinners(eventId),
    ])
      .then(([ev, pr, parts, win]) => {
        if (!mounted) return;
        setEvent(ev);
        setPrizes(pr);
        const nm = parts.map((p) => p.display_name);
        setNames(nm);
        setWheelSegments(nm.length ? sample(nm, WHEEL_CAP) : ['…']);
        setParticipantCount(parts.length);
        setWinners(win);
        const firstAvailable = pr.find((p) => remaining(p) > 0);
        if (firstAvailable) setSelectedPrizeId(firstAvailable.id);
      })
      .catch((e) => mounted && toastError(getApiErrorMessage(e, 'Failed to load draw data')))
      .finally(() => mounted && setIsLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Polling: cập nhật số người đã tham gia + danh sách tên (gần realtime).
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const parts = await adminLuckyEventsApi.listParticipants(eventId);
        setNames(parts.map((p) => p.display_name));
        setParticipantCount(parts.length);
      } catch {
        // Bỏ qua lỗi polling để không làm gián đoạn màn trình chiếu.
      }
    }, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [eventId]);

  // Hiệu ứng "pop" mỗi khi số người tham gia thay đổi.
  useEffect(() => {
    if (participantCount === prevCount.current) return;
    prevCount.current = participantCount;
    setCountBump(true);
    const t = setTimeout(() => setCountBump(false), 600);
    return () => clearTimeout(t);
  }, [participantCount]);

  const burstConfetti = useCallback(() => {
    const host = confettiHost.current;
    if (!host) return;
    const colors = ['#fcd34d', '#f59e0b', '#a855f7', '#14b8a6', '#ffffff'];
    for (let i = 0; i < 70; i += 1) {
      const piece = document.createElement('div');
      piece.className = 'ld-confetti';
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDuration = `${1.8 + Math.random() * 1.8}s`;
      piece.style.animationDelay = `${Math.random() * 0.3}s`;
      host.appendChild(piece);
      setTimeout(() => piece.remove(), 3800);
    }
  }, []);

  async function handleSpin() {
    if (spinning || !selectedPrizeId) return;
    setSpinning(true);
    setRevealed(null);

    // Bắt đầu vòng quay tự do ngay để phản hồi tức thì.
    setWheelSegments(names.length ? sample(names, WHEEL_CAP) : ['…']);
    requestAnimationFrame(() => wheelRef.current?.startFree());

    try {
      const [winner] = await Promise.all([
        adminLuckyEventsApi.spin(eventId, selectedPrizeId),
        new Promise((r) => setTimeout(r, MIN_SPIN_MS)),
      ]);
      const winnerName = winner.display_name ?? 'Người trúng giải';
      // Người trúng luôn nằm ở nan số 0; vòng quay sẽ dừng tại đó.
      const others = sample(names.filter((nm) => nm !== winnerName), WHEEL_CAP - 1);
      setWheelSegments([winnerName, ...others]);
      // Đợi React commit danh sách nan mới trước khi tính điểm dừng.
      requestAnimationFrame(() =>
        requestAnimationFrame(() =>
          wheelRef.current?.stopAt(0, () => {
            setRevealed(winner);
            setWinners((prev) => [...prev, winner]);
            setPrizes((prev) =>
              prev.map((p) => (p.id === winner.prize_id ? { ...p, awarded_count: p.awarded_count + 1 } : p)),
            );
            burstConfetti();
            setSpinning(false);
            toastSuccess(`Chúc mừng ${winnerName} đã trúng giải!`);
          }),
        ),
      );
    } catch (e) {
      wheelRef.current?.stop();
      setSpinning(false);
      toastError(getApiErrorMessage(e, 'Spin failed'));
    }
  }

  async function handleDiscard() {
    if (!revealed || discarding) return;
    const who = revealed.display_name ?? 'người này';
    if (!window.confirm(`Loại "${who}" khỏi sự kiện và quay lại giải này?`)) return;
    const target = revealed;
    setDiscarding(true);
    try {
      await adminLuckyEventsApi.discardWinner(eventId, target.id);
      setWinners((prev) => prev.filter((w) => w.id !== target.id));
      setPrizes((prev) =>
        prev.map((p) => (p.id === target.prize_id ? { ...p, awarded_count: Math.max(0, p.awarded_count - 1) } : p)),
      );
      setNames((prev) => {
        const i = prev.indexOf(target.display_name ?? '');
        if (i < 0) return prev;
        const copy = [...prev];
        copy.splice(i, 1);
        return copy;
      });
      setParticipantCount((c) => Math.max(0, c - 1));
      setSelectedPrizeId(target.prize_id);
      setRevealed(null);
      toastSuccess('Đã loại người trúng giải. Bạn có thể quay lại giải này.');
    } catch (e) {
      toastError(getApiErrorMessage(e, 'Không thể loại người trúng giải'));
    } finally {
      setDiscarding(false);
    }
  }

  if (isLoading) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#070b18] text-white">
        <Loader2 className="h-8 w-8 animate-spin text-amber-300" />
      </main>
    );
  }

  const selectedPrize = prizes.find((p) => p.id === selectedPrizeId);
  const canSpin = !!selectedPrize && remaining(selectedPrize) > 0 && !spinning;
  const isOpen = event?.status === 'open';

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[#070b18] text-[#eef2ff]">
      <style>{STYLES}</style>

      {/* Nền aurora chuyển động */}
      <div aria-hidden className="pointer-events-none absolute inset-[-20%] z-0 opacity-80 blur-[70px]">
        <i className="ld-blob h-[520px] w-[520px] bg-blue-500" style={{ left: '5%', top: '10%' }} />
        <i className="ld-blob h-[460px] w-[460px] bg-fuchsia-500" style={{ right: '8%', top: '18%', animationDelay: '-3s' }} />
        <i className="ld-blob h-[480px] w-[480px] bg-teal-500" style={{ left: '30%', bottom: '0', animationDelay: '-6s' }} />
        <i className="ld-blob h-[360px] w-[360px] bg-amber-500" style={{ right: '28%', bottom: '6%', animationDelay: '-9s' }} />
      </div>

      {/* Thanh trên: Thoát + đếm người tham gia realtime */}
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => router.push(`/admin/lucky-draw/${eventId}/edit/spin`)}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white/80 backdrop-blur transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Thoát
        </button>

        <div className="inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold backdrop-blur">
          <span className="relative flex h-2.5 w-2.5" aria-hidden>
            {isOpen && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${isOpen ? 'bg-emerald-400' : 'bg-white/40'}`} />
          </span>
          <Users className="h-4 w-4 text-white/70" />
          <span aria-live="polite">
            <span
              className={`inline-block origin-center tabular-nums transition-all duration-300 ${
                countBump ? 'scale-[1.6] text-emerald-300' : 'scale-100 text-amber-300'
              }`}
            >
              {participantCount}
            </span>{' '}
            người đã tham gia
          </span>
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-dvh max-w-4xl flex-col items-center justify-center gap-7 px-6 py-24 text-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-200 sm:text-sm">{event?.title}</p>
          <h1 className="mt-2 inline-flex items-center gap-3 text-3xl font-extrabold sm:text-4xl">
            <Sparkles className="h-8 w-8 text-amber-300" />
            Vòng quay may mắn
          </h1>
        </div>

        {/* Chọn giải thưởng */}
        <div className="flex flex-wrap items-center justify-center gap-2.5">
          {prizes.map((prize) => {
            const left = remaining(prize);
            const active = prize.id === selectedPrizeId;
            return (
              <button
                key={prize.id}
                type="button"
                disabled={spinning || left === 0}
                onClick={() => setSelectedPrizeId(prize.id)}
                className={`rounded-full border px-4 py-2 text-sm font-semibold backdrop-blur transition ${
                  active
                    ? 'border-transparent bg-gradient-to-br from-amber-300 to-amber-500 text-slate-900 shadow-lg shadow-amber-500/40'
                    : 'border-white/25 bg-white/5 text-white/80 hover:bg-white/10'
                } ${left === 0 ? 'opacity-40' : ''}`}
              >
                {prize.name} · còn {left}
              </button>
            );
          })}
        </div>

        {/* Vòng quay trúng thưởng */}
        <div className="flex w-full justify-center">
          <LuckyDrawWheel ref={wheelRef} segments={wheelSegments} total={participantCount} />
        </div>

        {/* Trạng thái / thông tin người trúng */}
        {revealed ? (
          <div className="ld-rise flex w-full max-w-md flex-col items-center gap-2 rounded-2xl border border-amber-300/60 bg-white/[0.06] px-6 py-4 backdrop-blur-xl">
            <p className="inline-flex items-center gap-2 text-lg font-bold text-amber-300">
              <PartyPopper className="h-5 w-5" />
              Chúc mừng! Trúng {revealed.prize_name ?? selectedPrize?.name}
            </p>
            <p className="text-2xl font-extrabold text-amber-100 sm:text-3xl">{revealed.display_name ?? '—'}</p>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-sm text-white/70">
              <span className="font-mono text-xs text-white/45" title={revealed.participant_id}>
                ID: #{revealed.participant_id.slice(0, 8)}
              </span>
              {revealed.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-white/50" />
                  {maskPhone(revealed.phone)}
                </span>
              )}
              {revealed.email && (
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-white/50" />
                  {maskEmail(revealed.email)}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleDiscard}
              disabled={discarding}
              className="mt-1 inline-flex items-center gap-2 rounded-full border border-rose-400/40 bg-rose-500/10 px-4 py-1.5 text-sm font-semibold text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {discarding ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
              Loại & quay lại
            </button>
          </div>
        ) : (
          <p className="text-sm text-white/55">
            {canSpin ? 'Nhấn “Quay” để chọn người trúng giải' : 'Giải này đã trao đủ — hãy chọn giải khác'}
          </p>
        )}

        <button
          type="button"
          onClick={handleSpin}
          disabled={!canSpin}
          className="inline-flex h-14 items-center gap-3 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 px-12 text-lg font-extrabold text-slate-900 shadow-[0_14px_40px_rgba(245,158,11,0.4)] transition hover:from-amber-200 hover:to-amber-400 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {spinning ? <Loader2 className="h-6 w-6 animate-spin" /> : <Sparkles className="h-6 w-6" />}
          {spinning ? 'Đang quay…' : 'Quay'}
        </button>

        {/* Danh sách người trúng giải */}
        {winners.length > 0 && (
          <div className="w-full max-w-2xl rounded-[18px] border border-white/10 bg-slate-950/75 p-4 text-left shadow-xl shadow-black/40 backdrop-blur-xl">
            <p className="mb-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-indigo-200">
              <Trophy className="h-4 w-4 text-amber-300" />
              Người trúng giải ({winners.length})
            </p>
            <ul className="max-h-56 space-y-1 overflow-auto pr-1">
              {winners.map((w) => (
                <li key={w.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm odd:bg-white/[0.04]">
                  <span className="min-w-0 truncate">
                    <span className="tabular-nums text-white/50">{w.spin_order}.</span>{' '}
                    <span className="font-semibold">{w.display_name ?? '—'}</span>
                    {w.phone && <span className="ml-2 text-xs font-normal text-white/45">· {maskPhone(w.phone)}</span>}
                    {w.email && <span className="ml-2 text-xs font-normal text-white/40">· {maskEmail(w.email)}</span>}
                  </span>
                  <span className="shrink-0 font-medium text-amber-300">{w.prize_name ?? ''}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Lớp confetti */}
      <div ref={confettiHost} aria-hidden className="pointer-events-none fixed inset-0 z-40" />
    </main>
  );
}
