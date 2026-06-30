import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { VibeHeader } from './VibeHeader';

const baseProps = {
  brandLabel: 'COACHIO',
  isAuthenticated: false,
  navItems: [
    { label: 'Khóa học', onSelect: () => undefined },
  ],
};

describe('VibeHeader', () => {
  it('keeps the default light header for existing consumers', () => {
    const html = renderToStaticMarkup(createElement(VibeHeader, baseProps));

    expect(html).toContain('bg-white');
    expect(html).toContain('text-black');
  });

  it('renders a dark themed header when requested by elearning', () => {
    const html = renderToStaticMarkup(createElement(VibeHeader, { ...baseProps, themeMode: 'dark', forceWhiteBackground: true }));

    expect(html).toContain('bg-[#080b12]');
    expect(html).toContain('text-white');
    expect(html).toContain('border-white/10');
  });
});
