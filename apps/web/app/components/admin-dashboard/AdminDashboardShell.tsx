'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, BarChart3, Dice5, Filter, Gift, Image as ImageIcon, Package, ReceiptText, Send, Tag, Users, Zap } from 'lucide-react';
import { adminDashboardToken } from '@coachio/design-system/admin-dashboard-token';
import { AdminDashboardSidebar } from './AdminDashboardSidebar';
import { AdminDiscountsManagement } from './AdminDiscountsManagement';
import { AdminMediaManagement } from './AdminMediaManagement';
import { AdminFunnelOrdersManagement } from './orders/AdminFunnelOrdersManagement';
import { AdminRevenueTabs } from './analytics/AdminRevenueTabs';
import { AdminProductManagement } from '../admin-funnels/AdminProductManagement';
import { AdminFunnelList } from '../admin-funnels/AdminFunnelList';
import { AdminLeadsManagement } from '../admin-funnels/AdminLeadsManagement';
import { AdminBroadcastManagement } from '../admin-broadcast/AdminBroadcastManagement';
import {
  AdminGiftManagement,
  AdminGiftAutomationManagement,
  AdminGiftCampaignManagement,
  AdminGiftGrantTracking,
} from '../admin-gifts';
import { AdminLuckyDrawManagement } from '../admin-lucky-draw/AdminLuckyDrawManagement';
import type { AdminDashboardMenuItem } from './types';

// Each menu has a dedicated route so the selection survives a refresh and is shareable.
// 'funnels' is the admin index default; each menu has its own page passing initialMenuId.
const menuItems: AdminDashboardMenuItem[] = [
  { id: 'funnels', label: 'Sales Funnels', group: 'Sales Funnel', path: '/admin/funnels', icon: Filter },
  { id: 'products', label: 'Products', group: 'Sales Funnel', path: '/admin/products', icon: Package },
  { id: 'leads', label: 'Leads', group: 'Sales Funnel', path: '/admin/leads', icon: Users },
  { id: 'lucky-draw', label: 'Lucky Draw', group: 'Sales Funnel', path: '/admin/lucky-draw', icon: Dice5 },
  { id: 'orders', label: 'Orders', group: 'Analytics', path: '/admin/orders', icon: ReceiptText },
  { id: 'revenue', label: 'Revenue', group: 'Analytics', path: '/admin/revenue', icon: BarChart3 },
  { id: 'discounts', label: 'Discounts', group: 'System', path: '/admin/discounts', icon: Tag },
  { id: 'broadcasts', label: 'Email Campaigns', group: 'System', path: '/admin/broadcasts', icon: Send },
  { id: 'gifts', label: 'Gift Packages', group: 'Gifts', path: '/admin/gifts', icon: Gift },
  { id: 'gift-automations', label: 'Gift Automations', group: 'Gifts', path: '/admin/gift-automations', icon: Zap },
  { id: 'gift-campaigns', label: 'Gift Campaigns', group: 'Gifts', path: '/admin/gift-campaigns', icon: Send },
  { id: 'gift-tracking', label: 'Grant Tracking', group: 'Gifts', path: '/admin/gift-tracking', icon: BarChart3 },
  { id: 'media', label: 'Media Library', group: 'System', path: '/admin/media', icon: ImageIcon },
];

// Default to the first active (non-maintenance) menu so a maintenance page never opens.
const defaultActiveItem = menuItems.find((item) => !item.maintenance) ?? menuItems[0];

interface AdminDashboardShellProps {
  /** Route-driven initial menu (e.g. '/admin/funnels' opens the Sales Funnels menu). */
  initialMenuId?: string;
}

