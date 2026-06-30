'use client';

import { LuckyDrawPresentation } from '../../../../components/admin-lucky-draw/LuckyDrawPresentation';

interface Props {
  params: { eventId: string };
}

export default function AdminLuckyDrawPresentPage({ params }: Props) {
  return <LuckyDrawPresentation eventId={params.eventId} />;
}
