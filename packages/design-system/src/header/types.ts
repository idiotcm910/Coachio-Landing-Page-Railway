import type { ReactNode } from 'react';

export type HeaderUserRole = 'normal_user' | 'admin' | 'learner' | 'vip';

export interface HeaderUser {
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: HeaderUserRole;
  credits?: number;
}

export interface HeaderNavItem {
  label: string;
  onSelect: () => void;
}

export type HeaderUserMenuIcon = 'settings' | 'bookOpen' | 'dashboard';

export interface HeaderUserMenuItem {
  label: string;
  icon?: HeaderUserMenuIcon;
  tone?: 'default' | 'accent';
  onSelect: () => void;
}

export interface VibeHeaderProps {
  user?: HeaderUser | null;
  isAuthenticated: boolean;
  isLoading?: boolean;
  forceWhiteBackground?: boolean;
  themeMode?: 'light' | 'dark';
  navItems: HeaderNavItem[];
  /** Extra menu items shown in the user profile popover for all authenticated users (below admin items, above dashboard link). */
  userMenuItems?: HeaderUserMenuItem[];
  adminMenuItems?: HeaderUserMenuItem[];
  brandLabel?: string;
  onOpenAuth?: () => void;
  onGoHome?: () => void;
  onGoToUserDashboard?: () => void;
  onGoToAdminDashboard?: () => void;
  onGoToCourseManagement?: () => void;
  onLogout?: () => void | Promise<void>;
  onSearch?: (query: string) => void;
  actions?: ReactNode;
}
