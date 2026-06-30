import { FunnelSuccessClient } from '../../../components/funnels/FunnelSuccessClient';

interface Props {
  params: { slug: string };
  searchParams: { order_id?: string };
}

export default function FunnelSuccessPage({ params, searchParams }: Props) {
  return (
    <FunnelSuccessClient
      slug={params.slug}
      orderId={searchParams.order_id ?? null}
    />
  );
}
