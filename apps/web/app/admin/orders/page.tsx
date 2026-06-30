'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the orders menu pre-selected.
export default function AdminOrdersPage() {
  return <AdminDashboardShell initialMenuId="orders" />;
}
