import { describe, it, expect } from 'vitest';
import { addDiscountCode, removeDiscountCode, quoteArgs } from './discount-codes-state';

describe('discount-codes-state', () => {
  describe('addDiscountCode', () => {
    it('adds a new code (trimmed + uppercased)', () => {
      expect(addDiscountCode([], '  sale10  ')).toEqual(['SALE10']);
    });

    it('dedupes existing code (case-insensitive)', () => {
      const codes = ['SALE10'];
      expect(addDiscountCode(codes, 'sale10')).toEqual(['SALE10']);
      expect(addDiscountCode(codes, 'SALE10')).toEqual(['SALE10']);
    });

    it('appends when code is new', () => {
      expect(addDiscountCode(['SALE10'], 'VIP20')).toEqual(['SALE10', 'VIP20']);
    });

    it('ignores empty / whitespace-only input', () => {
      expect(addDiscountCode(['SALE10'], '   ')).toEqual(['SALE10']);
      expect(addDiscountCode([], '')).toEqual([]);
    });

    it('does not mutate original array', () => {
      const original = ['SALE10'];
      const result = addDiscountCode(original, 'VIP20');
      expect(original).toEqual(['SALE10']);
      expect(result).toEqual(['SALE10', 'VIP20']);
    });
  });

  describe('removeDiscountCode', () => {
    it('removes existing code', () => {
      expect(removeDiscountCode(['SALE10', 'VIP20'], 'SALE10')).toEqual(['VIP20']);
    });

    it('is a no-op when code not found', () => {
      expect(removeDiscountCode(['VIP20'], 'SALE10')).toEqual(['VIP20']);
    });

    it('returns empty array when last code removed', () => {
      expect(removeDiscountCode(['SALE10'], 'SALE10')).toEqual([]);
    });
  });

  describe('quoteArgs', () => {
    it('returns slug and codes for quote call', () => {
      const result = quoteArgs('my-funnel', ['SALE10', 'VIP20']);
      expect(result).toEqual({ slug: 'my-funnel', codes: ['SALE10', 'VIP20'] });
    });

    it('passes empty codes list through', () => {
      expect(quoteArgs('funnel-x', [])).toEqual({ slug: 'funnel-x', codes: [] });
    });
  });
});
