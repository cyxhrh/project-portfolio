import type { Locale } from './types';

type Copy = {
  brand: string;
  homeLabel: string;
  ideaHomeTitle: string;
  ideaInputLabel: string;
  ideaPlaceholder: string;
  ideaExample: string;
  findOpportunity: string;
  ideaSubmitted: string;
  languageLabel: string;
  languageChinese: string;
  languageEnglish: string;
  foundationEyebrow: string;
  foundationTitle: string;
  foundationDescription: string;
  exploreTitle: string;
  exploreDescription: string;
  chooseDirection: string;
  previous: string;
  next: string;
  directionNavigation: string;
  thumbnailRail: string;
  viewDirection: (category: string) => string;
  researchTitle: (category: string) => string;
  researchDescription: string;
  researchInputGroup: string;
  researchTargetGroup: string;
  category: string;
  budget: string;
  currency: string;
  country: string;
  countryInputHint: string;
  globeEyebrow: string;
  globeInteractionLabel: string;
  globeLoading: string;
  globeFallback: string;
  globeDragInstruction: string;
  globeMarkerList: string;
  selectCountry: (country: string) => string;
  platform: string;
  startResearch: string;
  backToExplore: string;
  resultDisclaimer: string;
  researchingTitle: (country: string, platform: string) => string;
  researchingDescription: string;
  researchSimulationNotice: string;
  progressTrend: string;
  progressCompetition: string;
  progressBudget: string;
  progressEvidence: string;
  progressAnnouncement: (stage: string) => string;
  insufficientData: string;
  error: string;
  backToConditions: string;
  retryResearch: string;
  opportunitiesTitle: string;
  opportunitiesDescription: (category: string, budget: string, country: string, platform: string) => string;
  editConditions: string;
  opportunityScore: string;
  budgetFit: string;
  primaryRisk: string;
  viewEvidence: string;
  candidateDirection: (index: number, opportunity: string) => string;
  evidenceDialogLabel: string;
  evidenceTitle: (opportunity: string) => string;
  evidenceTrend: string;
  evidenceCompetition: string;
  evidencePrice: string;
  evidenceReviews: string;
  evidenceCollection: string;
  source: string;
  collectedAt: string;
  coverageNote: string;
  openSource: string;
  close: string;
  illustrativeNotice: string;
  researchCoverage: (category: string, budget: string, country: string, platform: string) => string;
};

