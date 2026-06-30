'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Gift Packages menu pre-selected.
export default function AdminGiftsPage() {
  return <AdminDashboardShell initialMenuId="gifts" />;
}
