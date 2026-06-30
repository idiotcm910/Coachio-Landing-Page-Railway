'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Leads menu pre-selected.
export default function AdminLeadsPage() {
  return <AdminDashboardShell initialMenuId="leads" />;
}
