'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Sales Funnels menu pre-selected,
// so the funnel editor's "Back to funnels" lands here via the route path.
export default function AdminFunnelsPage() {
  return <AdminDashboardShell initialMenuId="funnels" />;
}
