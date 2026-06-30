import { FunnelCheckoutClient } from '../../../components/funnels/FunnelCheckoutClient';

interface Props {
  params: { slug: string };
}

export default function FunnelCheckoutPage({ params }: Props) {
  return <FunnelCheckoutClient slug={params.slug} />;
}
