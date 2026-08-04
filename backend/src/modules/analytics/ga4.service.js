import { JWT } from 'google-auth-library';

const GA4_READONLY_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';
const GA4_BETA_BASE_URL = 'https://analyticsdata.googleapis.com/v1beta';
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_LIST_LIMIT = 10;

const round = (value, decimals = 2) => {
  const factor = 10 ** decimals;
  return Math.round(Number(value || 0) * factor) / factor;
};

const toInteger = (value) => Number.parseInt(value || '0', 10) || 0;
const toFloat = (value) => Number.parseFloat(value || '0') || 0;
const toPercent = (value) => round(toFloat(value) * 100, 2);

const normalizePrivateKey = (value = '') => String(value).replace(/\\n/g, '\n').trim();

const getGa4Config = () => {
  const propertyId = String(process.env.GA4_PROPERTY_ID || '').trim();
  const clientEmail = String(process.env.GA4_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = normalizePrivateKey(process.env.GA4_SERVICE_ACCOUNT_PRIVATE_KEY || '');
  const lookerStudioEmbedUrl = String(process.env.LOOKER_STUDIO_EMBED_URL || '').trim();

  return {
    propertyId,
    clientEmail,
    privateKey,
    lookerStudioEmbedUrl,
    enabled: Boolean(propertyId && clientEmail && privateKey),
  };
};

const getPropertyPath = (propertyId) => `properties/${propertyId}`;

const getDateRange = (days = DEFAULT_LOOKBACK_DAYS) => ([
  {
    startDate: `${Math.max(1, Number(days) || DEFAULT_LOOKBACK_DAYS)}daysAgo`,
    endDate: 'today',
  },
]);

const buildAuthClient = (config) => new JWT({
  email: config.clientEmail,
  key: config.privateKey,
  scopes: [GA4_READONLY_SCOPE],
});

const createDisabledResponse = (config, reason) => ({
  enabled: false,
  status: 'disabled',
  reason,
  propertyId: config.propertyId || '',
  generatedAt: new Date().toISOString(),
  range: { days: DEFAULT_LOOKBACK_DAYS },
  errors: reason ? [reason] : [],
  overview: { summary: null, trend: [] },
  acquisition: { channels: [], sourceMediums: [], campaigns: [], countries: [] },
  engagement: { topPages: [], landingPages: [], events: [], hourly: [] },
  technology: { devices: [], browsers: [], operatingSystems: [] },
  commerce: { summary: null, products: [], purchaseJourney: [], currencies: [] },
  realtime: { activeUsers: 0, byMinute: [], countries: [], devices: [], pages: [] },
  retention: { summary: null, rows: [] },
  audiences: { audiences: [], trend: [] },
  embed: {
    available: Boolean(config.lookerStudioEmbedUrl),
    url: config.lookerStudioEmbedUrl || '',
  },
});

const formatGa4Date = (value = '') => {
  if (!/^\d{8}$/.test(value)) {
    return value;
  }

  return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
};

const mapRows = (response = {}) => {
  const dimensionHeaders = (response.dimensionHeaders || []).map((header) => header.name);
  const metricHeaders = (response.metricHeaders || []).map((header) => header.name);

  return (response.rows || []).map((row) => {
    const result = {};

    dimensionHeaders.forEach((name, index) => {
      result[name] = row.dimensionValues?.[index]?.value || '';
    });

    metricHeaders.forEach((name, index) => {
      result[name] = row.metricValues?.[index]?.value || '0';
    });

    return result;
  });
};

const runReport = async (client, propertyId, requestBody) => {
  const url = `${GA4_BETA_BASE_URL}/${getPropertyPath(propertyId)}:runReport`;
  const response = await client.request({
    url,
    method: 'POST',
    data: requestBody,
  });
  return response.data;
};

const runRealtimeReport = async (client, propertyId, requestBody) => {
  const url = `${GA4_BETA_BASE_URL}/${getPropertyPath(propertyId)}:runRealtimeReport`;
  const response = await client.request({
    url,
    method: 'POST',
    data: requestBody,
  });
  return response.data;
};

const withSectionFallback = async (errors, label, loader, fallbackValue) => {
  try {
    return await loader();
  } catch (error) {
    errors.push(`${label}: ${error.message}`);
    return fallbackValue;
  }
};

const buildOverviewSummary = (rows) => {
  const row = rows[0] || {};

  return {
    activeUsers: toInteger(row.activeUsers),
    totalUsers: toInteger(row.totalUsers),
    newUsers: toInteger(row.newUsers),
    sessions: toInteger(row.sessions),
    engagedSessions: toInteger(row.engagedSessions),
    engagementRate: toPercent(row.engagementRate),
    bounceRate: toPercent(row.bounceRate),
    averageSessionDuration: round(row.averageSessionDuration, 1),
    screenPageViews: toInteger(row.screenPageViews),
    screenPageViewsPerSession: round(row.screenPageViewsPerSession, 2),
    eventCount: toInteger(row.eventCount),
    checkouts: toInteger(row.checkouts),
    transactions: toInteger(row.transactions),
    ecommercePurchases: toInteger(row.ecommercePurchases),
    totalRevenue: round(row.totalRevenue),
    purchaseRevenue: round(row.purchaseRevenue),
    refundAmount: round(row.refundAmount),
    scrolledUsers: toInteger(row.scrolledUsers),
    sessionKeyEventRate: toPercent(row.sessionKeyEventRate),
    userKeyEventRate: toPercent(row.userKeyEventRate),
  };
};

const buildTrendRows = (rows) => rows.map((row) => ({
  date: formatGa4Date(row.date),
  label: formatGa4Date(row.date).slice(5),
  activeUsers: toInteger(row.activeUsers),
  sessions: toInteger(row.sessions),
  screenPageViews: toInteger(row.screenPageViews),
  newUsers: toInteger(row.newUsers),
  totalRevenue: round(row.totalRevenue),
  ecommercePurchases: toInteger(row.ecommercePurchases),
}));

const buildSimpleMetricRows = (rows, dimensionKey, fields = {}) => rows.map((row) => ({
  label: row[dimensionKey] || '(not set)',
  sessions: toInteger(row.sessions),
  activeUsers: toInteger(row.activeUsers),
  newUsers: toInteger(row.newUsers),
  engagedSessions: toInteger(row.engagedSessions),
  engagementRate: row.engagementRate == null ? null : toPercent(row.engagementRate),
  totalRevenue: row.totalRevenue == null ? null : round(row.totalRevenue),
  ...fields(row),
}));

const formatHourLabel = (hourValue) => `${String(toInteger(hourValue)).padStart(2, '0')}:00`;

const getWeeklyCohortRange = () => {
  const now = new Date();
  const utcDay = now.getUTCDay();
  const startOfCurrentWeek = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - utcDay));
  const startOfCohortWeek = new Date(startOfCurrentWeek.getTime() - (5 * 7 * 24 * 60 * 60 * 1000));
  const endOfCohortWeek = new Date(startOfCohortWeek.getTime() + (6 * 24 * 60 * 60 * 1000));

  const formatDate = (date) => date.toISOString().slice(0, 10);

  return {
    startDate: formatDate(startOfCohortWeek),
    endDate: formatDate(endOfCohortWeek),
  };
};

