export enum UserRole {
  NORMAL_USER = 'normal_user',
  ADMIN = 'admin',
  LEARNER = 'learner',
  VIP = 'vip',
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  canSell?: boolean;
  avatar_url?: string;
  traffic_source?: string | null;
  created_at?: string;
  phone?: string;
  purchasedProductIds?: string[];
  status?: 'active' | 'banned' | boolean;
  password?: string;
  can_access_api?: boolean;
  credits?: number;
  coachio_starter_granted?: boolean;
  sellerStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  sellerPortfolio?: string;
  sellerBio?: string;
}
