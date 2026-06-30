'use client';

import { useState } from 'react';
import { Code2 } from 'lucide-react';
import { AdminLeadsManagement } from './AdminLeadsManagement';
import { FunnelLeadCaptureModal } from './FunnelLeadCaptureModal';

interface AdminFunnelLeadsWorkspaceProps {
  funnelId: string;
}

/**
 * Workspace "Leads" trong funnel editor — tái dùng AdminLeadsManagement nhưng khoá
 * theo funnel hiện tại (ẩn dropdown chọn funnel). Lọc trạng thái/ngày + export vẫn dùng được.
 * Thêm button "Lấy mã nhúng / API thu lead" mở modal FunnelLeadCaptureModal.
 */
export function AdminFunnelLeadsWorkspace({ funnelId }: AdminFunnelLeadsWorkspaceProps) {
  const [showCaptureModal, setShowCaptureModal] = useState(false);

  return (
    <>
      {/* Lead Capture API bar */}
      <div className="mb-5 flex items-center justify-between gap-4 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-4 py-3">
        <p className="text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
          Capture leads from any custom landing-page HTML via an API token — no Google Sheet needed.
        </p>
        <button
          type="button"
          onClick={() => setShowCaptureModal(true)}
          className="inline-flex shrink-0 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-1.5 text-sm font-semibold text-[var(--coachio-admin-dashboard-accent)] transition hover:bg-[var(--coachio-admin-dashboard-accent)] hover:text-white"
        >
          <Code2 className="h-4 w-4" />
          Get embed code / Lead API
        </button>
      </div>

      <AdminLeadsManagement funnelId={funnelId} />

      {showCaptureModal && (
        <FunnelLeadCaptureModal
          funnelId={funnelId}
          onClose={() => setShowCaptureModal(false)}
        />
      )}
    </>
  );
}
