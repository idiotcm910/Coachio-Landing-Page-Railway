'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Gift Automations menu pre-selected.
export default function AdminGiftAutomationsPage() {
  return <AdminDashboardShell initialMenuId="gift-automations" />;
}
