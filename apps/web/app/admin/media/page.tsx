'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the media menu pre-selected.
export default function AdminMediaPage() {
  return <AdminDashboardShell initialMenuId="media" />;
}