export const copy: Record<Locale, Copy> = {
  zh: {
    brand: '商机罗盘',
    homeLabel: '商机罗盘首页',
    ideaHomeTitle: '每一个想法，都值得走向世界。',
    ideaInputLabel: '商业想法',
    ideaPlaceholder: '写下你的商业想法，从这里开始。',
    ideaExample: '例如：为每天做饭洗碗的人解决水槽下收纳混乱',
    findOpportunity: '寻找商业机会',
    ideaSubmitted: '正在让你的想法走向全球。',
    languageLabel: '语言切换',
    languageChinese: '中文',
    languageEnglish: 'English',
    foundationEyebrow: 'VENTURE COMPASS',
    foundationTitle: '发现下一处商机',
    foundationDescription: '桌面端产品原型正在构建中。',
    exploreTitle: '从一个你愿意投入的方向开始',
    exploreDescription: '先选择感兴趣的品类。我们再用市场、预算和平台条件缩小机会范围。',
    chooseDirection: '选择此方向',
    previous: '上一个方向',
    next: '下一个方向',
    directionNavigation: '方向切换',
    thumbnailRail: '品类方向',
    viewDirection: (category) => `查看${category}`,
    researchTitle: (category) => `为${category}建立研究条件`,
    researchDescription: '这些约束帮助 Agent 判断什么方向更适合你现在开始。',
    researchInputGroup: '品类方向、预算与货币',
    researchTargetGroup: '目标国家、目标平台与操作',
    category: '品类方向',
    budget: '预算',
    currency: '货币',
    country: '目标国家',
    countryInputHint: '可输入或从支持的市场中选择国家。',
    globeEyebrow: '全球市场',
    globeInteractionLabel: '可拖拽旋转的全球市场地球',
    globeLoading: '正在加载全球市场地图…',
    globeFallback: '地图不可用，仍可输入国家。',
    globeDragInstruction: '拖拽旋转地球，或使用国家输入框和市场列表进行选择。',
    globeMarkerList: '可选全球市场',
    selectCountry: (country) => `选择${country}`,
    platform: '目标平台',
    startResearch: '开始寻找商机',
    backToExplore: '返回选择方向',
    resultDisclaimer: '结果是值得验证的方向，不代表收益保证。',
    researchingTitle: (country, platform) => `正在演示为${country} ${platform}寻找机会的流程`,
    researchingDescription: '商机研究演示步骤',
    researchSimulationNotice: '演示说明：以下步骤为非实时的示意流程，未执行实时市场研究。',
    progressTrend: '演示步骤：分析趋势',
    progressCompetition: '演示步骤：分析竞品',
    progressBudget: '演示步骤：评估预算适配',
    progressEvidence: '演示步骤：整理示例证据',
    progressAnnouncement: (stage) => `当前进度：${stage}`,
    insufficientData: '当前示例覆盖不足，请修改条件后重试。',
    error: '示例研究暂时无法完成，请重新研究。',
    backToConditions: '返回修改条件',
    retryResearch: '重新研究',
    opportunitiesTitle: '为你筛出的 3 个商品方向',
    opportunitiesDescription: (category, budget, country, platform) => `基于${category}、${budget}、${country}和${platform}的示例研究结果。`,
    editConditions: '编辑条件并重新研究',
    opportunityScore: '示例机会评分',
    budgetFit: '预算适配',
    primaryRisk: '主要风险',
    viewEvidence: '查看数据依据',
    candidateDirection: (index, opportunity) => `候选商品方向 ${index}：${opportunity}`,
    evidenceDialogLabel: '数据依据',
    evidenceTitle: (opportunity) => `${opportunity}的数据依据`,
    evidenceTrend: '趋势',
    evidenceCompetition: '竞品',
    evidencePrice: '价格',
    evidenceReviews: '评论痛点',
    evidenceCollection: '采集信息',
    source: '示例来源',
    collectedAt: '示例采集时间',
    coverageNote: '覆盖说明',
    openSource: '打开示例来源',
    close: '关闭',
    illustrativeNotice: '本页为非实时的演示数据，仅用于界面展示与验证。',
    researchCoverage: (category, budget, country, platform) => `所选研究覆盖：品类 ${category}、预算 ${budget}、目标国家 ${country}、目标平台 ${platform}。`,
  },
  en: {
    brand: 'Venture Compass',
    homeLabel: 'Venture Compass home',
    ideaHomeTitle: 'Every idea deserves to go global.',
    ideaInputLabel: 'Business idea',
    ideaPlaceholder: 'Write down your business idea. Start here.',
    ideaExample: 'For example: solve messy under-sink storage for people who cook and wash up every day',
    findOpportunity: 'Find business opportunities',
    ideaSubmitted: 'Your idea is going global.',
    languageLabel: 'Language switcher',
    languageChinese: '中文',
    languageEnglish: 'English',
    foundationEyebrow: 'VENTURE COMPASS',
    foundationTitle: 'Find your next opportunity',
    foundationDescription: 'The desktop product prototype is being built.',
    exploreTitle: 'Start with a direction you want to pursue',
    exploreDescription: 'Choose an area of interest first. Market, budget, and platform constraints narrow the opportunity space.',
    chooseDirection: 'Choose this direction',
    previous: 'Previous direction',
    next: 'Next direction',
    directionNavigation: 'Direction navigation',
    thumbnailRail: 'Category directions',
    viewDirection: (category) => `View ${category.toLocaleLowerCase('en')}`,
    researchTitle: (category) => `Set research conditions for ${category}`,
    researchDescription: 'These constraints help the agent assess which direction better suits a first step.',
    researchInputGroup: 'Category, budget, and currency',
    researchTargetGroup: 'Target country, platform, and actions',
    category: 'Category',
    budget: 'Budget',
    currency: 'Currency',
    country: 'Target country',
    countryInputHint: 'Type a country or choose a supported market.',
    globeEyebrow: 'Global markets',
    globeInteractionLabel: 'Draggable global markets globe',
    globeLoading: 'Loading global markets map…',
    globeFallback: 'Map unavailable; you can still enter a country.',
    globeDragInstruction: 'Drag to rotate the globe, or use the country input and market list to select a market.',
    globeMarkerList: 'Available global markets',
    selectCountry: (country) => `Select ${country}`,
    platform: 'Target platform',
    startResearch: 'Start opportunity research',
    backToExplore: 'Back to directions',
    resultDisclaimer: 'These are directions to validate, not a guarantee of returns.',
    researchingTitle: (country, platform) => `Demonstrating opportunity research for ${country} on ${platform}`,
    researchingDescription: 'Opportunity research demonstration steps',
    researchSimulationNotice: 'Demo notice: The steps below are an illustrative, non-live simulation; no live market research is being performed.',
    progressTrend: 'Demo step: analyze trends',
    progressCompetition: 'Demo step: analyze competition',
    progressBudget: 'Demo step: assess budget fit',
    progressEvidence: 'Demo step: organize illustrative evidence',
    progressAnnouncement: (stage) => `Current progress: ${stage}`,
    insufficientData: 'The illustrative coverage is insufficient. Adjust conditions and try again.',
    error: 'The illustrative research could not finish. Please retry.',
    backToConditions: 'Back to conditions',
    retryResearch: 'Retry research',
    opportunitiesTitle: 'Three product directions to explore',
    opportunitiesDescription: (category, budget, country, platform) => `Illustrative research for ${category}, ${budget}, ${country}, and ${platform}.`,
    editConditions: 'Edit conditions and research again',
    opportunityScore: 'Illustrative opportunity score',
    budgetFit: 'Budget fit',
    primaryRisk: 'Primary risk',
    viewEvidence: 'View supporting evidence',
    candidateDirection: (index, opportunity) => `Candidate product direction ${index}: ${opportunity}`,
    evidenceDialogLabel: 'Evidence',
    evidenceTitle: (opportunity) => `Evidence for ${opportunity}`,
    evidenceTrend: 'Trend',
    evidenceCompetition: 'Competition',
    evidencePrice: 'Price',
    evidenceReviews: 'Review themes',
    evidenceCollection: 'Collection notes',
    source: 'Illustrative source',
    collectedAt: 'Illustrative collection time',
    coverageNote: 'Coverage note',
    openSource: 'Open illustrative source',
    close: 'Close',
    illustrativeNotice: 'This page uses non-live demonstration data for interface testing only.',
    researchCoverage: (category, budget, country, platform) => `Selected research coverage: category ${category}, budget ${budget}, target country ${country}, and target platform ${platform}.`,
  },
};
