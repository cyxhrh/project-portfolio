import type { Locale } from './types';

export type MarketCountryId =
  | 'United States'
  | 'United Kingdom'
  | 'Germany'
  | 'France'
  | 'Japan'
  | 'South Korea'
  | 'Brazil'
  | 'United Arab Emirates';

export type MarketCountry = {
  id: MarketCountryId;
  coordinates: { lat: number; lng: number };
  label: Record<Locale, string>;
};

export const marketCountries: readonly MarketCountry[] = [
  { id: 'United States', coordinates: { lat: 37.0902, lng: -95.7129 }, label: { zh: '美国', en: 'United States' } },
  { id: 'United Kingdom', coordinates: { lat: 55.3781, lng: -3.436 }, label: { zh: '英国', en: 'United Kingdom' } },
  { id: 'Germany', coordinates: { lat: 51.1657, lng: 10.4515 }, label: { zh: '德国', en: 'Germany' } },
  { id: 'France', coordinates: { lat: 46.2276, lng: 2.2137 }, label: { zh: '法国', en: 'France' } },
  { id: 'Japan', coordinates: { lat: 36.2048, lng: 138.2529 }, label: { zh: '日本', en: 'Japan' } },
  { id: 'South Korea', coordinates: { lat: 35.9078, lng: 127.7669 }, label: { zh: '韩国', en: 'South Korea' } },
  { id: 'Brazil', coordinates: { lat: -14.235, lng: -51.9253 }, label: { zh: '巴西', en: 'Brazil' } },
  { id: 'United Arab Emirates', coordinates: { lat: 23.4241, lng: 53.8478 }, label: { zh: '阿联酋', en: 'United Arab Emirates' } },
];

export function normalizeMarketCountry(value: string, locale: Locale): string | null {
  const language = locale === 'zh' ? 'zh-CN' : 'en';
  const normalized = value.trim().toLocaleLowerCase(language);

  return marketCountries.find((country) =>
    country.id.toLocaleLowerCase('en') === normalized
    || country.label[locale].toLocaleLowerCase(language) === normalized,
  )?.id ?? null;
}
