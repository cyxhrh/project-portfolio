import type { CategoryScene, EvidenceItem, Locale, Opportunity, ResearchInput } from './types';
import apparelShoesBagsScene from '../assets/category-scenes/apparel-shoes-bags.png';
import beautyPersonalCareScene from '../assets/category-scenes/beauty-personal-care.png';
import consumerElectronicsScene from '../assets/category-scenes/consumer-electronics.png';
import homeLivingScene from '../assets/category-scenes/home-living.png';
import foodBeverageScene from '../assets/category-scenes/food-beverage.png';
import motherBabyToysScene from '../assets/category-scenes/mother-baby-toys.png';
import sportsOutdoorsScene from '../assets/category-scenes/sports-outdoors.png';
import booksEntertainmentScene from '../assets/category-scenes/books-entertainment.png';
import petSuppliesScene from '../assets/category-scenes/pet-supplies.png';

export const categoryScenes: CategoryScene[] = [
  {
    id: 'apparel-shoes-bags',
    imageUrl: apparelShoesBagsScene,
    imageAlt: { zh: '服装鞋包品类场景', en: 'Apparel, shoes, and bags category scene' },
    title: { zh: '服装鞋包', en: 'Apparel, shoes, and bags' },
    subtitle: { zh: '穿着与日常表达', en: 'Wear and everyday expression' },
    description: { zh: '男装、女装、童装、鞋靴、箱包、配饰', en: 'Menswear, womenswear, childrenswear, footwear, bags, and accessories' },
    selectLabel: { zh: '选择服装鞋包', en: 'Choose apparel, shoes, and bags' },
  },
  {
    id: 'beauty-personal-care',
    imageUrl: beautyPersonalCareScene,
    imageAlt: { zh: '美妆个护品类场景', en: 'Beauty and personal care category scene' },
    title: { zh: '美妆个护', en: 'Beauty and personal care' },
    subtitle: { zh: '护理、妆容与感官体验', en: 'Care, makeup, and sensory rituals' },
    description: { zh: '护肤、彩妆、香水、洗护、个人护理', en: 'Skincare, makeup, fragrance, hair and body care, and personal care' },
    selectLabel: { zh: '选择美妆个护', en: 'Choose beauty and personal care' },
  },
  {
    id: 'consumer-electronics',
    imageUrl: consumerElectronicsScene,
    imageAlt: { zh: '数码电子品类场景', en: 'Consumer electronics category scene' },
    title: { zh: '数码电子', en: 'Consumer electronics' },
    subtitle: { zh: '连接、创作与智能体验', en: 'Connection, creation, and smart experiences' },
    description: { zh: '手机、电脑、平板、耳机、相机、智能穿戴、家电', en: 'Phones, computers, tablets, headphones, cameras, wearables, and appliances' },
    selectLabel: { zh: '选择数码电子', en: 'Choose consumer electronics' },
  },
  {
    id: 'home-living',
    imageUrl: homeLivingScene,
    imageAlt: { zh: '家居生活品类场景', en: 'Home and living category scene' },
    title: { zh: '家居生活', en: 'Home and living' },
    subtitle: { zh: '空间、秩序与日常效率', en: 'Space, order, and daily ease' },
    description: { zh: '家具、家纺、厨具、收纳、清洁用品、灯具', en: 'Furniture, home textiles, kitchenware, storage, cleaning supplies, and lighting' },
    selectLabel: { zh: '选择家居生活', en: 'Choose home and living' },
  },
  {
    id: 'food-beverage',
    imageUrl: foodBeverageScene,
    imageAlt: { zh: '食品饮料品类场景', en: 'Food and beverage category scene' },
    title: { zh: '食品饮料', en: 'Food and beverage' },
    subtitle: { zh: '风味、补给与日常选择', en: 'Flavor, nourishment, and daily choices' },
    description: { zh: '零食、粮油、生鲜、水果、酒水、茶饮、保健食品', en: 'Snacks, pantry staples, fresh food, fruit, alcohol, tea drinks, and health foods' },
    selectLabel: { zh: '选择食品饮料', en: 'Choose food and beverage' },
  },
  {
    id: 'mother-baby-toys',
    imageUrl: motherBabyToysScene,
    imageAlt: { zh: '母婴玩具品类场景', en: 'Mother, baby, and toys category scene' },
    title: { zh: '母婴玩具', en: 'Mother, baby, and toys' },
    subtitle: { zh: '成长、照护与启发', en: 'Growth, care, and discovery' },
    description: { zh: '奶粉、纸尿裤、童装、婴儿用品、玩具、文具', en: 'Formula, diapers, childrenswear, baby products, toys, and stationery' },
    selectLabel: { zh: '选择母婴玩具', en: 'Choose mother, baby, and toys' },
  },
  {
    id: 'sports-outdoors',
    imageUrl: sportsOutdoorsScene,
    imageAlt: { zh: '运动户外品类场景', en: 'Sports and outdoors category scene' },
    title: { zh: '运动户外', en: 'Sports and outdoors' },
    subtitle: { zh: '行动、训练与户外探索', en: 'Movement, training, and outdoor discovery' },
    description: { zh: '运动服饰、健身器械、露营、骑行、球类用品', en: 'Sportswear, fitness equipment, camping, cycling, and ball-sport gear' },
    selectLabel: { zh: '选择运动户外', en: 'Choose sports and outdoors' },
  },
  {
    id: 'books-entertainment',
    imageUrl: booksEntertainmentScene,
    imageAlt: { zh: '图书文娱品类场景', en: 'Books and entertainment category scene' },
    title: { zh: '图书文娱', en: 'Books and entertainment' },
    subtitle: { zh: '阅读、创作与文化兴趣', en: 'Reading, creation, and cultural interests' },
    description: { zh: '图书、音像、乐器、游戏、动漫周边', en: 'Books, audio and video, musical instruments, games, and anime merchandise' },
    selectLabel: { zh: '选择图书文娱', en: 'Choose books and entertainment' },
  },
  {
    id: 'pet-supplies',
    imageUrl: petSuppliesScene,
    imageAlt: { zh: '宠物用品品类场景', en: 'Pet supplies category scene' },
    title: { zh: '宠物用品', en: 'Pet supplies' },
    subtitle: { zh: '喂养、互动与日常照护', en: 'Feeding, play, and everyday care' },
    description: { zh: '宠物食品、猫砂、玩具、护理用品', en: 'Pet food, cat litter, toys, and care products' },
    selectLabel: { zh: '选择宠物用品', en: 'Choose pet supplies' },
  },
];

