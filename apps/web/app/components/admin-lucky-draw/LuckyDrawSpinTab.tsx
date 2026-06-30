'use client';

import { Maximize2, PlayCircle } from 'lucide-react';
import type { LuckyEventStatus } from '@coachio/api-client';
import { cardClass, primaryButtonClass } from './luckyDrawStyles';

interface LuckyDrawSpinTabProps {
  eventId: string;
  status: LuckyEventStatus;
}

export function LuckyDrawSpinTab({ eventId, status }: LuckyDrawSpinTabProps) {
  function openPresentation() {
    window.open(`/admin/lucky-draw/${eventId}/present`, '_blank', 'noopener,noreferrer');
  }

  return (
    <div className="space-y-4">
      <div className={cardClass}>
        <div className="mb-3 inline-flex items-center gap-2 text-base font-semibold text-[var(--coachio-admin-dashboard-text)]">
          <PlayCircle className="h-5 w-5 text-[var(--coachio-admin-dashboard-accent)]" />
          Live draw
        </div>
        <p className="text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
          Open the fullscreen presentation on the projector. Pick a prize, hit Spin, and the wheel reveals the
          server-selected winner. Lock registration first so the participant pool is final.
        </p>
        {status === 'open' && (
          <p className="mt-3 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-warning-border)] bg-[var(--coachio-admin-dashboard-warning-bg)] px-3 py-2 text-xs font-semibold text-[var(--coachio-admin-dashboard-warning-text)]">
            Registration is still open. New attendees can still join the pool until you lock it.
          </p>
        )}
        <button type="button" onClick={openPresentation} className={`${primaryButtonClass} mt-4`}>
          <Maximize2 className="h-4 w-4" />
          Open presentation
        </button>
      </div>
    </div>
  );
}
