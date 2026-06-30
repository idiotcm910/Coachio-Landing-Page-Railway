'use client';

import { useState } from 'react';
import { ArrowLeft, ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { AdminDashboardMenuItem } from './types';

interface AdminDashboardSidebarProps {
  menuItems: AdminDashboardMenuItem[];
  activeItemId: string;
  onSelectItem: (itemId: string) => void;
  onBackToHome: () => void;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AdminDashboardSidebar({
  menuItems,
  activeItemId,
  onSelectItem,
  onBackToHome,
  onCollapsedChange,
}: AdminDashboardSidebarProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // Track which groups are collapsed; default all expanded.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const groups = menuItems.reduce<Array<{ label: string; items: AdminDashboardMenuItem[] }>>(
    (currentGroups, item) => {
      const group = currentGroups.find((candidate) => candidate.label === item.group);
      if (group) {
        group.items.push(item);
        return currentGroups;
      }
      return [...currentGroups, { label: item.group, items: [item] }];
    },
    [],
  );

  const toggleGroup = (label: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const toggleSidebar = () => {
    setSidebarCollapsed((c) => {
      const next = !c;
      onCollapsedChange?.(next);
      return next;
    });
  };

  // Collapsed sidebar is a narrow icon rail (3.5rem wide).
  const sidebarWidth = sidebarCollapsed
    ? 'var(--coachio-admin-dashboard-sidebar-collapsed-width, 3.5rem)'
    : 'var(--coachio-admin-dashboard-sidebar-width)';

  return (
    <aside
      style={{ width: sidebarWidth, minWidth: sidebarWidth, transition: 'width 0.2s ease, min-width 0.2s ease' }}
      className="fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-[var(--coachio-admin-dashboard-border)] bg-[var(--coachio-admin-dashboard-surface)] md:flex overflow-hidden"
      aria-label="Admin navigation"
    >
      {/* Header */}
      <div className="border-b border-[var(--coachio-admin-dashboard-border-subtle)] px-3 py-4 flex items-center justify-between gap-2 min-h-[4rem]">
        {!sidebarCollapsed && (
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)]">Coachio</p>
            <h1 className="mt-0.5 text-xl font-bold text-[var(--coachio-admin-dashboard-text)] truncate">System Admin</h1>
          </div>
        )}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!sidebarCollapsed}
          className="shrink-0 grid h-8 w-8 place-items-center rounded-[var(--coachio-admin-dashboard-radius-sm)] text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--coachio-admin-dashboard-accent)]"
        >
          {sidebarCollapsed
            ? <PanelLeftOpen className="h-4 w-4" />
            : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2">
        <div className="space-y-3">
          {groups.map((group) => {
            const isGroupCollapsed = !!collapsedGroups[group.label];
            return (
              <div key={group.label} className="border-b border-[var(--coachio-admin-dashboard-border-subtle)] pb-2">
                {/* Group header — hidden in icon rail */}
                {!sidebarCollapsed && (
                  <button
                    type="button"
                    aria-expanded={!isGroupCollapsed}
                    aria-label={`${isGroupCollapsed ? 'Expand' : 'Collapse'} ${group.label} section`}
                    onClick={() => toggleGroup(group.label)}
                    className="mb-1 flex w-full items-center justify-between rounded-[var(--coachio-admin-dashboard-radius-sm)] px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-[var(--coachio-admin-dashboard-text-soft)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--coachio-admin-dashboard-accent)]"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className="h-3.5 w-3.5 transition-transform duration-200"
                      style={{ transform: isGroupCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}
                    />
                  </button>
                )}

                {/* Items — always shown in icon rail; hidden when group collapsed */}
                {(!isGroupCollapsed || sidebarCollapsed) && (
                  <div className={sidebarCollapsed ? 'space-y-0.5' : 'space-y-0.5 pl-1'}>
                    {group.items.map((item) => {
                      const isActive = activeItemId === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => { if (!item.maintenance) onSelectItem(item.id); }}
                          disabled={item.maintenance}
                          title={item.maintenance ? `${item.label} — Under maintenance` : item.label}
                          aria-label={item.label}
                          className={`flex w-full items-center gap-2.5 rounded-[var(--coachio-admin-dashboard-radius-sm)] px-2 py-2 text-sm font-semibold transition ${
                            sidebarCollapsed ? 'justify-center' : ''
                          } ${
                            item.maintenance
                              ? 'cursor-not-allowed text-[var(--coachio-admin-dashboard-text-soft)] opacity-60'
                              : isActive
                              ? 'bg-[var(--coachio-admin-dashboard-accent)] text-[var(--coachio-admin-dashboard-text-inverse)] shadow-[var(--coachio-admin-dashboard-shadow-sm)]'
                              : 'text-[var(--coachio-admin-dashboard-text-muted)] hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)]'
                          }`}
                        >
                          <item.icon className="h-4 w-4 shrink-0" />
                          {!sidebarCollapsed && (
                            <>
                              <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                              {item.maintenance && (
                                <span className="shrink-0 rounded bg-[var(--coachio-admin-dashboard-warning-bg,#fef3c7)] px-1.5 py-0.5 text-[10px] font-bold uppercase text-[var(--coachio-admin-dashboard-warning-text,#92400e)]">
                                  Maintenance
                                </span>
                              )}
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="border-t border-[var(--coachio-admin-dashboard-border-subtle)] p-2">
        <button
          type="button"
          onClick={onBackToHome}
          title="Back to home"
          aria-label="Back to home"
          className={`flex w-full items-center gap-2.5 rounded-[var(--coachio-admin-dashboard-radius-md)] px-2 py-2.5 text-sm font-semibold text-[var(--coachio-admin-dashboard-text-muted)] transition hover:bg-[var(--coachio-admin-dashboard-surface-hover)] hover:text-[var(--coachio-admin-dashboard-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--coachio-admin-dashboard-accent)] ${sidebarCollapsed ? 'justify-center' : ''}`}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!sidebarCollapsed && <span>Back to home</span>}
        </button>
      </div>
    </aside>
  );
}