export const demoResearchInput: ResearchInput = {
  categoryId: 'apparel-shoes-bags',
  budget: 5000,
  currency: 'USD',
  country: 'United States',
  platform: 'TikTok Shop',
};

const illustrativeEvidence = (topic: string, locale: Locale): EvidenceItem[] => {
  if (locale === 'en') {
    return [
      {
        type: 'trend',
        summary: `Illustrative trend signal: ${topic} is worth validating further.`,
        metric: 'Illustrative metric, not live data',
        sourceName: 'Illustrative source',
        sourceUrl: 'https://example.com',
        collectedAt: 'Illustrative collection record, not a live timestamp',
      },
      {
        type: 'competition',
        summary: `Illustrative competition observation: ${topic} needs further differentiation validation.`,
        metric: 'Illustrative observation, not a market conclusion',
        sourceName: 'Illustrative source',
        sourceUrl: 'https://example.com',
        collectedAt: 'Illustrative collection record, not a live timestamp',
      },
      {
        type: 'price',
        summary: `Illustrative budget prompt: evaluate ${topic} after a small-batch validation.`,
        metric: 'Illustrative price range, not live data',
        sourceName: 'Illustrative source',
        sourceUrl: 'https://example.com',
        collectedAt: 'Illustrative collection record, not a live timestamp',
      },
      {
        type: 'reviews',
        summary: `Illustrative review theme: buyers may need clearer guidance for choosing ${topic}.`,
        metric: 'Illustrative review theme, not real customer feedback',
        sourceName: 'Illustrative source',
        sourceUrl: 'https://example.com',
        collectedAt: 'Illustrative collection record, not a live timestamp',
      },
      {
        type: 'collection',
        summary: `Illustrative collection note for ${topic}; no live marketplace collection was performed.`,
        metric: 'Illustrative collection record, not live data',
        sourceName: 'Illustrative source',
        sourceUrl: 'https://example.com',
        collectedAt: 'Illustrative collection record, not a live timestamp',
      },
    ];
  }

  return [
    {
      type: 'trend',
      summary: `示例趋势信号：${topic}值得进一步验证。`,
      metric: '示例指标，非实时数据',
      sourceName: '示例来源',
      sourceUrl: 'https://example.com',
      collectedAt: '演示采集记录，非真实时间',
    },
    {
      type: 'competition',
      summary: `示例竞品观察：${topic}需要进一步确认差异化表达。`,
      metric: '示例观察，非真实市场结论',
      sourceName: '示例来源',
      sourceUrl: 'https://example.com',
      collectedAt: '演示采集记录，非真实时间',
    },
    {
      type: 'price',
      summary: `示例预算提示：${topic}应在小批量验证后再评估。`,
      metric: '示例价格区间，非实时数据',
      sourceName: '示例来源',
      sourceUrl: 'https://example.com',
      collectedAt: '演示采集记录，非真实时间',
    },
    {
      type: 'reviews',
      summary: `示例评论主题：消费者可能需要更清晰的${topic}选择说明。`,
      metric: '示例评论痛点，非真实消费者反馈',
      sourceName: '示例来源',
      sourceUrl: 'https://example.com',
      collectedAt: '演示采集记录，非真实时间',
    },
    {
      type: 'collection',
      summary: `${topic}的示例采集说明；未执行实时平台采集。`,
      metric: '示例采集记录，非实时数据',
      sourceName: '示例来源',
      sourceUrl: 'https://example.com',
      collectedAt: '演示采集记录，非真实时间',
    },
  ];
};

