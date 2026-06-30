'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, Loader2, Search, Users } from 'lucide-react';
import {
  adminFunnelsApi, adminLeadsApi, getAccessToken, getApiErrorMessage,
  type Funnel, type Lead, type LeadListFilter, type LeadListPage, type LeadStatus,
} from '@coachio/api-client';
import { useToast } from '../shared/toast';

const PAGE_SIZE = 20;

/** Status pill with a dot — green "Purchased", blue "Subscribed", neutral "Lead". */
function LeadStatusBadge({ status, amount }: { status?: LeadStatus; amount?: number }) {
  const purchased = status === 'purchased';
  const subscribed = status === 'subscribed';
  const title = purchased && amount ? `${amount.toLocaleString('vi-VN')} đ` : undefined;

  let colorClass: string;
  let label: string;
  if (purchased) {
    colorClass = 'border-[var(--coachio-admin-dashboard-success-border)] bg-[var(--coachio-admin-dashboard-success-bg)] text-[var(--coachio-admin-dashboard-success-text)]';
    label = 'Purchased';
  } else if (subscribed) {
    colorClass = 'border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] text-[var(--coachio-admin-dashboard-accent)]';
    label = 'Subscribed';
  } else {
    colorClass = 'border-[var(--coachio-admin-dashboard-neutral-border)] bg-[var(--coachio-admin-dashboard-neutral-bg)] text-[var(--coachio-admin-dashboard-neutral-text)]';
    label = 'Lead';
  }

  const dotClass = purchased
    ? 'bg-[var(--coachio-admin-dashboard-success-text)]'
    : subscribed
    ? 'bg-[var(--coachio-admin-dashboard-accent)]'
    : 'bg-[var(--coachio-admin-dashboard-neutral-text)]';

  return (
    <span
      title={title}
      className={`inline-flex h-7 w-fit items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${colorClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {label}
    </span>
  );
}

interface AdminLeadsManagementProps {
  /** Khi set, khoá danh sách theo 1 funnel (ẩn dropdown chọn funnel) — dùng trong funnel editor. */
  funnelId?: string;
}

export function AdminLeadsManagement({ funnelId }: AdminLeadsManagementProps = {}) {
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [page, setPage] = useState<LeadListPage | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<LeadListFilter>({ page: 1, page_size: PAGE_SIZE, funnel_id: funnelId });
  const [emailInput, setEmailInput] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const { success, error: toastError } = useToast();

  useEffect(() => {
    // Dropdown chọn funnel chỉ cần ở trang leads toàn cục; khi đã khoá theo funnel thì bỏ qua.
    if (funnelId) return;
    adminFunnelsApi.list().then(setFunnels).catch(() => undefined);
  }, [funnelId]);

  // Debounce ô tìm theo email — tránh gọi API mỗi lần gõ phím.
  useEffect(() => {
    const id = setTimeout(() => {
      applyFilter({ email: emailInput.trim() || undefined });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailInput]);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    setError('');
    adminLeadsApi
      .list(filter)
      .then((data) => { if (mounted) setPage(data); })
      .catch((e) => { if (mounted) setError(getApiErrorMessage(e, 'Failed to load leads')); })
      .finally(() => { if (mounted) setIsLoading(false); });
    return () => { mounted = false; };
  }, [filter]);

  function applyFilter(partial: Partial<LeadListFilter>) {
    setFilter((prev) => ({ ...prev, ...partial, page: 1 }));
  }

  async function handleExportCsv() {
    setIsExporting(true);
    try {
      const { funnel_id, status, created_from, created_to, email } = filter;
      const path = adminLeadsApi.exportCsvPath({ funnel_id, status, created_from, created_to, email });
      // apiClient handles base URL; we need to use fetch with auth header
      const token = typeof window !== 'undefined' ? getAccessToken() : null;
      const baseUrl = process.env.NEXT_PUBLIC_API_URL?.replace('/api/v1', '') ?? '';
      const resp = await fetch(`${baseUrl}${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads.csv';
      a.click();
      URL.revokeObjectURL(url);
      success('Leads CSV exported');
    } catch (e) {
      const msg = getApiErrorMessage(e, 'Failed to export CSV');
      setError(msg);
      toastError(msg);
    } finally {
      setIsExporting(false);
    }
  }

  const totalPages = page ? Math.ceil(page.total / PAGE_SIZE) : 1;
  const currentPage = filter.page ?? 1;

  // Resolve a funnel name for the badge from the already-loaded funnels list —
  // keeps the badge working even if the API response omits `funnel_title`.
  const funnelTitleById = useMemo(
    () => new Map(funnels.map((f) => [f.id, f.title] as const)),
    [funnels],
  );

  // Funnel badge only adds value in the global leads view; inside a funnel
  // editor the funnel is already implied, so drop the column to reduce noise.
  const showFunnel = !funnelId;
  const gridCols = showFunnel
    ? 'md:grid-cols-[minmax(0,1fr)_150px_minmax(0,1fr)_130px_120px_110px]'
    : 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_130px_120px_110px]';

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] p-6 shadow-[var(--coachio-admin-dashboard-shadow-sm)] lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-3 py-1 text-xs font-semibold uppercase text-[var(--coachio-admin-dashboard-accent)]">
            <Users className="h-4 w-4" />
            Leads
          </div>
          <h2 className="text-2xl font-semibold text-[var(--coachio-admin-dashboard-text)]">Leads List</h2>
          <p className="mt-2 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
            Potential customers via funnels. Total: {page?.total ?? '—'}
          </p>
        </div>
        <button
          type="button"
          onClick={handleExportCsv}
          disabled={isExporting}
          className="inline-flex h-10 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-4 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] disabled:opacity-50 hover:text-[var(--coachio-admin-dashboard-text)]"
        >
          {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--coachio-admin-dashboard-text-soft)]" />
          <input
            type="search"
            className="w-64 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] py-2 pl-9 pr-3 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none focus:border-[var(--coachio-admin-dashboard-accent)]"
            value={emailInput}
            onChange={(e) => setEmailInput(e.target.value)}
            placeholder="Search by email"
          />
        </div>
        {!funnelId && (
          <select
            className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none"
            value={filter.funnel_id ?? ''}
            onChange={(e) => applyFilter({ funnel_id: e.target.value || undefined })}
          >
            <option value="">All funnels</option>
            {funnels.map((f) => (
              <option key={f.id} value={f.id}>{f.title}</option>
            ))}
          </select>
        )}
        <select
          className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none"
          value={filter.status ?? ''}
          onChange={(e) => applyFilter({ status: (e.target.value || undefined) as LeadStatus | undefined })}
        >
          <option value="">All statuses</option>
          <option value="purchased">Purchased</option>
          <option value="lead">Lead (not purchased)</option>
          <option value="subscribed">Subscribed (opt-in)</option>
        </select>
        <input
          type="date"
          className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none"
          value={filter.created_from ?? ''}
          onChange={(e) => applyFilter({ created_from: e.target.value || undefined })}
          placeholder="From date"
        />
        <input
          type="date"
          className="rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2 text-sm text-[var(--coachio-admin-dashboard-text)] outline-none"
          value={filter.created_to ?? ''}
          onChange={(e) => applyFilter({ created_to: e.target.value || undefined })}
          placeholder="To date"
        />
      </div>

      {isLoading && (
        <div className="flex items-center gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-5 text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--coachio-admin-dashboard-accent)]" />
          Loading...
        </div>
      )}

      {error && (
        <div className="flex items-start gap-3 rounded-[var(--coachio-admin-dashboard-radius-md)] border border-[var(--coachio-admin-dashboard-danger-border)] bg-[var(--coachio-admin-dashboard-danger-bg)] px-4 py-3 text-sm text-[var(--coachio-admin-dashboard-danger-text)]">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" /><span>{error}</span>
        </div>
      )}

      {/* Table */}
      {!isLoading && page && (
        <>
          <div className="overflow-hidden rounded-[var(--coachio-admin-dashboard-radius-lg)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]">
            <div className={`hidden ${gridCols} border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] px-6 py-3.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--coachio-admin-dashboard-text-soft)] md:grid`}>
              <span>Customer</span>
              {showFunnel && <span>Funnel</span>}
              <span>Email</span>
              <span>Phone</span>
              <span>Created</span>
              <span className="text-right md:text-left">Status</span>
            </div>
            {page.items.length === 0 ? (
              <div className="px-5 py-16 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--coachio-admin-dashboard-surface-muted)]">
                  <Users className="h-6 w-6 text-[var(--coachio-admin-dashboard-text-soft)]" />
                </div>
                <p className="mt-3 text-sm font-medium text-[var(--coachio-admin-dashboard-text)]">No leads found.</p>
                <p className="mt-1 text-xs text-[var(--coachio-admin-dashboard-text-muted)]">Try adjusting filters or share your funnel to start collecting leads.</p>
              </div>
            ) : page.items.map((lead: Lead) => (
              <div
                key={lead.id}
                className={`grid gap-x-4 gap-y-2 border-b border-[var(--coachio-admin-dashboard-border-subtle)] px-6 py-4 transition-colors last:border-b-0 hover:bg-[var(--coachio-admin-dashboard-surface-muted)] ${gridCols} md:items-center`}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[var(--coachio-admin-dashboard-text)]">{lead.name ?? '—'}</p>
                </div>
                {showFunnel && (
                  <div className="min-w-0">
                    <span className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border border-[var(--coachio-admin-dashboard-accent-soft)] bg-[var(--coachio-admin-dashboard-accent-soft)] px-2.5 py-1 text-xs font-medium text-[var(--coachio-admin-dashboard-accent)]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--coachio-admin-dashboard-accent)]" />
                      <span className="truncate">{lead.funnel_title ?? funnelTitleById.get(lead.source_funnel_id) ?? '—'}</span>
                    </span>
                  </div>
                )}
                <p className="truncate text-sm text-[var(--coachio-admin-dashboard-text-muted)]">{lead.email}</p>
                <p className="text-sm tabular-nums text-[var(--coachio-admin-dashboard-text-muted)]">{lead.phone ?? '—'}</p>
                <p className="text-xs tabular-nums text-[var(--coachio-admin-dashboard-text-muted)]">
                  {new Date(lead.created_at).toLocaleString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </p>
                <div className="md:justify-self-start">
                  <LeadStatusBadge status={lead.status} amount={lead.purchase_amount} />
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-[var(--coachio-admin-dashboard-text-muted)]">
                Page {currentPage} / {totalPages} — {page.total} leads
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFilter((prev) => ({ ...prev, page: Math.max(1, currentPage - 1) }))}
                  disabled={currentPage <= 1}
                  className="inline-flex h-8 items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setFilter((prev) => ({ ...prev, page: Math.min(totalPages, currentPage + 1) }))}
                  disabled={currentPage >= totalPages}
                  className="inline-flex h-8 items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] px-3 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
