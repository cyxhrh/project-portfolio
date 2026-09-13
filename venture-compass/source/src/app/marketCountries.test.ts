import { describe, expect, test } from 'vitest';
import { marketCountries, normalizeMarketCountry } from './marketCountries';

describe('marketCountries', () => {
  test('provides the eight selectable markets in the intended order', () => {
    expect(marketCountries.map((country) => country.id)).toEqual([
      'United States',
      'United Kingdom',
      'Germany',
      'France',
      'Japan',
      'South Korea',
      'Brazil',
      'United Arab Emirates',
    ]);
  });
});

describe('normalizeMarketCountry', () => {
  test('normalizes an exact localized Chinese market name to its stable identifier', () => {
    expect(normalizeMarketCountry('美国', 'zh')).toBe('United States');
  });

  test('returns null for an unsupported market name', () => {
    expect(normalizeMarketCountry('Canada', 'en')).toBeNull();
  });
});
