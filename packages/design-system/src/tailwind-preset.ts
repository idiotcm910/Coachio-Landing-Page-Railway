import type { Config } from 'tailwindcss';

export const coachioTailwindPreset = {
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-ibm-plex-sans)', 'sans-serif'],
        display: ['var(--font-ibm-plex-sans)', 'sans-serif'],
        pixel: ['var(--font-vt323)', 'monospace'],
      },
      colors: {
        deepBlack: '#F9FAFB',
        surface: '#FFFFFF',
        surfaceHover: '#F3F4F6',
        neonOrange: '#F67D1C',
        cyberPurple: '#7B61FF',
        textGray: '#4B5563',
        textDark: '#111827',
        borderGray: '#E5E7EB',
        'vibe-orange': 'var(--color-vibe-orange)',
        'vibe-black': 'var(--color-vibe-black)',
        'vibe-white': 'var(--color-vibe-white)',
        'vibe-gray': 'var(--color-vibe-gray)',
        'vibe-text': 'var(--color-vibe-text)',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
      },
      boxShadow: {
        neon: '4px 4px 0px 0px rgba(246, 125, 28, 1)',
        'neon-strong': '6px 6px 0px 0px rgba(246, 125, 28, 1)',
        card: '4px 4px 0px 0px #000000',
        'card-hover': '8px 8px 0px 0px #000000',
        pixel: '4px 4px 0px 0px #000000',
        'pixel-sm': '2px 2px 0px 0px #000000',
        'pixel-orange': '4px 4px 0px 0px #F67D1C',
      },
      backgroundImage: {
        'retro-grid': 'linear-gradient(to right, #E5E7EB 1px, transparent 1px), linear-gradient(to bottom, #E5E7EB 1px, transparent 1px)',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
} satisfies Partial<Config>;
