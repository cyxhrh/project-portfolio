export type Locale = 'zh' | 'en';

export type ResearchInput = {
  categoryId: string;
  budget: number;
  currency: 'USD';
  country: string;
  platform: string;
};

export type EvidenceItem = {
  type: 'trend' | 'competition' | 'price' | 'reviews' | 'collection';
  summary: string;
  metric: string;
  sourceName: string;
  sourceUrl: string;
  collectedAt: string;
  coverageNote?: string;
};

export type Opportunity = {
  id: string;
  name: string;
  score: number;
  reasons: string[];
  budgetFit: string;
  risk: string;
  visualPlaceholder: string;
  evidence: EvidenceItem[];
};

export type CategoryScene = {
  id: string;
  imageUrl: string;
  imageAlt: Record<Locale, string>;
  title: Record<Locale, string>;
  subtitle: Record<Locale, string>;
  description: Record<Locale, string>;
  selectLabel: Record<Locale, string>;
};
