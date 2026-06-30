'use client';

import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const nextLabel = theme === 'dark' ? 'Chuyển sang giao diện sáng' : 'Chuyển sang giao diện tối';
  const Icon = theme === 'dark' ? Sun : Moon;

  return (
    <button
      type="button"
      aria-label={nextLabel}
      title={nextLabel}
      onClick={toggleTheme}
      className="grid h-10 w-10 place-items-center border-2 border-black bg-white text-black shadow-pixel-sm transition hover:bg-neonOrange hover:text-white active:translate-y-0.5 active:shadow-none"
    >
      <Icon className="h-5 w-5" strokeWidth={2.5} />
    </button>
  );
}