const zhDemoOpportunities: Opportunity[] = [
  {
    id: 'illustrative-layering-accessories',
    name: '示例：可叠戴穿搭配饰',
    score: 72,
    reasons: ['示例假设：短视频展示可帮助解释搭配方式。', '示例假设：可从小批量和少量款式开始验证。'],
    budgetFit: '示例适配：可按所选预算先做小批量验证。',
    risk: '示例风险：风格偏好和内容表现仍需真实研究确认。',
    visualPlaceholder: '候选商品视觉：可叠戴穿搭配饰氛围图，不作为数据证据',
    evidence: illustrativeEvidence('可叠戴穿搭配饰', 'zh'),
  },
  {
    id: 'illustrative-versatile-outerwear',
    name: '示例：多场景轻外搭',
    score: 68,
    reasons: ['示例假设：多场景演示可能帮助说明使用价值。', '示例假设：款式聚焦可控制首次验证范围。'],
    budgetFit: '示例适配：可按所选预算，以少量尺码和款式控制验证成本。',
    risk: '示例风险：尺码、退换和季节因素需要额外验证。',
    visualPlaceholder: '候选商品视觉：多场景轻外搭氛围图，不作为数据证据',
    evidence: illustrativeEvidence('多场景轻外搭', 'zh'),
  },
  {
    id: 'illustrative-personalized-patches',
    name: '示例：个性表达布贴组合',
    score: 64,
    reasons: ['示例假设：组合展示可提供内容创作切入点。', '示例假设：轻量产品适合先测试表达主题。'],
    budgetFit: '示例适配：可按所选预算开展少量主题组合验证。',
    risk: '示例风险：题材选择和版权边界必须在真实执行前核实。',
    visualPlaceholder: '候选商品视觉：个性表达布贴组合氛围图，不作为数据证据',
    evidence: illustrativeEvidence('个性表达布贴组合', 'zh'),
  },
];