export function AdminDashboardShell({ initialMenuId }: AdminDashboardShellProps = {}) {
  const router = useRouter();
  // The active menu is driven by the route (each menu has its own page passing initialMenuId),
  // so the selection survives a refresh and is shareable. Falls back to the default menu.
  const activeItem =
    menuItems.find((item) => item.id === initialMenuId && !item.maintenance) ?? defaultActiveItem;
  const activeItemId = activeItem.id;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Selecting a menu navigates to that menu's dedicated route.
  const handleSelectItem = (itemId: string) => {
    const item = menuItems.find((candidate) => candidate.id === itemId);
    if (!item || item.maintenance) return;
    router.push(item.path);
  };

  const contentPaddingLeft = sidebarCollapsed
    ? 'var(--coachio-admin-dashboard-sidebar-collapsed-width, 3.5rem)'
    : 'var(--coachio-admin-dashboard-sidebar-width)';

  return (
    <main
      className="min-h-screen text-[var(--coachio-admin-dashboard-text)]"
      style={{
        backgroundColor: adminDashboardToken.color.background,
        // Expose current sidebar width as a local CSS var so the content section can reference it.
        ['--shell-sidebar-w' as string]: contentPaddingLeft,
      }}
    >
      <AdminDashboardSidebar
        menuItems={menuItems}
        activeItemId={activeItemId}
        onSelectItem={handleSelectItem}
        onBackToHome={() => router.push('/')}
        onCollapsedChange={setSidebarCollapsed}
      />

      {/* md:pl uses the dynamic CSS var; mobile has no sidebar so no left pad needed. */}
      <section className="min-h-screen md:pl-[var(--shell-sidebar-w)]" style={{ transition: 'padding-left 0.2s ease' }}>
        <div className="border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-4 py-4 md:hidden">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Coachio</p>
              <h1 className="truncate text-xl font-semibold text-[var(--coachio-admin-dashboard-text)]">System Admin</h1>
            </div>
            <button
              type="button"
              onClick={() => router.push('/')}
              className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] text-[var(--coachio-admin-dashboard-text-muted)]"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectItem(item.id)}
                disabled={item.maintenance}
                title={item.maintenance ? 'Under maintenance' : undefined}
                className={`flex shrink-0 items-center gap-2 rounded-[var(--coachio-admin-dashboard-radius-sm)] px-3 py-2.5 text-sm font-semibold shadow-[var(--coachio-admin-dashboard-shadow-sm)] ${item.maintenance ? 'cursor-not-allowed border border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface-muted)] text-[var(--coachio-admin-dashboard-text-soft)] opacity-70' : activeItemId === item.id ? 'bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)]' : 'border border-[var(--coachio-admin-dashboard-border)] bg-white text-[var(--coachio-admin-dashboard-text-muted)]'}`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
                {item.maintenance && (
                  <span className="rounded bg-[var(--coachio-admin-dashboard-warning-bg,#fef3c7)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--coachio-admin-dashboard-warning-text,#92400e)]">
                    Maintenance
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="hidden border-b border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] px-8 py-5 shadow-[var(--coachio-admin-dashboard-shadow-sm)] md:block">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">System Admin</p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--coachio-admin-dashboard-text)]">{activeItem.label}</h1>
        </div>

        <div className="p-4 md:p-[var(--coachio-admin-dashboard-content-padding)]">
          {activeItemId === 'funnels' ? <AdminFunnelList /> : null}
          {activeItemId === 'products' ? <AdminProductManagement /> : null}
          {activeItemId === 'leads' ? <AdminLeadsManagement /> : null}
          {activeItemId === 'lucky-draw' ? <AdminLuckyDrawManagement /> : null}
          {activeItemId === 'orders' ? <AdminFunnelOrdersManagement /> : null}
          {activeItemId === 'revenue' ? <AdminRevenueTabs /> : null}
          {activeItemId === 'discounts' ? <AdminDiscountsManagement /> : null}
          {activeItemId === 'broadcasts' ? <AdminBroadcastManagement /> : null}
          {activeItemId === 'gifts' ? <AdminGiftManagement /> : null}
          {activeItemId === 'gift-automations' ? <AdminGiftAutomationManagement /> : null}
          {activeItemId === 'gift-campaigns' ? <AdminGiftCampaignManagement /> : null}
          {activeItemId === 'gift-tracking' ? <AdminGiftGrantTracking /> : null}
          {activeItemId === 'media' ? <AdminMediaManagement /> : null}
        </div>
      </section>
    </main>
  );
}
