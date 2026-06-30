'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Products menu pre-selected.
export default function AdminProductsPage() {
  return <AdminDashboardShell initialMenuId="products" />;
}
