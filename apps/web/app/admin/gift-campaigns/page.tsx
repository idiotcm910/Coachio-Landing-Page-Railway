'use client';

import { AdminDashboardShell } from '../../components/admin-dashboard/AdminDashboardShell';

// Renders the System Admin dashboard with the Gift Campaigns menu pre-selected.
export default function AdminGiftCampaignsPage() {
  return <AdminDashboardShell initialMenuId="gift-campaigns" />;
}
