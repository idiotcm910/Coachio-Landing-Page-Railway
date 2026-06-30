import { AdminFunnelEditRoute } from '../../../../../components/admin-funnels/AdminFunnelEditRoute';

interface Props {
  params: { funnelId: string };
}

export default function FunnelLandingPage({ params }: Props) {
  return <AdminFunnelEditRoute funnelId={params.funnelId} workspace="landing" />;
}
