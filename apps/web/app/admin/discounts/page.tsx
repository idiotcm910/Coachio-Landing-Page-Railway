'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the discounts menu pre-selected.
export default function AdminDiscountsPage() {
  return <AdminDashboardShell initialMenuId="discounts" />;
}
