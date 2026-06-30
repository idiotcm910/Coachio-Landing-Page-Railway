import { describe, expect, it } from 'vitest';
import {
  DEFAULT_EMAIL_COLOR,
  resolveEmailColor,
  buildEmail,
  type EmailKindTemplate,
} from './email-kind-types';

describe('email-kind-types', () => {
  // =========================================================================
  // resolveEmailColor
  // =========================================================================
  describe('resolveEmailColor', () => {
    it('keeps valid 3-digit hex color', () => {
      expect(resolveEmailColor('#abc')).toBe('#abc');
      expect(resolveEmailColor('#ABC')).toBe('#ABC');
      expect(resolveEmailColor('#f0a')).toBe('#f0a');
    });

    it('keeps valid 6-digit hex color', () => {
      expect(resolveEmailColor('#aabbcc')).toBe('#aabbcc');
      expect(resolveEmailColor('#AABBCC')).toBe('#AABBCC');
      expect(resolveEmailColor('#ff6600')).toBe('#ff6600');
    });

    it('trims whitespace and keeps valid hex', () => {
      expect(resolveEmailColor('  #abc  ')).toBe('#abc');
      expect(resolveEmailColor('\t#aabbcc\n')).toBe('#aabbcc');
    });

    it('returns default when undefined or null', () => {
      expect(resolveEmailColor()).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor(null)).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor(undefined)).toBe(DEFAULT_EMAIL_COLOR);
    });

    it('returns default when empty string', () => {
      expect(resolveEmailColor('')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('   ')).toBe(DEFAULT_EMAIL_COLOR);
    });

    it('returns default when invalid hex format', () => {
      expect(resolveEmailColor('#')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('#gg')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('#12')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('#1234')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('#12345')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('#1234567')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('abc')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('red')).toBe(DEFAULT_EMAIL_COLOR);
    });

    it('returns default for rgb/hsl formats', () => {
      expect(resolveEmailColor('rgb(255, 0, 0)')).toBe(DEFAULT_EMAIL_COLOR);
      expect(resolveEmailColor('hsl(0, 100%, 50%)')).toBe(DEFAULT_EMAIL_COLOR);
    });
  });

  // =========================================================================
  // buildEmail
  // =========================================================================
  describe('buildEmail', () => {
    const mockKind: EmailKindTemplate = {
      kind: 'workshop',
      label: 'Workshop',
      description: 'Workshop emails',
      thumbnail: '🎟️',
      shell: (bodyHtml, colorHex) =>
        `<html><head></head><body style="background:${colorHex}"><div>${bodyHtml}</div></body></html>`,
      emails: {
        receipt: {
          subject: 'Xác nhận đơn hàng',
          body: '<p>Cảm ơn {{buyer_name}} đã mua {{product_name}}</p><p>Mã đơn: {{order_code}}</p>',
        },
        waiting_payment: {
          subject: 'Chờ thanh toán',
          body: '<p>Đơn hàng của bạn đang chờ xác nhận thanh toán</p>',
        },
      },
    };

    it('returns object with subject and html', () => {
      const result = buildEmail(mockKind, 'receipt', '#ff0000');
      expect(result).toHaveProperty('subject');
      expect(result).toHaveProperty('html');
      expect(typeof result.subject).toBe('string');
      expect(typeof result.html).toBe('string');
    });

    it('uses correct subject from email entry', () => {
      const result = buildEmail(mockKind, 'receipt', '#ff0000');
      expect(result.subject).toBe('Xác nhận đơn hàng');
    });

    it('wraps body with shell and includes color', () => {
      const result = buildEmail(mockKind, 'receipt', '#ff0000');
      expect(result.html).toContain('#ff0000');
      expect(result.html).toContain('Cảm ơn {{buyer_name}}');
      expect(result.html).toContain('Mã đơn: {{order_code}}');
    });

    it('resolves invalid color to default before passing to shell', () => {
      const result = buildEmail(mockKind, 'receipt', 'invalid-color');
      expect(result.html).toContain(DEFAULT_EMAIL_COLOR);
    });

    it('validates color with resolveEmailColor', () => {
      const resultWithInvalid = buildEmail(mockKind, 'receipt', '#gg');
      const resultWithDefault = buildEmail(mockKind, 'receipt', DEFAULT_EMAIL_COLOR);
      expect(resultWithInvalid.html).toBe(resultWithDefault.html);
    });

    it('uses fallback entry when emailType not found', () => {
      const result = buildEmail(mockKind, 'unknown_type', '#ff0000');
      expect(result.subject).toBe('Thông báo từ {{funnel_title}}');
      expect(result.html).toContain('Cảm ơn bạn đã tin tưởng');
      expect(result.html).toContain('{{product_name}}');
    });

    it('fallback entry preserves templates tokens in body', () => {
      const result = buildEmail(mockKind, 'nonexistent_type', '#ff0000');
      expect(result.html).toContain('{{buyer_name}}');
      expect(result.html).toContain('{{product_name}}');
    });

    it('preserves email type tokens in body HTML', () => {
      const result = buildEmail(mockKind, 'receipt', '#ff0000');
      // Body should preserve tokens like {{buyer_name}}, {{product_name}}, {{order_code}}
      expect(result.html).toContain('{{buyer_name}}');
      expect(result.html).toContain('{{product_name}}');
      expect(result.html).toContain('{{order_code}}');
    });

    it('handles multiple known email types correctly', () => {
      const receipt = buildEmail(mockKind, 'receipt', '#ff0000');
      const waiting = buildEmail(mockKind, 'waiting_payment', '#ff0000');
      expect(receipt.subject).toBe('Xác nhận đơn hàng');
      expect(waiting.subject).toBe('Chờ thanh toán');
      expect(receipt.html).not.toEqual(waiting.html);
    });

    it('returns consistent html when called with same color', () => {
      const result1 = buildEmail(mockKind, 'receipt', '#ff0000');
      const result2 = buildEmail(mockKind, 'receipt', '#ff0000');
      expect(result1).toEqual(result2);
    });

    it('shell receives color and body in correct order', () => {
      const capturedArgs: Array<{ body: string; color: string }> = [];
      const testKind: EmailKindTemplate = {
        kind: 'test',
        label: 'Test',
        description: 'Test',
        thumbnail: '🧪',
        shell: (bodyHtml, colorHex) => {
          capturedArgs.push({ body: bodyHtml, color: colorHex });
          return `<html>${bodyHtml}</html>`;
        },
        emails: {
          receipt: { subject: 'Test', body: '<p>Test body</p>' },
        },
      };
      buildEmail(testKind, 'receipt', '#ff0000');
      expect(capturedArgs).toHaveLength(1);
      expect(capturedArgs[0].body).toBe('<p>Test body</p>');
      expect(capturedArgs[0].color).toBe('#ff0000');
    });
  });

  // =========================================================================
  // Integration tests
  // =========================================================================
  describe('buildEmail + resolveEmailColor integration', () => {
    const mockKind: EmailKindTemplate = {
      kind: 'course',
      label: 'Course',
      description: 'Course emails',
      thumbnail: '🎓',
      shell: (bodyHtml, colorHex) =>
        `<!DOCTYPE html><html><body style="color:${colorHex}">${bodyHtml}</body></html>`,
      emails: {
        course_credentials: {
          subject: 'Your course access',
          body: '<p>Login: {{login_url}}</p><p>Amount: {{amount}}</p>',
        },
      },
    };

    it('applies resolved color to shell output', () => {
      const result = buildEmail(mockKind, 'course_credentials', '#abc');
      expect(result.html).toContain('#abc');
    });

    it('handles all token types in body', () => {
      const result = buildEmail(mockKind, 'course_credentials', '#ff0000');
      expect(result.html).toContain('{{login_url}}');
      expect(result.html).toContain('{{amount}}');
    });

    it('null/undefined color falls back to default and applies', () => {
      const resultUndef = buildEmail(mockKind, 'course_credentials', undefined as any);
      const resultDefault = buildEmail(mockKind, 'course_credentials', DEFAULT_EMAIL_COLOR);
      expect(resultUndef.html).toContain(DEFAULT_EMAIL_COLOR);
      expect(resultUndef.html).toBe(resultDefault.html);
    });
  });
});