export const getGa4AnalyticsCenter = async ({ days = DEFAULT_LOOKBACK_DAYS } = {}) => {
  const config = getGa4Config();
  const numericDays = Math.max(7, Number(days) || DEFAULT_LOOKBACK_DAYS);

  if (!config.enabled) {
    return createDisabledResponse(config, 'GA4 credentials are not configured.');
  }

  const client = buildAuthClient(config);
  const errors = [];
  const dateRanges = getDateRange(numericDays);
  const cohortDateRange = getWeeklyCohortRange();

  const [
    overviewSummary,
    overviewTrend,
    acquisitionChannels,
    acquisitionSourceMediums,
    acquisitionCampaigns,
    acquisitionCountries,
    engagementPages,
    engagementLandingPages,
    engagementEvents,
    engagementHourly,
    technologyDevices,
    technologyBrowsers,
    technologyOperatingSystems,
    commerceSummary,
    commerceProducts,
    commerceCurrencies,
    realtimeActive,
    realtimeByMinute,
    realtimeCountries,
    realtimeDevices,
    realtimePages,
    retentionRows,
    audienceSummary,
    audienceTrend,
  ] = await Promise.all([
    withSectionFallback(errors, 'overview.summary', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      metrics: [
        { name: 'activeUsers' },
        { name: 'totalUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' },
        { name: 'bounceRate' },
        { name: 'averageSessionDuration' },
        { name: 'screenPageViews' },
        { name: 'screenPageViewsPerSession' },
        { name: 'eventCount' },
        { name: 'checkouts' },
        { name: 'transactions' },
        { name: 'ecommercePurchases' },
        { name: 'totalRevenue' },
        { name: 'purchaseRevenue' },
        { name: 'refundAmount' },
        { name: 'scrolledUsers' },
        { name: 'sessionKeyEventRate' },
        { name: 'userKeyEventRate' },
      ],
      limit: 1,
    })), []),
    withSectionFallback(errors, 'overview.trend', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'date' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'screenPageViews' },
        { name: 'newUsers' },
        { name: 'totalRevenue' },
        { name: 'ecommercePurchases' },
      ],
      orderBys: [{ dimension: { dimensionName: 'date' } }],
      limit: Math.min(numericDays, 90),
    })), []),
    withSectionFallback(errors, 'acquisition.channels', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'sessionPrimaryChannelGroup' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'engagedSessions' },
        { name: 'engagementRate' },
        { name: 'totalRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'acquisition.sourceMediums', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'sessionSourceMedium' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'engagementRate' },
        { name: 'totalRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'acquisition.campaigns', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'sessionCampaignName' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'totalRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'acquisition.countries', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'country' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'totalRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'engagement.topPages', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'pagePath' }, { name: 'pageTitle' }],
      metrics: [
        { name: 'screenPageViews' },
        { name: 'activeUsers' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
        { name: 'eventCount' },
      ],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'engagement.landingPages', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'landingPage' }],
      metrics: [
        { name: 'sessions' },
        { name: 'activeUsers' },
        { name: 'engagementRate' },
        { name: 'averageSessionDuration' },
      ],
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'engagement.events', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'eventName' }],
      metrics: [
        { name: 'eventCount' },
        { name: 'totalUsers' },
      ],
      orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'engagement.hourly', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'hour' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'eventCount' },
      ],
      orderBys: [{ dimension: { dimensionName: 'hour' } }],
      limit: 24,
    })), []),
    withSectionFallback(errors, 'technology.devices', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
        { name: 'engagementRate' },
        { name: 'totalRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'technology.browsers', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'browser' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
      ],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'technology.operatingSystems', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'operatingSystem' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'sessions' },
      ],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'commerce.summary', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      metrics: [
        { name: 'checkouts' },
        { name: 'transactions' },
        { name: 'ecommercePurchases' },
        { name: 'purchaseRevenue' },
        { name: 'totalRevenue' },
        { name: 'refundAmount' },
        { name: 'totalPurchasers' },
        { name: 'averageRevenuePerUser' },
        { name: 'averagePurchaseRevenuePerUser' },
      ],
      limit: 1,
    })), []),
    withSectionFallback(errors, 'commerce.products', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'itemName' }],
      metrics: [
        { name: 'itemsPurchased' },
        { name: 'itemRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'itemRevenue' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'commerce.currencies', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'currencyCode' }],
      metrics: [
        { name: 'transactions' },
        { name: 'totalRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'totalRevenue' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'realtime.activeUsers', async () => mapRows(await runRealtimeReport(client, config.propertyId, {
      metrics: [{ name: 'activeUsers' }],
      limit: 1,
    })), []),
    withSectionFallback(errors, 'realtime.byMinute', async () => mapRows(await runRealtimeReport(client, config.propertyId, {
      dimensions: [{ name: 'minutesAgo' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ dimension: { dimensionName: 'minutesAgo' } }],
      limit: 30,
    })), []),
    withSectionFallback(errors, 'realtime.countries', async () => mapRows(await runRealtimeReport(client, config.propertyId, {
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'realtime.devices', async () => mapRows(await runRealtimeReport(client, config.propertyId, {
      dimensions: [{ name: 'deviceCategory' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'realtime.pages', async () => mapRows(await runRealtimeReport(client, config.propertyId, {
      dimensions: [{ name: 'unifiedScreenName' }],
      metrics: [{ name: 'screenPageViews' }],
      orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'retention', async () => mapRows(await runReport(client, config.propertyId, {
      dimensions: [{ name: 'cohort' }, { name: 'cohortNthWeek' }],
      metrics: [{ name: 'cohortActiveUsers' }, { name: 'cohortTotalUsers' }],
      cohortSpec: {
        cohorts: [
          {
            name: 'Acquired users',
            dimension: 'firstSessionDate',
            dateRange: cohortDateRange,
          },
        ],
        cohortsRange: {
          granularity: 'WEEKLY',
          startOffset: 0,
          endOffset: 4,
        },
      },
      orderBys: [{ dimension: { dimensionName: 'cohortNthWeek' } }],
      keepEmptyRows: true,
    })), []),
    withSectionFallback(errors, 'audiences.summary', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'audienceName' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'newUsers' },
        { name: 'sessions' },
        { name: 'screenPageViewsPerSession' },
        { name: 'averageSessionDuration' },
        { name: 'totalRevenue' },
      ],
      orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
      limit: DEFAULT_LIST_LIMIT,
    })), []),
    withSectionFallback(errors, 'audiences.trend', async () => mapRows(await runReport(client, config.propertyId, {
      dateRanges,
      dimensions: [{ name: 'date' }, { name: 'audienceName' }],
      metrics: [{ name: 'activeUsers' }],
      orderBys: [
        { dimension: { dimensionName: 'date' } },
        { metric: { metricName: 'activeUsers' }, desc: true },
      ],
      limit: Math.min(numericDays * 5, 150),
    })), []),
  ]);

  const overview = {
    summary: buildOverviewSummary(overviewSummary),
    trend: buildTrendRows(overviewTrend),
  };

  const acquisition = {
    channels: buildSimpleMetricRows(acquisitionChannels, 'sessionPrimaryChannelGroup'),
    sourceMediums: buildSimpleMetricRows(acquisitionSourceMediums, 'sessionSourceMedium'),
    campaigns: buildSimpleMetricRows(acquisitionCampaigns, 'sessionCampaignName'),
    countries: acquisitionCountries.map((row) => ({
      label: row.country || '(not set)',
      activeUsers: toInteger(row.activeUsers),
      sessions: toInteger(row.sessions),
      totalRevenue: round(row.totalRevenue),
    })),
  };

  const engagement = {
    topPages: engagementPages.map((row) => ({
      path: row.pagePath || '/',
      title: row.pageTitle || row.pagePath || '/',
      screenPageViews: toInteger(row.screenPageViews),
      activeUsers: toInteger(row.activeUsers),
      engagementRate: toPercent(row.engagementRate),
      averageSessionDuration: round(row.averageSessionDuration, 1),
      eventCount: toInteger(row.eventCount),
    })),
    landingPages: engagementLandingPages.map((row) => ({
      label: row.landingPage || '(not set)',
      sessions: toInteger(row.sessions),
      activeUsers: toInteger(row.activeUsers),
      engagementRate: toPercent(row.engagementRate),
      averageSessionDuration: round(row.averageSessionDuration, 1),
    })),
    events: engagementEvents.map((row) => ({
      label: row.eventName || '(not set)',
      eventCount: toInteger(row.eventCount),
      totalUsers: toInteger(row.totalUsers),
    })),
    hourly: engagementHourly.map((row) => ({
      hour: formatHourLabel(row.hour),
      activeUsers: toInteger(row.activeUsers),
      sessions: toInteger(row.sessions),
      eventCount: toInteger(row.eventCount),
    })),
  };

  const technology = {
    devices: buildSimpleMetricRows(technologyDevices, 'deviceCategory'),
    browsers: technologyBrowsers.map((row) => ({
      label: row.browser || '(not set)',
      activeUsers: toInteger(row.activeUsers),
      sessions: toInteger(row.sessions),
    })),
    operatingSystems: technologyOperatingSystems.map((row) => ({
      label: row.operatingSystem || '(not set)',
      activeUsers: toInteger(row.activeUsers),
      sessions: toInteger(row.sessions),
    })),
  };

  const commerce = {
    summary: {
      checkouts: toInteger(commerceSummary[0]?.checkouts),
      transactions: toInteger(commerceSummary[0]?.transactions),
      ecommercePurchases: toInteger(commerceSummary[0]?.ecommercePurchases),
      purchaseRevenue: round(commerceSummary[0]?.purchaseRevenue),
      totalRevenue: round(commerceSummary[0]?.totalRevenue),
      refundAmount: round(commerceSummary[0]?.refundAmount),
      totalPurchasers: toInteger(commerceSummary[0]?.totalPurchasers),
      averageRevenuePerUser: round(commerceSummary[0]?.averageRevenuePerUser),
      averagePurchaseRevenuePerUser: round(commerceSummary[0]?.averagePurchaseRevenuePerUser),
    },
    products: commerceProducts.map((row) => ({
      label: row.itemName || '(not set)',
      itemsPurchased: toInteger(row.itemsPurchased),
      itemRevenue: round(row.itemRevenue),
    })),
    purchaseJourney: [
      { key: 'sessions', label: 'Sessions', count: overview.summary.sessions },
      { key: 'checkouts', label: 'Checkouts', count: toInteger(commerceSummary[0]?.checkouts) },
      { key: 'transactions', label: 'Transactions', count: toInteger(commerceSummary[0]?.transactions) },
      { key: 'purchases', label: 'Purchases', count: toInteger(commerceSummary[0]?.ecommercePurchases) },
    ],
    currencies: commerceCurrencies.map((row) => ({
      label: row.currencyCode || '(not set)',
      transactions: toInteger(row.transactions),
      totalRevenue: round(row.totalRevenue),
    })),
  };

  const realtime = {
    activeUsers: toInteger(realtimeActive[0]?.activeUsers),
    byMinute: realtimeByMinute
      .map((row) => ({
        minute: Math.max(0, 29 - toInteger(row.minutesAgo)),
        label: `${toInteger(row.minutesAgo)} min ago`,
        activeUsers: toInteger(row.activeUsers),
      }))
      .sort((left, right) => left.minute - right.minute),
    countries: realtimeCountries.map((row) => ({
      label: row.country || '(not set)',
      activeUsers: toInteger(row.activeUsers),
    })),
    devices: realtimeDevices.map((row) => ({
      label: row.deviceCategory || '(not set)',
      activeUsers: toInteger(row.activeUsers),
    })),
    pages: realtimePages.map((row) => ({
      label: row.unifiedScreenName || '(not set)',
      screenPageViews: toInteger(row.screenPageViews),
    })),
  };

  const retentionParsedRows = retentionRows.map((row) => {
    const cohortActiveUsers = toInteger(row.cohortActiveUsers);
    const cohortTotalUsers = toInteger(row.cohortTotalUsers);
    return {
      cohort: row.cohort || 'Acquired users',
      week: toInteger(row.cohortNthWeek),
      cohortActiveUsers,
      cohortTotalUsers,
      retentionRate: cohortTotalUsers > 0 ? round((cohortActiveUsers / cohortTotalUsers) * 100, 2) : 0,
    };
  });
  const retention = {
    summary: retentionParsedRows.length > 0
      ? {
          cohortName: retentionParsedRows[0].cohort,
          cohortSize: retentionParsedRows[0].cohortTotalUsers,
          latestRetentionRate: retentionParsedRows[retentionParsedRows.length - 1]?.retentionRate || 0,
        }
      : null,
    rows: retentionParsedRows,
  };

  const audiences = {
    audiences: audienceSummary.map((row) => ({
      label: row.audienceName || '(not set)',
      activeUsers: toInteger(row.activeUsers),
      newUsers: toInteger(row.newUsers),
      sessions: toInteger(row.sessions),
      screenPageViewsPerSession: round(row.screenPageViewsPerSession, 2),
      averageSessionDuration: round(row.averageSessionDuration, 1),
      totalRevenue: round(row.totalRevenue),
    })),
    trend: audienceTrend.map((row) => ({
      date: formatGa4Date(row.date),
      audienceName: row.audienceName || '(not set)',
      activeUsers: toInteger(row.activeUsers),
    })),
  };

  return {
    enabled: true,
    status: errors.length > 0 ? 'partial' : 'ready',
    propertyId: config.propertyId,
    generatedAt: new Date().toISOString(),
    range: { days: numericDays },
    errors,
    overview,
    acquisition,
    engagement,
    technology,
    commerce,
    realtime,
    retention,
    audiences,
    embed: {
      available: Boolean(config.lookerStudioEmbedUrl),
      url: config.lookerStudioEmbedUrl || '',
    },
  };
};
