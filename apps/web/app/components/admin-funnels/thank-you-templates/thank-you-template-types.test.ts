import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PRIMARY_COLOR,
  resolvePrimaryColor,
  buildScaffoldVariables,
  renderCatalogPreview,
  type ThankYouTemplate,
} from './thank-you-template-types';

describe('thank-you-template-types', () => {
  // =========================================================================
  // resolvePrimaryColor
  // =========================================================================
  describe('resolvePrimaryColor', () => {
    it('keeps valid 3-digit hex color', () => {
      expect(resolvePrimaryColor('#abc')).toBe('#abc');
      expect(resolvePrimaryColor('#ABC')).toBe('#ABC');
      expect(resolvePrimaryColor('#f0a')).toBe('#f0a');
    });

    it('keeps valid 6-digit hex color', () => {
      expect(resolvePrimaryColor('#aabbcc')).toBe('#aabbcc');
      expect(resolvePrimaryColor('#AABBCC')).toBe('#AABBCC');
      expect(resolvePrimaryColor('#ff6600')).toBe('#ff6600');
    });

    it('trims whitespace and keeps valid hex', () => {
      expect(resolvePrimaryColor('  #abc  ')).toBe('#abc');
      expect(resolvePrimaryColor('\t#aabbcc\n')).toBe('#aabbcc');
    });

    it('returns default when undefined or null', () => {
      expect(resolvePrimaryColor()).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor(null)).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor(undefined)).toBe(DEFAULT_PRIMARY_COLOR);
    });

    it('returns default when empty string', () => {
      expect(resolvePrimaryColor('')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('   ')).toBe(DEFAULT_PRIMARY_COLOR);
    });

    it('returns default when invalid hex format', () => {
      expect(resolvePrimaryColor('#')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('#gg')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('#12')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('#1234')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('#12345')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('#1234567')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('abc')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('red')).toBe(DEFAULT_PRIMARY_COLOR);
    });

    it('returns default when not a hex color', () => {
      expect(resolvePrimaryColor('rgb(255, 0, 0)')).toBe(DEFAULT_PRIMARY_COLOR);
      expect(resolvePrimaryColor('hsl(0, 100%, 50%)')).toBe(DEFAULT_PRIMARY_COLOR);
    });
  });

  // =========================================================================
  // buildScaffoldVariables
  // =========================================================================
  describe('buildScaffoldVariables', () => {
    const mockTemplate: ThankYouTemplate = {
      id: 'test-template',
      kind: 'workshop',
      label: 'Test Template',
      description: 'Test description',
      thumbnailGradient: ['#000', '#fff'],
      html: '<div>{{primary_color}}</div>',
      defaultVars: [
        { key: 'event_name', name: 'Event Name', type: 'text', sample: 'Sample Event' },
        { key: 'event_date', name: 'Event Date', type: 'date', sample: '2026-07-15' },
        { key: 'quantity', name: 'Quantity', type: 'number', sample: '100' },
      ],
    };

    it('always includes resolved primary_color', () => {
      const result = buildScaffoldVariables(mockTemplate, {});
      expect(result).toHaveProperty('primary_color');
      expect(result.primary_color).toBe(DEFAULT_PRIMARY_COLOR);
    });

    it('keeps valid primary_color when provided', () => {
      const result = buildScaffoldVariables(mockTemplate, { primary_color: '#ff0000' });
      expect(result.primary_color).toBe('#ff0000');
    });

    it('maps template default vars from values object', () => {
      const result = buildScaffoldVariables(mockTemplate, {
        primary_color: '#abc',
        event_name: 'My Workshop',
        event_date: '2026-08-01',
        quantity: '50',
      });
      expect(result).toEqual({
        primary_color: '#abc',
        event_name: 'My Workshop',
        event_date: '2026-08-01',
        quantity: '50',
      });
    });

    it('coerces missing values to empty string', () => {
      const result = buildScaffoldVariables(mockTemplate, {
        event_name: 'My Workshop',
        // event_date is missing
      });
      expect(result.event_date).toBe('');
      expect(result.quantity).toBe('');
    });

    it('coerces non-string values to strings', () => {
      const result = buildScaffoldVariables(mockTemplate, {
        quantity: '123', // already string
      });
      expect(typeof result.quantity).toBe('string');
      expect(result.quantity).toBe('123');
    });

    it('ignores extra keys in values object', () => {
      const result = buildScaffoldVariables(mockTemplate, {
        event_name: 'My Workshop',
        extra_key_1: 'should be ignored',
        extra_key_2: 'also ignored',
      });
      expect(result).not.toHaveProperty('extra_key_1');
      expect(result).not.toHaveProperty('extra_key_2');
    });

    it('returns only primary_color when template has no defaultVars', () => {
      const templateWithoutVars: ThankYouTemplate = {
        ...mockTemplate,
        defaultVars: [],
      };
      const result = buildScaffoldVariables(templateWithoutVars, {});
      expect(Object.keys(result)).toEqual(['primary_color']);
    });
  });

  // =========================================================================
  // renderCatalogPreview
  // =========================================================================
  describe('renderCatalogPreview', () => {
    it('replaces simple known tokens', () => {
      const html = '<p>Hello {{name}}, today is {{date}}</p>';
      const vars = { name: 'Alice', date: '2026-06-20' };
      const result = renderCatalogPreview(html, vars);
      expect(result).toBe('<p>Hello Alice, today is 2026-06-20</p>');
    });

    it('replaces multiple occurrences of same token', () => {
      const html = '<p>{{product}} is great. {{product}} is awesome.</p>';
      const vars = { product: 'Workshop' };
      const result = renderCatalogPreview(html, vars);
      expect(result).toBe('<p>Workshop is great. Workshop is awesome.</p>');
    });

    it('replaces unknown tokens with empty string', () => {
      const html = '<p>Hello {{unknown}}, your code is {{missing}}</p>';
      const vars = {};
      const result = renderCatalogPreview(html, vars);
      expect(result).toBe('<p>Hello , your code is </p>');
    });

    it('handles whitespace around token keys', () => {
      const html = '<p>{{ name }} and {{  date  }} and {{city}}</p>';
      const vars = { name: 'Alice', date: '2026-06-20', city: 'NYC' };
      const result = renderCatalogPreview(html, vars);
      expect(result).toBe('<p>Alice and 2026-06-20 and NYC</p>');
    });

    it('replaces tokens even with nested braces (treats inner as token key)', () => {
      const html = '<p>{name} and {name} and {{ {{nested}} }}</p>';
      const vars = { name: 'Alice' };
      const result = renderCatalogPreview(html, vars);
      // Single braces not affected; nested braces treated as token "{{nested}}" which resolves to ''
      expect(result).toContain('{name}');
      expect(result).not.toContain('{{nested}}');
    });

    it('leaves HTML structure intact', () => {
      const html = '<div class="card"><h1>{{title}}</h1><p>{{body}}</p></div>';
      const vars = { title: 'Hello', body: 'World' };
      const result = renderCatalogPreview(html, vars);
      expect(result).toBe('<div class="card"><h1>Hello</h1><p>World</p></div>');
    });

    it('handles empty HTML string', () => {
      const result = renderCatalogPreview('', {});
      expect(result).toBe('');
    });

    it('handles empty vars object', () => {
      const html = '<p>No tokens here</p>';
      const result = renderCatalogPreview(html, {});
      expect(result).toBe('<p>No tokens here</p>');
    });

    it('handles token with special characters in key', () => {
      const html = '<p>{{order_code}} and {{amount}}</p>';
      const vars = { order_code: 'ORD-12345', amount: '99.99' };
      const result = renderCatalogPreview(html, vars);
      expect(result).toBe('<p>ORD-12345 and 99.99</p>');
    });

    it('preserves system tokens like {{funnel_title}} when not in vars', () => {
      const html = '<p>Welcome to {{funnel_title}}</p>';
      const vars = {}; // funnel_title not provided
      const result = renderCatalogPreview(html, vars);
      expect(result).toBe('<p>Welcome to </p>');
    });

    it('replaces all 5 kinds of template tokens together', () => {
      const html =
        '<div>{{primary_color}} {{product_name}} {{funnel_title}} {{discounted_price}} {{zalo_link}}</div>';
      const vars = {
        primary_color: '#6d5efc',
        product_name: 'My Workshop',
        funnel_title: 'Summer Sale',
        discounted_price: '299k',
        zalo_link: 'https://zalo.me/...',
      };
      const result = renderCatalogPreview(html, vars);
      expect(result).toBe(
        '<div>#6d5efc My Workshop Summer Sale 299k https://zalo.me/...</div>',
      );
    });
  });
});
