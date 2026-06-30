'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Grant Tracking menu pre-selected.
export default function AdminGiftTrackingPage() {
  return <AdminDashboardShell initialMenuId="gift-tracking" />;
}
