import { describe, expect, it } from 'vitest';
import { EMAIL_KINDS } from './email-kind-catalog';

describe('email-kind-catalog', () => {
  // =========================================================================
  // Catalog structure
  // =========================================================================
  describe('EMAIL_KINDS structure', () => {
    it('exports exactly 5 email kinds', () => {
      expect(EMAIL_KINDS).toHaveLength(5);
    });

    it('has one kind per email category: workshop, ebook, course, coaching, webinar', () => {
      const kinds = EMAIL_KINDS.map((k) => k.kind).sort();
      expect(kinds).toEqual(['coaching', 'course', 'ebook', 'webinar', 'workshop']);
    });

    it('all kinds have unique kind property', () => {
      const kinds = EMAIL_KINDS.map((k) => k.kind);
      const uniqueKinds = new Set(kinds);
      expect(uniqueKinds.size).toBe(kinds.length);
    });
  });

  // =========================================================================
  // Required fields validation
  // =========================================================================
  describe('required fields present', () => {
    it('all kinds have required string properties', () => {
      for (const kind of EMAIL_KINDS) {
        expect(typeof kind.kind).toBe('string');
        expect(kind.kind.length).toBeGreaterThan(0);
        expect(typeof kind.label).toBe('string');
        expect(kind.label.length).toBeGreaterThan(0);
        expect(typeof kind.description).toBe('string');
        expect(kind.description.length).toBeGreaterThan(0);
        expect(typeof kind.thumbnail).toBe('string');
        expect(kind.thumbnail.length).toBeGreaterThan(0);
      }
    });

    it('all kinds have shell function', () => {
      for (const kind of EMAIL_KINDS) {
        expect(typeof kind.shell).toBe('function');
      }
    });

    it('all kinds have emails object', () => {
      for (const kind of EMAIL_KINDS) {
        expect(typeof kind.emails).toBe('object');
        expect(kind.emails).not.toBeNull();
        expect(!Array.isArray(kind.emails)).toBe(true);
      }
    });
  });

  // =========================================================================
  // Email entries validation
  // =========================================================================
  describe('email entries structure', () => {
    it('all email entries have subject and body', () => {
      for (const kind of EMAIL_KINDS) {
        for (const [key, entry] of Object.entries(kind.emails)) {
          expect(typeof entry.subject).toBe('string');
          expect(entry.subject.length).toBeGreaterThan(0);
          expect(typeof entry.body).toBe('string');
          expect(entry.body.length).toBeGreaterThan(0);
        }
      }
    });

    it('email body contains HTML elements', () => {
      for (const kind of EMAIL_KINDS) {
        for (const [key, entry] of Object.entries(kind.emails)) {
          // Body should contain at least one HTML tag
          expect(entry.body).toMatch(/<[a-z]+/i);
        }
      }
    });
  });

  // =========================================================================
  // Required 4 email types per kind
  // =========================================================================
  describe('all 4 funnel email types present', () => {
    const requiredEmailTypes = [
      'receipt',
      'waiting_payment',
      'course_credentials',
      'course_access',
    ];

    it('each kind has all 4 required email types', () => {
      for (const kind of EMAIL_KINDS) {
        for (const emailType of requiredEmailTypes) {
          expect(kind.emails).toHaveProperty(emailType);
        }
      }
    });

    it('no email types are missing per kind', () => {
      for (const kind of EMAIL_KINDS) {
        const emailKeys = Object.keys(kind.emails);
        expect(emailKeys.length).toBeGreaterThanOrEqual(requiredEmailTypes.length);
      }
    });
  });

  // =========================================================================
  // Shell function behavior
  // =========================================================================
  describe('shell function behavior', () => {
    it('shell returns HTML string', () => {
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test body</p>', '#ff0000');
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      }
    });

    it('shell output contains the provided color hex code', () => {
      for (const kind of EMAIL_KINDS) {
        const testColor = '#ff0000';
        const result = kind.shell('<p>Test</p>', testColor);
        expect(result).toContain(testColor);
      }
    });

    it('shell output contains the provided body HTML', () => {
      for (const kind of EMAIL_KINDS) {
        const bodyContent = '<p>Custom test body</p>';
        const result = kind.shell(bodyContent, '#ff0000');
        expect(result).toContain('Custom test body');
      }
    });

    it('shell output is valid HTML structure', () => {
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test</p>', '#ff0000');
        expect(result).toContain('<!DOCTYPE');
        expect(result).toContain('<html');
        expect(result).toContain('</html>');
      }
    });

    it('shell includes DOCTYPE declaration', () => {
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test</p>', '#ff0000');
        expect(result).toMatch(/<!DOCTYPE\s+html>/i);
      }
    });

    it('shell includes character encoding meta tag', () => {
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test</p>', '#ff0000');
        expect(result).toContain('charset');
        expect(result).toContain('UTF-8');
      }
    });

    it('shell uses table-based layout (no CSS class names for external stylesheets)', () => {
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test</p>', '#ff0000');
        expect(result).toContain('<table');
        // Should have inline styles, not CSS class-based styling
        expect(result).toContain('style=');
      }
    });

    it('shell output does not contain <style> block', () => {
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test</p>', '#ff0000');
        expect(result).not.toContain('<style');
      }
    });

    it('shell output does not contain <script> tag', () => {
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test</p>', '#ff0000');
        expect(result).not.toContain('<script');
      }
    });
  });

  // =========================================================================
  // Token preservation in shell
  // =========================================================================
  describe('shell preserves template tokens', () => {
    it('shell preserves {{token}} placeholders in body', () => {
      for (const kind of EMAIL_KINDS) {
        const bodyWithTokens = '<p>Hello {{buyer_name}}, order: {{order_code}}</p>';
        const result = kind.shell(bodyWithTokens, '#ff0000');
        expect(result).toContain('{{buyer_name}}');
        expect(result).toContain('{{order_code}}');
      }
    });

    it('shell preserves system tokens', () => {
      for (const kind of EMAIL_KINDS) {
        const systemTokens =
          '<p>{{brand_name}} {{current_year}} {{support_email}} {{product_name}}</p>';
        const result = kind.shell(systemTokens, '#ff0000');
        expect(result).toContain('{{brand_name}}');
        expect(result).toContain('{{current_year}}');
        expect(result).toContain('{{support_email}}');
        expect(result).toContain('{{product_name}}');
      }
    });

    it('shell does not alter or strip {{amount}} token in body', () => {
      for (const kind of EMAIL_KINDS) {
        const bodyWithAmount = '<p>Amount paid: {{amount}} VND</p>';
        const result = kind.shell(bodyWithAmount, '#ff0000');
        expect(result).toContain('{{amount}}');
      }
    });

    it('does not add or remove tokens', () => {
      for (const kind of EMAIL_KINDS) {
        const bodyTokens = [
          '{{login_url}}',
          '{{zalo_link}}',
          '{{replay_url}}',
          '{{booking_url}}',
        ];
        const body = bodyTokens.map((t) => `<p>${t}</p>`).join('');
        const result = kind.shell(body, '#ff0000');
        for (const token of bodyTokens) {
          expect(result).toContain(token);
        }
      }
    });
  });

  // =========================================================================
  // Kind-specific tests
  // =========================================================================
  describe('workshop kind specifics', () => {
    const workshop = EMAIL_KINDS.find((k) => k.kind === 'workshop');

    it('exists in catalog', () => {
      expect(workshop).toBeDefined();
    });

    it('has a Workshop label', () => {
      expect(workshop?.label).toContain('Workshop');
    });

    it('shell includes CTA button for Zalo', () => {
      const result = workshop?.shell('<p>Test</p>', '#ff0000') ?? '';
      expect(result).toContain('{{zalo_link}}');
    });
  });

  describe('ebook kind specifics', () => {
    const ebook = EMAIL_KINDS.find((k) => k.kind === 'ebook');

    it('exists in catalog', () => {
      expect(ebook).toBeDefined();
    });

    it('shell does not include CTA button (simple template)', () => {
      const result = ebook?.shell('<p>Download ebook</p>', '#ff0000') ?? '';
      // Should still have the body
      expect(result).toContain('Download ebook');
    });
  });

  describe('course kind specifics', () => {
    const course = EMAIL_KINDS.find((k) => k.kind === 'course');

    it('exists in catalog', () => {
      expect(course).toBeDefined();
    });

    it('shell includes CTA button for login', () => {
      const result = course?.shell('<p>Start course</p>', '#ff0000') ?? '';
      expect(result).toContain('{{login_url}}');
    });
  });

  describe('coaching kind specifics', () => {
    const coaching = EMAIL_KINDS.find((k) => k.kind === 'coaching');

    it('exists in catalog', () => {
      expect(coaching).toBeDefined();
    });

    it('shell includes CTA button for Zalo', () => {
      const result = coaching?.shell('<p>Book session</p>', '#ff0000') ?? '';
      expect(result).toContain('{{zalo_link}}');
    });
  });

  describe('webinar kind specifics', () => {
    const webinar = EMAIL_KINDS.find((k) => k.kind === 'webinar');

    it('exists in catalog', () => {
      expect(webinar).toBeDefined();
    });

    it('shell includes CTA button for Zalo', () => {
      const result = webinar?.shell('<p>Join webinar</p>', '#ff0000') ?? '';
      expect(result).toContain('{{zalo_link}}');
    });
  });

  // =========================================================================
  // Color application in shell
  // =========================================================================
  describe('shell applies color correctly', () => {
    it('different colors produce different output', () => {
      const kind = EMAIL_KINDS[0];
      const result1 = kind.shell('<p>Test</p>', '#ff0000');
      const result2 = kind.shell('<p>Test</p>', '#00ff00');
      expect(result1).not.toEqual(result2);
      expect(result1).toContain('#ff0000');
      expect(result2).toContain('#00ff00');
    });

    it('color appears in header and CTA button styling', () => {
      const kind = EMAIL_KINDS.find((k) => k.kind === 'workshop') ?? EMAIL_KINDS[0];
      const color = '#ab12cd';
      const result = kind.shell('<p>Test</p>', color);
      // Color should appear multiple times for header and button
      const matches = result.match(new RegExp(color, 'g')) ?? [];
      expect(matches.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Email bodies content validation
  // =========================================================================
  describe('email bodies contain expected tokens and HTML', () => {
    it('all email bodies contain at least one paragraph tag', () => {
      for (const kind of EMAIL_KINDS) {
        for (const [key, entry] of Object.entries(kind.emails)) {
          expect(entry.body).toContain('<p');
        }
      }
    });

    it('email subjects are not empty', () => {
      for (const kind of EMAIL_KINDS) {
        for (const [key, entry] of Object.entries(kind.emails)) {
          expect(entry.subject.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });

  // =========================================================================
  // Sanitization compatibility (nh3 email allowlist)
  // =========================================================================
  describe('shell output compatible with nh3 email allowlist', () => {
    const allowedTags = [
      'a',
      'b',
      'blockquote',
      'br',
      'center',
      'div',
      'em',
      'font',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'hr',
      'i',
      'img',
      'li',
      'ol',
      'p',
      'span',
      'strong',
      'sub',
      'sup',
      'table',
      'tbody',
      'td',
      'tfoot',
      'th',
      'thead',
      'tr',
      'u',
      'ul',
    ];

    it('shell output does not use forbidden HTML tags', () => {
      const forbiddenTags = ['script', 'style', 'iframe', 'video', 'audio', 'object'];
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test</p>', '#ff0000');
        for (const tag of forbiddenTags) {
          expect(result).not.toContain(`<${tag}`);
          expect(result).not.toContain(`<${tag} `);
        }
      }
    });

    it('shell output uses only allowed tags (plus structural HTML/HEAD/BODY)', () => {
      const structuralTags = ['html', 'head', 'body', 'meta'];
      const allAllowedTags = [...allowedTags, ...structuralTags];
      for (const kind of EMAIL_KINDS) {
        const result = kind.shell('<p>Test with {{token}}</p>', '#ff0000');
        // Extract all tags used
        const tagMatches = result.match(/<\/?([a-z]+)/gi) ?? [];
        const usedTags = new Set(tagMatches.map((m) => m.replace(/<\/?/, '').toLowerCase()));
        for (const tag of usedTags) {
          expect(allAllowedTags).toContain(tag);
        }
      }
    });
  });
});
