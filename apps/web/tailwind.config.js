import typography from '@tailwindcss/typography';
import { coachioTailwindPreset } from '@coachio/design-system/tailwind-preset';

/** @type {import('tailwindcss').Config} */
export default {
  presets: [coachioTailwindPreset],
  darkMode: ['class'],
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/design-system/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [typography],
};
