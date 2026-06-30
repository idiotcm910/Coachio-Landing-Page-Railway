'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Lucky Draw menu pre-selected,
// so the lucky-draw editor's "Back to events" lands here via the route path.
export default function AdminLuckyDrawPage() {
  return <AdminDashboardShell initialMenuId="lucky-draw" />;
}
