'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the URL Redirects menu pre-selected.
export default function AdminUrlRedirectsPage() {
  return <AdminDashboardShell initialMenuId="url-redirects" />;
}
