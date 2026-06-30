'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  BookOpen,
  Coins,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  Search,
  Settings,
  User,
  X,
  Zap,
} from 'lucide-react';
import type { HeaderNavItem, HeaderUserMenuItem, HeaderUserRole, VibeHeaderProps } from './types';

function getRoleBadgeDisplayData(role?: HeaderUserRole) {
  if (role === 'admin') return { bg: 'bg-green-600', text: 'Admin' };
  if (role === 'vip') return { bg: 'bg-purple-600', text: 'VIP' };
  if (role === 'learner') return { bg: 'bg-blue-600', text: 'Premium' };
  return null;
}

export function VibeHeader({
  user,
  isAuthenticated,
  isLoading = false,
  forceWhiteBackground = false,
  themeMode = 'light',
  navItems,
  userMenuItems,
  adminMenuItems,
  brandLabel = 'VIBE CREATORS',
  onOpenAuth,
  onGoHome,
  onGoToUserDashboard,
  onGoToAdminDashboard,
  onGoToCourseManagement,
  onLogout,
  onSearch,
  actions,
}: VibeHeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  const roleBadgeDisplayData = useMemo(
    () => getRoleBadgeDisplayData(user?.role),
    [user?.role],
  );

  const handleNavItemClick = (item: HeaderNavItem) => {
    setIsMobileMenuOpen(false);
    item.onSelect();
  };

  const resolvedAdminMenuItems: HeaderUserMenuItem[] = useMemo(() => {
    if (user?.role !== 'admin') return [];
    if (adminMenuItems) return adminMenuItems;

    const legacyItems: HeaderUserMenuItem[] = [];
    if (onGoToAdminDashboard) {
      legacyItems.push({
        label: 'System Admin',
        icon: 'settings',
        tone: 'accent',
        onSelect: onGoToAdminDashboard,
      });
    }
    if (onGoToCourseManagement) {
      legacyItems.push({
        label: 'Course Management',
        icon: 'bookOpen',
        onSelect: onGoToCourseManagement,
      });
    }

    return legacyItems;
  }, [adminMenuItems, onGoToAdminDashboard, onGoToCourseManagement, user?.role]);

  const handleSearchSubmit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const trimmedQuery = searchQuery.trim();
    if (trimmedQuery && onSearch) {
      onSearch(trimmedQuery);
      setIsSearchOpen(false);
      setSearchQuery('');
    }
  };

  const renderMainInfoSection = () => {
    if (!user) return null;

    return (
      <div className={`grid grid-cols-2 gap-2 border-b-2 px-4 py-3 ${themeMode === 'dark' ? 'border-white/10 bg-[#111827]' : 'border-black bg-gray-50'}`}>
        <p className={`col-span-2 truncate border-b pb-1 text-base font-bold ${themeMode === 'dark' ? 'border-white/10 text-white' : 'border-gray-200 text-black'}`}>
          {user.email}
        </p>

        <div className="flex items-center gap-1.5">
          <Coins className="h-4 w-4 text-neonOrange" />
          <span className={`text-sm font-bold ${themeMode === 'dark' ? 'text-slate-200' : 'text-gray-700'}`}>
            {Math.floor(user.credits || 0)}
          </span>
          <span className={`text-xs ${themeMode === 'dark' ? 'text-slate-400' : 'text-gray-500'}`}>credits</span>
        </div>

        {roleBadgeDisplayData && (
          <div className="ml-auto flex">
            <div className={`${roleBadgeDisplayData.bg} rotate-[-2deg] border-2 border-black px-2 py-0.5 text-xs font-bold text-white shadow-pixel-sm`}>
              {roleBadgeDisplayData.text}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderUserMenuIcon = (item: HeaderUserMenuItem) => {
    const Icon = item.icon === 'bookOpen' ? BookOpen : item.icon === 'dashboard' ? LayoutDashboard : Settings;
    return <Icon className="h-4 w-4" />;
  };

  const renderAdminMenuItems = () => (
    <>
      {resolvedAdminMenuItems.map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onSelect(); setShowUserMenu(false); }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-base font-bold transition-colors ${themeMode === 'dark' ? 'hover:bg-white hover:text-black' : 'hover:bg-black hover:text-white'} ${item.tone === 'accent' ? 'text-neonOrange' : themeMode === 'dark' ? 'text-white' : 'text-black'}`}
          type="button"
        >
          {renderUserMenuIcon(item)} {item.label}
        </button>
      ))}
    </>
  );

  const renderUserMenuItems = () => (
    <>
      {(userMenuItems ?? []).map((item) => (
        <button
          key={item.label}
          onClick={() => { item.onSelect(); setShowUserMenu(false); }}
          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-base font-bold transition-colors ${themeMode === 'dark' ? 'text-white hover:bg-white hover:text-black' : 'text-black hover:bg-black hover:text-white'}`}
          type="button"
        >
          {renderUserMenuIcon(item)} {item.label}
        </button>
      ))}
    </>
  );

  const isDark = themeMode === 'dark';
  const headerSurfaceClass = scrolled
    ? `border-b-2 py-2 shadow-pixel-sm ${isDark ? 'border-white/10 bg-[#080b12]' : 'border-black bg-white'}`
    : `border-b-2 ${forceWhiteBackground ? 'py-2' : 'py-4'} ${isDark ? 'border-white/10 bg-[#080b12]' : forceWhiteBackground ? 'border-transparent bg-white' : 'border-transparent bg-transparent'}`;
  const textClass = isDark ? 'text-white' : 'text-black';
  const mutedSurfaceClass = isDark ? 'border-white/10 bg-[#111827]' : 'border-black bg-white';
  const subtleHoverClass = isDark ? 'hover:bg-white/10' : 'hover:bg-gray-100';
  const interactiveBorderClass = isDark ? 'border-white/10 hover:border-white/30' : 'border-transparent hover:border-black';

  return (
    <nav className={`sticky left-0 right-0 top-0 z-50 transition-all duration-0 ${headerSurfaceClass}`}>
      <div className="relative mx-auto flex max-w-7xl items-center justify-between px-4 md:px-6">
        <button className="group z-20 flex items-center gap-2" onClick={onGoHome} type="button">
          <span className="relative border-2 border-black bg-neonOrange p-1.5 shadow-pixel-sm transition-all active:translate-y-0.5 active:shadow-none">
            <Zap className="h-6 w-6 fill-white text-white" strokeWidth={3} />
          </span>
          <span className="flex flex-col">
            <span className={`font-pixel text-2xl font-bold leading-none tracking-wider ${textClass}`}>
              {brandLabel}
            </span>
          </span>
        </button>

        <div className="hidden items-center gap-12 lg:flex">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavItemClick(item)}
              className={`text-base font-bold transition-colors hover:text-neonOrange hover:underline hover:decoration-2 hover:underline-offset-4 ${textClass}`}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="z-20 flex items-center gap-4">
          {actions ? <div className="flex items-center">{actions}</div> : null}

          <div className={`hidden items-center transition-all duration-300 md:flex ${isSearchOpen ? `w-64 border-2 px-2 ${mutedSurfaceClass}` : 'w-10 border-2 border-transparent'}`}>
            {isSearchOpen && (
              <form onSubmit={handleSearchSubmit} className="flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Tìm kiếm..."
                  onBlur={() => !searchQuery && setIsSearchOpen(false)}
                  className={`h-full w-full border-none bg-transparent py-2 text-sm outline-none focus:ring-0 ${textClass}`}
                />
              </form>
            )}
            <button
              onClick={() => (isSearchOpen ? handleSearchSubmit() : setIsSearchOpen(true))}
              className={`p-2 transition-all ${textClass} ${subtleHoverClass} ${!isSearchOpen ? `border-2 ${interactiveBorderClass}` : ''}`}
              type="button"
            >
              <Search className="h-6 w-6" strokeWidth={2.5} />
            </button>
          </div>

          {isLoading ? (
            <div className={`hidden h-[44px] w-[120px] items-center justify-center border-2 shadow-pixel-sm sm:flex ${isDark ? 'border-white/10 bg-[#111827]' : 'border-black bg-gray-100'}`}>
              <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
            </div>
          ) : isAuthenticated && user ? (
            <div className="relative hidden sm:block">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className={`flex items-center gap-2 border-2 px-2 py-1 shadow-pixel-sm transition-all active:translate-y-0.5 active:shadow-none ${isDark ? 'border-white/20 bg-[#111827] hover:bg-white/10' : 'border-black bg-white hover:bg-gray-50'}`}
                type="button"
              >
                <img src={user.avatarUrl || 'https://i.pravatar.cc/150'} alt={user.fullName} className="h-8 w-8 border border-black object-cover" />
                <span className={`max-w-[120px] truncate text-base font-bold ${textClass}`}>{user.fullName}</span>
                <ChevronDown className={`h-4 w-4 ${textClass}`} />
              </button>

              {showUserMenu && (
                <div className={`absolute right-0 top-full z-50 mt-2 w-64 animate-fade-in border-2 shadow-pixel ${isDark ? 'border-white/10 bg-[#080b12]' : 'border-black bg-white'}`}>
                  {renderMainInfoSection()}
                  <div className="p-1">
                    {renderAdminMenuItems()}
                    {renderUserMenuItems()}
                    <button
                      onClick={() => { onGoToUserDashboard?.(); setShowUserMenu(false); }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-base font-bold transition-colors ${isDark ? 'text-white hover:bg-white hover:text-black' : 'text-black hover:bg-black hover:text-white'}`}
                      type="button"
                    >
                      <LayoutDashboard className="h-4 w-4" /> My Dashboard
                    </button>
                    <button
                      onClick={() => { void onLogout?.(); setShowUserMenu(false); }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-base font-bold text-red-600 transition-colors hover:bg-red-600 hover:text-white"
                      type="button"
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="hidden items-center gap-2 border-2 border-black bg-neonOrange px-6 py-2 text-lg font-bold text-white shadow-pixel transition-all hover:translate-y-1 hover:shadow-none sm:flex"
              type="button"
            >
              <User className="h-5 w-5" />
              <span>Login</span>
            </button>
          )}

          <button
            className={`border-2 p-2 shadow-pixel-sm active:shadow-none lg:hidden ${isDark ? 'border-white/20 text-white' : 'border-black text-black'}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            type="button"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        <div className={`fixed inset-0 z-10 m-4 flex flex-col items-center justify-center gap-8 border-2 shadow-pixel transition-all duration-0 lg:hidden ${isDark ? 'border-white/10 bg-[#080b12]' : 'border-black bg-white'} ${isMobileMenuOpen ? 'visible opacity-100' : 'invisible opacity-0 pointer-events-none'}`}>
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavItemClick(item)}
              className={`text-center text-4xl font-bold uppercase tracking-wider transition-colors hover:text-neonOrange ${textClass}`}
              type="button"
            >
              {item.label}
            </button>
          ))}

          <div className={`my-4 h-1 w-20 ${isDark ? 'bg-white' : 'bg-black'}`} />

          {isAuthenticated ? (
            <button
              onClick={() => { onGoToUserDashboard?.(); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-2 text-xl font-bold uppercase hover:text-neonOrange ${textClass}`}
              type="button"
            >
              <LayoutDashboard className="h-6 w-6" /> Dashboard
            </button>
          ) : (
            <button
              onClick={() => { onOpenAuth?.(); setIsMobileMenuOpen(false); }}
              className="border-2 border-black bg-neonOrange px-8 py-3 text-xl font-bold uppercase text-white shadow-pixel"
              type="button"
            >
              Đăng nhập ngay
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
