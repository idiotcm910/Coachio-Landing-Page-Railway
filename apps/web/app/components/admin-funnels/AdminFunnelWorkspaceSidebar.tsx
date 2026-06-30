'use client';

import { useEffect, useState } from 'react';
import {
  ArrowLeft, BarChart3, CheckCircle, CreditCard, Eye, Globe, Image as ImageIcon, Loader2, Mail, Package, PanelLeftClose, PanelLeftOpen, Rocket, Send, Tag, Users, Variable, Radar,
} from 'lucide-react';
import type { FunnelStatus } from '@coachio/api-client';
import { FunnelStatusBadge } from './FunnelStatusBadge';

export type FunnelWorkspace =
  | 'analytics'
  | 'landing' | 'checkout' | 'success' | 'email' | 'discounts' | 'variables'
  | 'product' | 'leads' | 'tracking' | 'media' | 'broadcasts';

interface SidebarItem {
  id: FunnelWorkspace;
  label: string;
  icon: typeof Globe;
}

interface SidebarGroup {
  label: string;
  items: SidebarItem[];
}

// Group 1 = funnel pages (presentation + sales config); Group 2 = product & leads;
// the last group "Analytics" is pinned to the bottom of the sidebar (mt-auto).
const GROUPS: SidebarGroup[] = [
  {
    label: 'Funnel pages',
    items: [
      { id: 'landing', label: 'Landing page', icon: Globe },
      { id: 'checkout', label: 'Checkout', icon: CreditCard },
      { id: 'success', label: 'Thank-you page', icon: CheckCircle },
      { id: 'email', label: 'Email', icon: Mail },
      { id: 'broadcasts', label: 'Email campaigns', icon: Send },
      { id: 'discounts', label: 'Discounts', icon: Tag },
      { id: 'variables', label: 'Custom variables', icon: Variable },
      { id: 'tracking', label: 'Tracking (Meta)', icon: Radar },
    ],
  },
  {
    label: 'Product & Leads',
    items: [
      { id: 'product', label: 'Product', icon: Package },
      { id: 'leads', label: 'Leads', icon: Users },
    ],
  },
  {
    label: 'Library',
    items: [
      { id: 'media', label: 'Media Library', icon: ImageIcon },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { id: 'analytics', label: 'Analytics & Traffic', icon: BarChart3 },
    ],
  },
];

const STORAGE_KEY = 'coachio:funnel-edit-sidebar-collapsed';

interface AdminFunnelWorkspaceSidebarProps {
  activeWorkspace: FunnelWorkspace;
  status: FunnelStatus;
  /** Funnel slug — used to construct the preview URL `/funnels/{slug}/preview`. */
  slug: string;
  isSavingStatus: boolean;
  onBack: () => void;
  onNavigate: (workspace: FunnelWorkspace) => void;
  onToggleStatus: () => void;
}

/**
 * Navigation sidebar for the funnel edit workspace.
 * - Provides a back button (to the funnel list) and a collapse button (icon-only).
 * - Collapsed state is persisted to localStorage so it survives workspace switches.
 * Mirrors the AdminCourseWorkspaceSidebar pattern for a consistent UX.
 */
export function AdminFunnelWorkspaceSidebar({
  activeWorkspace,
  status,
  slug,
  isSavingStatus,
  onBack,
  onNavigate,
  onToggleStatus,
}: AdminFunnelWorkspaceSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.localStorage.getItem(STORAGE_KEY) === '1') {
      setCollapsed(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  const itemBase = collapsed ? 'justify-center' : 'justify-start';

  return (
    <aside className={`sticky top-0 z-20 flex h-screen shrink-0 flex-col border-r border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] ${collapsed ? 'w-[64px]' : 'w-60'}`}>
      {/* Header: collapse toggle only */}
      <div className={`flex items-center border-b border-[var(--coachio-admin-dashboard-border-subtle)] px-3 py-3 ${collapsed ? 'justify-center' : 'justify-end'}`}>
        <button
          type="button"
          onClick={toggleCollapsed}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Back button */}
      <div className="border-b border-[var(--coachio-admin-dashboard-border-subtle)] p-2 md:p-3">
        <button
          type="button"
          onClick={onBack}
          title="Back to funnels"
          className={`flex w-full items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] ${collapsed ? 'justify-center' : 'justify-start'}`}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Funnels</span>}
        </button>
      </div>

      {/* Workspace nav — groups with dividers between them */}
      <nav className="flex-1 overflow-y-auto p-2 md:p-3">
        {GROUPS.map((group, groupIdx) => (
          <div
            key={group.label}
            className={
              groupIdx > 0
                ? 'mt-3 border-t border-[var(--coachio-admin-dashboard-border-subtle)] pt-3'
                : undefined
            }
          >
            {!collapsed && (
              <p className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active = activeWorkspace === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onNavigate(item.id)}
                    title={item.label}
                    aria-current={active ? 'page' : undefined}
                    className={`flex w-full items-center gap-3 rounded-[var(--coachio-admin-dashboard-radius-sm)] px-3 py-2.5 text-sm font-semibold transition ${itemBase} ${
                      active
                        ? 'bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]'
                        : 'text-[var(--coachio-admin-dashboard-text-muted)] hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]'
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {!collapsed && <span className="min-w-0 flex-1 text-left">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer pinned to bottom — Publish / Unpublish button, split from the menu by a divider */}
      <div className="mt-auto border-t border-[var(--coachio-admin-dashboard-border)] p-2 md:p-3">
        {!collapsed && (
          <div className="mb-2 flex items-center justify-between gap-2 px-1">
            <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Status</span>
            <FunnelStatusBadge status={status} />
          </div>
        )}
        <button
          type="button"
          onClick={onToggleStatus}
          disabled={isSavingStatus}
          title={status === 'published' ? 'Unpublish' : 'Publish'}
          aria-label={status === 'published' ? 'Unpublish' : 'Publish'}
          className="flex w-full items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] bg-[var(--coachio-admin-dashboard-accent)] px-3 py-2.5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-inverse)] transition hover:bg-[var(--coachio-admin-dashboard-accent-hover)] disabled:opacity-50"
        >
          {isSavingStatus ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <Rocket className="h-4 w-4 shrink-0" />}
          {!collapsed && <span>{status === 'published' ? 'Unpublish' : 'Publish'}</span>}
        </button>
        {/* Open preview in new tab — available regardless of publish status */}
        <a
          href={`/funnels/${slug}/preview`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open preview"
          aria-label="Open preview"
          className="mt-2 flex w-full items-center justify-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]"
        >
          <Eye className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Preview</span>}
        </a>
      </div>
    </aside>
  );
}
