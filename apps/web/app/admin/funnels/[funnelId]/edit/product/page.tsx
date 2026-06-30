import { AdminFunnelEditRoute } from '../../../../../components/admin-funnels/AdminFunnelEditRoute';

interface Props {
  params: { funnelId: string };
}

export default function FunnelProductPage({ params }: Props) {
  return <AdminFunnelEditRoute funnelId={params.funnelId} workspace="product" />;
}
