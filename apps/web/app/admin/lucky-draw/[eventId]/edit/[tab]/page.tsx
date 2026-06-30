'use client';

import { AdminLuckyDrawEditShell, type LuckyDrawTab } from '../../../../../components/admin-lucky-draw/AdminLuckyDrawEditShell';

const VALID_TABS: LuckyDrawTab[] = ['form', 'success', 'prizes', 'participants', 'spin', 'winners'];

interface Props {
  params: { eventId: string; tab: string };
}

export default function AdminLuckyDrawEditPage({ params }: Props) {
  const activeTab = (VALID_TABS.includes(params.tab as LuckyDrawTab) ? params.tab : 'form') as LuckyDrawTab;
  return <AdminLuckyDrawEditShell eventId={params.eventId} tab={activeTab} />;
}
