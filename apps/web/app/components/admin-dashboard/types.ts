import type { ComponentType } from 'react';

export type AdminDashboardMenuItem = {
  id: string;
  label: string;
  group: string;
  /** Dedicated route for this menu (e.g. '/admin/orders'); drives navigation + refresh persistence. */
  path: string;
  icon: ComponentType<{ className?: string }>;
  /** Course menus under maintenance: shown with a "Maintenance" badge and not clickable. */
  maintenance?: boolean;
};
