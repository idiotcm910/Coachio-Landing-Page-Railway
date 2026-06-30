'use client';

import { FormField } from '../shared/text-field';
import type { BuyerInfo } from './FunnelCheckoutClient';

interface FunnelBuyerFormProps {
  buyer: BuyerInfo;
  errors: Record<string, string>;
  onChange: (info: BuyerInfo) => void;
}

export function FunnelBuyerForm({ buyer, errors, onChange }: FunnelBuyerFormProps) {
  const set = (field: keyof BuyerInfo) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...buyer, [field]: e.target.value });

  return (
    <div className="space-y-5">
      <h3 className="text-sm font-bold uppercase tracking-wide text-orange-600">Thông tin đăng ký</h3>

      <FormField
        id="f-name"
        label="Họ & tên"
        required
        type="text"
        value={buyer.name}
        onChange={set('name')}
        placeholder="Nhập họ và tên"
        error={errors.name}
      />

      <FormField
        id="f-email"
        label="Email"
        required
        type="email"
        value={buyer.email}
        onChange={set('email')}
        placeholder="Nhập email của bạn"
        error={errors.email}
      />

      <FormField
        id="f-phone"
        label="Số điện thoại"
        required
        type="tel"
        value={buyer.phone}
        onChange={set('phone')}
        placeholder="VD: 0912345678"
        error={errors.phone}
      />
    </div>
  );
}