const enDemoOpportunities: Opportunity[] = [
  {
    id: 'illustrative-layering-accessories',
    name: 'Illustrative: Layered styling accessories',
    score: 72,
    reasons: ['Illustrative hypothesis: short video can explain styling combinations.', 'Illustrative hypothesis: a small batch and limited styles can validate the idea.'],
    budgetFit: 'Illustrative fit: start with a small-batch validation within the selected budget.',
    risk: 'Illustrative risk: style preferences and content performance need real research validation.',
    visualPlaceholder: 'Candidate product visual: layered styling accessories mood image, not data evidence',
    evidence: illustrativeEvidence('layered styling accessories', 'en'),
  },
  {
    id: 'illustrative-versatile-outerwear',
    name: 'Illustrative: Versatile light outerwear',
    score: 68,
    reasons: ['Illustrative hypothesis: multi-context demonstrations can explain usage value.', 'Illustrative hypothesis: focused styles can limit the first validation scope.'],
    budgetFit: 'Illustrative fit: use a limited size and style range to manage validation costs within the selected budget.',
    risk: 'Illustrative risk: sizing, returns, and seasonality need further validation.',
    visualPlaceholder: 'Candidate product visual: versatile light outerwear mood image, not data evidence',
    evidence: illustrativeEvidence('versatile light outerwear', 'en'),
  },
  {
    id: 'illustrative-personalized-patches',
    name: 'Illustrative: Personal expression patch sets',
    score: 64,
    reasons: ['Illustrative hypothesis: combinations can create an entry point for content creation.', 'Illustrative hypothesis: lightweight products can test expression themes first.'],
    budgetFit: 'Illustrative fit: use the selected budget to validate a small set of themes.',
    risk: 'Illustrative risk: theme selection and intellectual-property boundaries require real-world checks.',
    visualPlaceholder: 'Candidate product visual: personal expression patch-set mood image, not data evidence',
    evidence: illustrativeEvidence('personal expression patch sets', 'en'),
  },
];

export const demoOpportunitiesByLocale: Record<Locale, Opportunity[]> = {
  zh: zhDemoOpportunities,
  en: enDemoOpportunities,
};

const genericOpportunityNames: Record<Locale, string[]> = {
  zh: ['轻量入门组合', '痛点导向组合', '内容表达主题'],
  en: ['Lightweight starter set', 'Problem-led bundle', 'Content-first niche'],
};

const buildCategoryOpportunities = (categoryId: string, locale: Locale): Opportunity[] => {
  const category = categoryScenes.find((scene) => scene.id === categoryId) ?? categoryScenes[0];
  const categoryName = category.title[locale];

  return genericOpportunityNames[locale].map((direction, index) => {
    const topic = locale === 'zh' ? `${categoryName}${direction}` : `${categoryName}: ${direction}`;

    return {
      id: `illustrative-${category.id}-${index + 1}`,
      name: locale === 'zh' ? `示例：${topic}` : `Illustrative: ${topic}`,
      score: 70 - index * 4,
      reasons: locale === 'zh'
        ? ['示例假设：该方向可从有限范围开始验证。', '示例假设：内容展示可帮助观察早期兴趣。']
        : ['Illustrative hypothesis: this direction can start with a limited validation scope.', 'Illustrative hypothesis: content demonstrations can help observe early interest.'],
      budgetFit: locale === 'zh'
        ? '示例适配：先用小批量控制预算并验证关键假设。'
        : 'Illustrative fit: use a small batch to control budget while validating key assumptions.',
      risk: locale === 'zh'
        ? '示例风险：真实需求、竞争与履约条件仍需进一步研究。'
        : 'Illustrative risk: real demand, competition, and fulfillment conditions need further research.',
      visualPlaceholder: locale === 'zh'
        ? `候选商品视觉：${topic}氛围图，不作为数据证据`
        : `Candidate product visual: ${topic} mood image, not data evidence`,
      evidence: illustrativeEvidence(topic, locale),
    };
  });
};

export const getDemoOpportunities = (categoryId: string, locale: Locale): Opportunity[] => (
  categoryId === demoResearchInput.categoryId
    ? demoOpportunitiesByLocale[locale]
    : buildCategoryOpportunities(categoryId, locale)
);

// Retained as the Chinese default for components that do not yet receive locale.
export const demoOpportunities = getDemoOpportunities(demoResearchInput.categoryId, 'zh');
