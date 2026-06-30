import { type Metadata } from 'next';
import { LuckyDrawRegisterClient } from '../../components/lucky-draw/LuckyDrawRegisterClient';

interface Props {
  params: { token: string };
}

export const metadata: Metadata = {
  title: 'Đăng ký quay thưởng',
  robots: { index: false, follow: false },
};

// Trang công khai cho người tham dự workshop điền trên điện thoại. Render client-side
// và gọi luckyEventsApi.getPublic theo token (đồng nhất với api-client, không cần cache server).
export default function LuckyDrawRegisterPage({ params }: Props) {
  return <LuckyDrawRegisterClient token={params.token} />;
}
