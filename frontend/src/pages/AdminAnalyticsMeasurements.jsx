import { useEffect, useMemo, useState } from 'react';
import { analyticsAPI, financeAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import useUIStore from '../store/uiStore';
import { downloadCsv, formatCsvDate } from '../utils/csv';
import { useLocale } from '../i18n/useLocale';

const DAY_OPTIONS = [7, 30, 90];
const TREND_METRICS = [
  { key: 'sessions', label: 'Sessions', color: '#ec4899' },
  { key: 'activeUsers', label: 'Active Users', color: '#0ea5e9' },
  { key: 'screenPageViews', label: 'Views', color: '#14b8a6' },
  { key: 'totalRevenue', label: 'Revenue', color: '#f59e0b' },
];
const TABS = [
  { key: 'executive', label: 'Executive' },
  { key: 'acquisition', label: 'Acquisition' },
  { key: 'engagement', label: 'Engagement' },
  { key: 'commerce', label: 'Commerce' },
  { key: 'retention', label: 'Retention' },
  { key: 'audiences', label: 'Audiences' },
  { key: 'realtime', label: 'Realtime' },
  { key: 'embedded', label: 'Embedded' },
];

const formatInteger = (value) => Number(value || 0).toLocaleString();
const formatPercent = (value) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
const formatCurrency = (value, currency = 'SAR') => `${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
const formatSeconds = (value) => {
  const totalSeconds = Math.max(0, Math.round(Number(value || 0)));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (!minutes) {
    return `${seconds}s`;
  }

  return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
};

const createDisabledGa4Payload = (daysValue = 30, reason = 'GA4 analytics are not available right now.') => ({
  enabled: false,
  status: 'disabled',
  reason,
  propertyId: '',
  generatedAt: new Date().toISOString(),
  range: { days: daysValue },
  errors: [reason],
  overview: { summary: null, trend: [] },
  acquisition: { channels: [], sourceMediums: [], campaigns: [], countries: [] },
  engagement: { topPages: [], landingPages: [], events: [], hourly: [] },
  technology: { devices: [], browsers: [], operatingSystems: [] },
  commerce: { summary: null, products: [], purchaseJourney: [], currencies: [] },
  realtime: { activeUsers: 0, byMinute: [], countries: [], devices: [], pages: [] },
  retention: { summary: null, rows: [] },
  audiences: { audiences: [], trend: [] },
  embed: { available: false, url: '' },
});

const buildLegacyCenterPayload = (internalData, daysValue = 30, reason) => ({
  generatedAt: new Date().toISOString(),
  internal: internalData,
  ga4: createDisabledGa4Payload(daysValue, reason),
});

const buildLineChart = (series, metricKey, width = 760, height = 260, padding = 28) => {
  const values = series.map((item) => Number(item?.[metricKey] || 0));
  const maxValue = Math.max(...values, 1);
  const innerWidth = width - padding * 2;
  const innerHeight = height - padding * 2;

  const points = values.map((value, index) => {
    const x = values.length <= 1 ? width / 2 : padding + (index / (values.length - 1)) * innerWidth;
    const y = padding + innerHeight - (value / maxValue) * innerHeight;
    return { x, y, value };
  });

  return {
    width,
    height,
    padding,
    maxValue,
    points,
    polyline: points.map((point) => `${point.x},${point.y}`).join(' '),
    area: [`${padding},${height - padding}`, ...points.map((point) => `${point.x},${point.y}`), `${width - padding},${height - padding}`].join(' '),
  };
};

function Card({ title, subtitle, actions, children, accent = 'default' }) {
  const accentClass = accent === 'gradient'
    ? 'border-primary-100 bg-gradient-to-br from-white via-primary-50/50 to-cyan-50/60'
    : 'border-gray-200 bg-white';

  return (
    <section className={`rounded-3xl border p-5 shadow-sm ${accentClass}`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-gray-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      {children}
    </section>
  );
}

function ActionButton({ children, onClick, primary = false, disabled = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        primary
          ? 'rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-gray-300'
          : 'rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-400'
      }
    >
      {children}
    </button>
  );
}

function TabButton({ active, children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={active
        ? 'rounded-full bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-sm'
        : 'rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 transition hover:border-primary-200 hover:text-primary-600'}
    >
      {children}
    </button>
  );
}

function KpiCard({ label, value, sublabel, icon, tone = 'default' }) {
  const tones = {
    default: 'border-gray-200 bg-white',
    soft: 'border-primary-100 bg-primary-50/60',
    dark: 'border-gray-900 bg-gray-900 text-white',
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone] || tones.default}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`text-xs uppercase tracking-[0.18em] ${tone === 'dark' ? 'text-white/70' : 'text-gray-400'}`}>{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${tone === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sublabel ? <p className={`mt-2 text-sm ${tone === 'dark' ? 'text-white/70' : 'text-gray-500'}`}>{sublabel}</p> : null}
    </div>
  );
}

function StatusBanner({ title, tone = 'info', children }) {
  const toneClass = tone === 'warning'
    ? 'border-amber-200 bg-amber-50 text-amber-900'
    : tone === 'danger'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-cyan-200 bg-cyan-50 text-cyan-900';

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClass}`}>
      <p className="text-sm font-semibold">{title}</p>
      <div className="mt-2 text-sm leading-7">{children}</div>
    </div>
  );
}

function DataTable({ columns, rows, emptyLabel }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-[0.18em] text-gray-400">
            {columns.map((column) => (
              <th key={column.key} className="px-3 py-3 first:pl-0 last:pr-0">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.id || row.label || row.path || rowIndex} className="border-b border-gray-100 align-top last:border-b-0">
              {columns.map((column) => (
                <td key={column.key} className="px-3 py-4 text-sm text-gray-700 first:pl-0 last:pr-0">
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BarsList({ rows, labelKey = 'label', valueKey = 'count', valueFormatter = formatInteger, emptyLabel }) {
  const maxValue = Math.max(...rows.map((row) => Number(row?.[valueKey] || 0)), 1);

  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center text-sm text-gray-500">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => {
        const rawValue = Number(row?.[valueKey] || 0);
        const width = `${Math.max(8, (rawValue / maxValue) * 100)}%`;
        return (
          <div key={`${row?.[labelKey]}-${rawValue}`}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="truncate text-sm font-medium text-gray-700">{row?.[labelKey]}</span>
              <span className="text-sm font-semibold text-gray-900">{valueFormatter(rawValue)}</span>
            </div>
            <div className="h-3 rounded-full bg-gray-100">
              <div className="h-3 rounded-full bg-gradient-to-r from-primary-500 to-cyan-400" style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({ data, metric, emptyLabel = 'No trend data yet.' }) {
  if (!data.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-16 text-center text-sm text-gray-500">
        {emptyLabel}
      </div>
    );
  }

  const chart = buildLineChart(data, metric.key);

  return (
    <div>
      <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-64 w-full">
        <defs>
          <linearGradient id={`trend-area-${metric.key}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={metric.color} stopOpacity="0.24" />
            <stop offset="100%" stopColor={metric.color} stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
          const y = chart.padding + (chart.height - chart.padding * 2) * fraction;
          return (
            <line
              key={fraction}
              x1={chart.padding}
              x2={chart.width - chart.padding}
              y1={y}
              y2={y}
              stroke="#e5e7eb"
              strokeDasharray="4 6"
            />
          );
        })}
        <polygon points={chart.area} fill={`url(#trend-area-${metric.key})`} />
        <polyline
          points={chart.polyline}
          fill="none"
          stroke={metric.color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {chart.points.map((point, index) => (
          <circle key={`${metric.key}-${index}`} cx={point.x} cy={point.y} r="4.5" fill={metric.color} stroke="#fff" strokeWidth="3" />
        ))}
      </svg>
      <div className="mt-3 grid grid-cols-4 gap-2 text-center text-[11px] text-gray-400 sm:grid-cols-8 lg:grid-cols-10">
        {data.map((item, index) => (
          <span key={`${item.date || item.label}-${index}`} className="truncate">{item.label || item.date}</span>
        ))}
      </div>
    </div>
  );
}

function RealtimeBars({ rows }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-16 text-center text-sm text-gray-500">
        Realtime data will appear here when users are active on the live site.
      </div>
    );
  }

  const maxValue = Math.max(...rows.map((row) => Number(row.activeUsers || 0)), 1);

  return (
    <div className="flex h-56 items-end gap-2 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-2">
          <div
            className="w-full rounded-t-2xl bg-gradient-to-t from-primary-500 to-cyan-400"
            style={{ height: `${Math.max(10, (Number(row.activeUsers || 0) / maxValue) * 150)}px` }}
            title={`${row.label}: ${row.activeUsers}`}
          />
          <span className="w-full truncate text-center text-[11px] text-gray-500">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

function RetentionGrid({ rows }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-16 text-center text-sm text-gray-500">
        Retention data will appear here after GA4 credentials are connected and enough time has passed to build cohorts.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {rows.map((row) => {
        const colorStrength = Math.max(8, Math.min(100, row.retentionRate));
        return (
          <div key={`${row.cohort}-${row.week}`} className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400">Week {row.week}</span>
              <span className="text-sm font-semibold text-gray-900">{formatPercent(row.retentionRate)}</span>
            </div>
            <div className="mb-3 h-4 rounded-full bg-gray-100">
              <div
                className="h-4 rounded-full bg-gradient-to-r from-primary-500 to-cyan-400"
                style={{ width: `${colorStrength}%` }}
              />
            </div>
            <p className="text-sm text-gray-600">{formatInteger(row.cohortActiveUsers)} active from {formatInteger(row.cohortTotalUsers)} acquired users</p>
          </div>
        );
      })}
    </div>
  );
}

function AdminAnalyticsMeasurements() {
  const { isRTL } = useLocale();
  const { showError } = useUIStore();
  const [center, setCenter] = useState(null);
  const [finance, setFinance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [activeTab, setActiveTab] = useState('executive');
  const [selectedTrendMetric, setSelectedTrendMetric] = useState('sessions');

  useEffect(() => {
    void fetchData(days);
  }, [days]);

  const fetchData = async (nextDays = days) => {
    try {
      if (!center) {
        setLoading(true);
      }

      const financePromise = financeAPI.getOverview().catch(() => ({ data: { summary: null } }));
      let centerRes;

      try {
        centerRes = await analyticsAPI.getAdminAnalyticsCenter({ days: nextDays });
      } catch (centerError) {
        console.warn('Analytics center endpoint failed, falling back to legacy admin analytics:', centerError);
        const legacyRes = await analyticsAPI.getAdminAnalytics();
        centerRes = {
          data: buildLegacyCenterPayload(
            legacyRes.data,
            nextDays,
            'GA4 analytics center endpoint is unavailable. Showing internal analytics only.'
          ),
        };
      }

      const financeRes = await financePromise;

      setCenter(centerRes.data);
      setFinance(financeRes.data?.summary || null);
    } catch (error) {
      console.error('Failed to fetch analytics center:', error);
      showError(isRTL ? 'تعذر تحميل مركز التحليلات والقياسات' : 'Failed to load analytics center');
    } finally {
      setLoading(false);
    }
  };

  const exportCsv = (filename, columns, rows) => {
    downloadCsv({ filename, columns, rows });
  };

  const internal = center?.internal || {};
  const ga4 = center?.ga4 || {};
  const internalSummary = internal.analytics?.summary || {};
  const internalBehavior = internal.analytics?.behavior || {};
  const internalAcquisition = internal.analytics?.acquisition || {};
  const internalTechnology = internal.analytics?.technology || {};
  const internalCommerce = internal.analytics?.commerce || {};
  const internalFunnel = internal.analytics?.funnel || {};
  const internalOverview = internal.overview || {};
  const ga4Summary = ga4.overview?.summary || {};
  const ga4Trend = ga4.overview?.trend || [];
  const selectedMetric = TREND_METRICS.find((metric) => metric.key === selectedTrendMetric) || TREND_METRICS[0];
  const hasGa4 = Boolean(ga4.enabled);

  const financeSnapshot = [
    { label: 'Gross payments', value: formatCurrency(finance?.grossPaid) },
    { label: 'Net cash after fees', value: formatCurrency(finance?.netCashAfterFees) },
    { label: 'Creator liability', value: formatCurrency(finance?.eligibleInstructorLiability) },
    { label: 'Platform cash after payouts', value: formatCurrency(finance?.platformCashAfterPayouts) },
  ];

  const exportRows = useMemo(() => ({
    ga4Trend,
    ga4Channels: ga4.acquisition?.channels || [],
    ga4SourceMediums: ga4.acquisition?.sourceMediums || [],
    ga4Campaigns: ga4.acquisition?.campaigns || [],
    ga4Countries: ga4.acquisition?.countries || [],
    ga4TopPages: ga4.engagement?.topPages || [],
    ga4Events: ga4.engagement?.events || [],
    ga4Products: ga4.commerce?.products || [],
    ga4Currencies: ga4.commerce?.currencies || [],
    ga4Retention: ga4.retention?.rows || [],
    ga4Audiences: ga4.audiences?.audiences || [],
    ga4AudienceTrend: ga4.audiences?.trend || [],
    internalTopPages: internalBehavior.topPages || [],
    internalFlows: internalBehavior.navigationFlows || [],
    internalCtas: internalBehavior.ctaPerformance || [],
    internalCheckoutMethods: internalCommerce.checkoutMethods || [],
  }), [ga4, internalBehavior, internalCommerce, ga4Trend]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل مركز التحليلات...' : 'Loading analytics center...'} />
      </div>
    );
  }

  const renderExecutiveTab = () => (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="GA4 Active Users"
          value={formatInteger(ga4Summary.activeUsers)}
          sublabel={`${formatInteger(ga4Summary.sessions)} sessions in the selected window`}
          icon="🌐"
          tone="soft"
        />
        <KpiCard
          label="GA4 Engagement"
          value={formatPercent(ga4Summary.engagementRate)}
          sublabel={`${formatSeconds(ga4Summary.averageSessionDuration)} avg session duration`}
          icon="⏱️"
        />
        <KpiCard
          label="Internal Leads"
          value={formatInteger(internalSummary.leads)}
          sublabel={`${formatInteger(internalOverview.newMembers30d)} member registrations in 30 days`}
          icon="🎯"
        />
        <KpiCard
          label="Revenue"
          value={formatCurrency(ga4Summary.totalRevenue || internalSummary.revenue)}
          sublabel={`${formatCurrency(ga4Summary.refundAmount || internalSummary.refunds)} refunds tracked`}
          icon="💳"
          tone="dark"
        />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.35fr_0.65fr]">
        <Card
          title="GA4 Executive Trend"
          subtitle={`Selected Google Analytics metric over the last ${ga4.range?.days || days} days`}
          actions={TREND_METRICS.map((metric) => (
            <ActionButton key={metric.key} onClick={() => setSelectedTrendMetric(metric.key)} primary={metric.key === selectedTrendMetric}>
              {metric.label}
            </ActionButton>
          ))}
          accent="gradient"
        >
          <TrendChart
            data={ga4Trend}
            metric={selectedMetric}
            emptyLabel="GA4 trend data will appear here when the property is connected and traffic is available."
          />
        </Card>

        <Card title="Finance Snapshot" subtitle="Platform cash and payout position">
          <div className="space-y-3">
            {financeSnapshot.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                <span className="text-sm text-gray-600">{item.label}</span>
                <span className="text-sm font-semibold text-gray-900">{item.value}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Card title="Platform Funnel" subtitle="Internal tracked subscription/payment funnel">
          <div className="space-y-4">
            {(internalFunnel.steps || []).map((step, index) => {
              const previousCount = index === 0 ? step.count : (internalFunnel.steps?.[index - 1]?.count || 0);
              const relativeRate = previousCount > 0 ? (step.count / previousCount) * 100 : 100;
              return (
                <div key={step.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700">{step.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatInteger(step.count)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white">
                    <div className="h-3 rounded-full bg-gradient-to-r from-primary-500 to-cyan-400" style={{ width: `${Math.max(8, step.conversionRate)}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                    <span>{formatPercent(step.conversionRate)} of total</span>
                    <span>{formatPercent(relativeRate)} from previous</span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <Card title="GA4 Purchase Journey" subtitle="Google Analytics commerce path">
          <div className="space-y-4">
            {(ga4.commerce?.purchaseJourney || []).map((step, index) => {
              const maxCount = Math.max(...(ga4.commerce?.purchaseJourney || []).map((item) => Number(item.count || 0)), 1);
              const percentage = maxCount > 0 ? (Number(step.count || 0) / maxCount) * 100 : 0;
              return (
                <div key={step.key} className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-gray-700">{step.label}</span>
                    <span className="text-sm font-semibold text-gray-900">{formatInteger(step.count)}</span>
                  </div>
                  <div className="h-3 rounded-full bg-white">
                    <div className="h-3 rounded-full bg-gradient-to-r from-cyan-500 to-primary-500" style={{ width: `${Math.max(8, percentage)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );

  const renderAcquisitionTab = () => (
    <div className="space-y-8">
      <div className="grid gap-8 xl:grid-cols-3">
        <Card
          title="GA4 Channel Groups"
          subtitle="Primary session acquisition channels"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `ga4-channel-groups-${formatCsvDate(new Date())}`,
              [
                { key: 'label', label: 'Channel Group' },
                { key: 'sessions', label: 'Sessions' },
                { key: 'activeUsers', label: 'Active Users' },
                { key: 'newUsers', label: 'New Users' },
                { key: 'engagementRate', label: 'Engagement Rate (%)' },
                { key: 'totalRevenue', label: 'Total Revenue' },
              ],
              exportRows.ga4Channels
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <BarsList rows={ga4.acquisition?.channels || []} valueKey="sessions" emptyLabel="GA4 channel data will appear here." />
        </Card>

        <Card title="Internal Referrers" subtitle="Referrer hosts from internal tracking">
          <BarsList rows={internalAcquisition.referrers || []} emptyLabel="Internal referrer data will appear here." />
        </Card>

        <Card title="Internal Sources" subtitle="UTM sources from internal tracking">
          <BarsList rows={internalAcquisition.sources || []} emptyLabel="Internal source data will appear here." />
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Card
          title="GA4 Source / Medium"
          subtitle="Top source-medium combinations"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `ga4-source-medium-${formatCsvDate(new Date())}`,
              [
                { key: 'label', label: 'Source / Medium' },
                { key: 'sessions', label: 'Sessions' },
                { key: 'activeUsers', label: 'Active Users' },
                { key: 'engagementRate', label: 'Engagement Rate (%)' },
                { key: 'totalRevenue', label: 'Total Revenue' },
              ],
              exportRows.ga4SourceMediums
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <DataTable
            emptyLabel="GA4 source-medium data will appear here."
            columns={[
              { key: 'label', label: 'Source / Medium' },
              { key: 'sessions', label: 'Sessions', render: (value) => formatInteger(value) },
              { key: 'activeUsers', label: 'Active Users', render: (value) => formatInteger(value) },
              { key: 'engagementRate', label: 'Engagement', render: (value) => formatPercent(value) },
              { key: 'totalRevenue', label: 'Revenue', render: (value) => formatCurrency(value) },
            ]}
            rows={ga4.acquisition?.sourceMediums || []}
          />
        </Card>

        <Card
          title="GA4 Countries"
          subtitle="Top traffic and revenue geographies"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `ga4-countries-${formatCsvDate(new Date())}`,
              [
                { key: 'label', label: 'Country' },
                { key: 'activeUsers', label: 'Active Users' },
                { key: 'sessions', label: 'Sessions' },
                { key: 'totalRevenue', label: 'Total Revenue' },
              ],
              exportRows.ga4Countries
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <BarsList rows={ga4.acquisition?.countries || []} valueKey="activeUsers" emptyLabel="Country performance data will appear here." />
        </Card>
      </div>

      <Card
        title="GA4 Campaigns"
        subtitle="Campaign contribution by sessions and revenue"
        actions={(
          <ActionButton onClick={() => exportCsv(
            `ga4-campaigns-${formatCsvDate(new Date())}`,
            [
              { key: 'label', label: 'Campaign' },
              { key: 'sessions', label: 'Sessions' },
              { key: 'activeUsers', label: 'Active Users' },
              { key: 'totalRevenue', label: 'Total Revenue' },
            ],
            exportRows.ga4Campaigns
          )}>
            Export CSV
          </ActionButton>
        )}
      >
        <DataTable
          emptyLabel="Campaign data will appear here."
          columns={[
            { key: 'label', label: 'Campaign' },
            { key: 'sessions', label: 'Sessions', render: (value) => formatInteger(value) },
            { key: 'activeUsers', label: 'Active Users', render: (value) => formatInteger(value) },
            { key: 'totalRevenue', label: 'Revenue', render: (value) => formatCurrency(value) },
          ]}
          rows={ga4.acquisition?.campaigns || []}
        />
      </Card>
    </div>
  );

  const renderEngagementTab = () => (
    <div className="space-y-8">
      <div className="grid gap-8 xl:grid-cols-[1.25fr_0.75fr]">
        <Card
          title="GA4 Top Pages"
          subtitle="Official page engagement from Google Analytics"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `ga4-top-pages-${formatCsvDate(new Date())}`,
              [
                { key: 'path', label: 'Path' },
                { key: 'title', label: 'Title' },
                { key: 'screenPageViews', label: 'Views' },
                { key: 'activeUsers', label: 'Active Users' },
                { key: 'engagementRate', label: 'Engagement Rate (%)' },
                { key: 'averageSessionDuration', label: 'Average Session Duration (sec)' },
                { key: 'eventCount', label: 'Event Count' },
              ],
              exportRows.ga4TopPages
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <DataTable
            emptyLabel="GA4 page performance will appear here."
            columns={[
              {
                key: 'path',
                label: 'Page',
                render: (_, row) => (
                  <div>
                    <p className="font-semibold text-gray-900">{row.title}</p>
                    <p className="mt-1 text-xs text-gray-400">{row.path}</p>
                  </div>
                ),
              },
              { key: 'screenPageViews', label: 'Views', render: (value) => formatInteger(value) },
              { key: 'activeUsers', label: 'Users', render: (value) => formatInteger(value) },
              { key: 'engagementRate', label: 'Engagement', render: (value) => formatPercent(value) },
              { key: 'averageSessionDuration', label: 'Avg Time', render: (value) => formatSeconds(value) },
            ]}
            rows={ga4.engagement?.topPages || []}
          />
        </Card>

        <Card title="Hourly Activity" subtitle="GA4 active users and event load by hour">
          <BarsList rows={(ga4.engagement?.hourly || []).map((row) => ({ ...row, label: row.hour, count: row.activeUsers }))} emptyLabel="Hourly GA4 activity will appear here." />
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Card
          title="GA4 Events"
          subtitle="Most frequent event names"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `ga4-events-${formatCsvDate(new Date())}`,
              [
                { key: 'label', label: 'Event Name' },
                { key: 'eventCount', label: 'Event Count' },
                { key: 'totalUsers', label: 'Total Users' },
              ],
              exportRows.ga4Events
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <DataTable
            emptyLabel="GA4 events will appear here."
            columns={[
              { key: 'label', label: 'Event' },
              { key: 'eventCount', label: 'Count', render: (value) => formatInteger(value) },
              { key: 'totalUsers', label: 'Users', render: (value) => formatInteger(value) },
            ]}
            rows={ga4.engagement?.events || []}
          />
        </Card>

        <Card title="Landing Pages" subtitle="Sessions and engagement by landing page">
          <BarsList rows={(ga4.engagement?.landingPages || []).map((row) => ({ ...row, count: row.sessions }))} emptyLabel="Landing page performance will appear here." />
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Card
          title="Internal Navigation Flows"
          subtitle="Top page-to-page flows from internal event tracking"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `internal-navigation-flows-${formatCsvDate(new Date())}`,
              [
                { key: 'from', label: 'From' },
                { key: 'to', label: 'To' },
                { key: 'count', label: 'Count' },
              ],
              exportRows.internalFlows
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <DataTable
            emptyLabel="Internal navigation flow data will appear here."
            columns={[
              { key: 'from', label: 'From' },
              { key: 'to', label: 'To' },
              { key: 'count', label: 'Count', render: (value) => formatInteger(value) },
            ]}
            rows={internalBehavior.navigationFlows || []}
          />
        </Card>

        <Card
          title="CTA Performance"
          subtitle="Buttons and key navigation actions clicked most"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `internal-cta-performance-${formatCsvDate(new Date())}`,
              [
                { key: 'label', label: 'Label' },
                { key: 'path', label: 'Path' },
                { key: 'count', label: 'Clicks' },
              ],
              exportRows.internalCtas
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <DataTable
            emptyLabel="CTA click data will appear here."
            columns={[
              { key: 'label', label: 'Label' },
              { key: 'path', label: 'Page' },
              { key: 'count', label: 'Clicks', render: (value) => formatInteger(value) },
            ]}
            rows={internalBehavior.ctaPerformance || []}
          />
        </Card>
      </div>
    </div>
  );

  const renderCommerceTab = () => (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="GA4 Checkouts" value={formatInteger(ga4.commerce?.summary?.checkouts)} sublabel="Begin-checkout events measured in GA4" icon="🛒" tone="soft" />
        <KpiCard label="GA4 Transactions" value={formatInteger(ga4.commerce?.summary?.transactions)} sublabel={`${formatInteger(ga4.commerce?.summary?.totalPurchasers)} purchasers`} icon="🧾" />
        <KpiCard label="Purchase Revenue" value={formatCurrency(ga4.commerce?.summary?.purchaseRevenue)} sublabel={`${formatCurrency(ga4.commerce?.summary?.refundAmount)} refunded`} icon="💵" />
        <KpiCard label="Internal Revenue" value={formatCurrency(internalSummary.revenue)} sublabel={`${formatInteger(internalSummary.purchases)} captured payments`} icon="🏦" tone="dark" />
      </div>

      <div className="grid gap-8 xl:grid-cols-3">
        <Card
          title="Checkout Methods"
          subtitle="Internal revenue by checkout method"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `internal-checkout-methods-${formatCsvDate(new Date())}`,
              [
                { key: 'label', label: 'Method' },
                { key: 'amount', label: 'Amount' },
              ],
              exportRows.internalCheckoutMethods
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <BarsList
            rows={internalCommerce.checkoutMethods || []}
            valueKey="amount"
            valueFormatter={(value) => formatCurrency(value)}
            emptyLabel="Internal checkout method data will appear here."
          />
        </Card>

        <Card
          title="GA4 Products"
          subtitle="Items and packages earning revenue"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `ga4-products-${formatCsvDate(new Date())}`,
              [
                { key: 'label', label: 'Item Name' },
                { key: 'itemsPurchased', label: 'Items Purchased' },
                { key: 'itemRevenue', label: 'Item Revenue' },
              ],
              exportRows.ga4Products
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <DataTable
            emptyLabel="GA4 item-level revenue will appear here."
            columns={[
              { key: 'label', label: 'Item' },
              { key: 'itemsPurchased', label: 'Purchased', render: (value) => formatInteger(value) },
              { key: 'itemRevenue', label: 'Revenue', render: (value) => formatCurrency(value) },
            ]}
            rows={ga4.commerce?.products || []}
          />
        </Card>

        <Card
          title="Currencies"
          subtitle="Revenue split by currency in GA4"
          actions={(
            <ActionButton onClick={() => exportCsv(
              `ga4-currencies-${formatCsvDate(new Date())}`,
              [
                { key: 'label', label: 'Currency' },
                { key: 'transactions', label: 'Transactions' },
                { key: 'totalRevenue', label: 'Revenue' },
              ],
              exportRows.ga4Currencies
            )}>
              Export CSV
            </ActionButton>
          )}
        >
          <BarsList rows={(ga4.commerce?.currencies || []).map((row) => ({ ...row, count: row.totalRevenue }))} emptyLabel="Currency data will appear here." valueFormatter={(value) => formatCurrency(value, '')} />
        </Card>
      </div>
    </div>
  );

  const renderRetentionTab = () => (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Cohort Size" value={formatInteger(ga4.retention?.summary?.cohortSize)} sublabel={ga4.retention?.summary?.cohortName || 'Most recent completed acquisition cohort'} icon="👥" tone="soft" />
        <KpiCard label="Latest Retention" value={formatPercent(ga4.retention?.summary?.latestRetentionRate)} sublabel="Latest weekly retention rate from GA4 cohort analysis" icon="📈" />
        <KpiCard label="Internal Members" value={formatInteger(internalOverview.totalMembers)} sublabel={`${formatInteger(internalOverview.activeSubscriptions)} active subscriptions`} icon="🧠" />
        <KpiCard label="Member Completion" value={formatInteger(internalOverview.completedCourses)} sublabel={`${formatInteger(internalOverview.totalEnrollments)} enrollments tracked`} icon="✅" tone="dark" />
      </div>

      <Card title="GA4 Retention Cohorts" subtitle="Weekly retention view for an acquired-user cohort" accent="gradient">
        <RetentionGrid rows={ga4.retention?.rows || []} />
      </Card>

      <Card
        title="Retention Export"
        subtitle="Raw cohort rows for analysis in spreadsheets"
        actions={(
          <ActionButton onClick={() => exportCsv(
            `ga4-retention-${formatCsvDate(new Date())}`,
            [
              { key: 'cohort', label: 'Cohort' },
              { key: 'week', label: 'Week' },
              { key: 'cohortActiveUsers', label: 'Cohort Active Users' },
              { key: 'cohortTotalUsers', label: 'Cohort Total Users' },
              { key: 'retentionRate', label: 'Retention Rate (%)' },
            ],
            exportRows.ga4Retention
          )}>
            Export CSV
          </ActionButton>
        )}
      >
        <DataTable
          emptyLabel="Retention rows will appear here."
          columns={[
            { key: 'cohort', label: 'Cohort' },
            { key: 'week', label: 'Week' },
            { key: 'cohortActiveUsers', label: 'Active Users', render: (value) => formatInteger(value) },
            { key: 'cohortTotalUsers', label: 'Total Users', render: (value) => formatInteger(value) },
            { key: 'retentionRate', label: 'Retention', render: (value) => formatPercent(value) },
          ]}
          rows={ga4.retention?.rows || []}
        />
      </Card>
    </div>
  );

  const renderAudiencesTab = () => (
    <div className="space-y-8">
      <Card
        title="GA4 Audiences"
        subtitle="Audience-level performance from Google Analytics"
        actions={(
          <ActionButton onClick={() => exportCsv(
            `ga4-audiences-${formatCsvDate(new Date())}`,
            [
              { key: 'label', label: 'Audience' },
              { key: 'activeUsers', label: 'Active Users' },
              { key: 'newUsers', label: 'New Users' },
              { key: 'sessions', label: 'Sessions' },
              { key: 'screenPageViewsPerSession', label: 'Views Per Session' },
              { key: 'averageSessionDuration', label: 'Average Session Duration (sec)' },
              { key: 'totalRevenue', label: 'Revenue' },
            ],
            exportRows.ga4Audiences
          )}>
            Export CSV
          </ActionButton>
        )}
      >
        <DataTable
          emptyLabel="Audience summaries will appear here once GA4 audiences exist on the property."
          columns={[
            { key: 'label', label: 'Audience' },
            { key: 'activeUsers', label: 'Active Users', render: (value) => formatInteger(value) },
            { key: 'newUsers', label: 'New Users', render: (value) => formatInteger(value) },
            { key: 'sessions', label: 'Sessions', render: (value) => formatInteger(value) },
            { key: 'screenPageViewsPerSession', label: 'Views / Session', render: (value) => Number(value || 0).toFixed(2) },
            { key: 'averageSessionDuration', label: 'Avg Duration', render: (value) => formatSeconds(value) },
            { key: 'totalRevenue', label: 'Revenue', render: (value) => formatCurrency(value) },
          ]}
          rows={ga4.audiences?.audiences || []}
        />
      </Card>

      <Card
        title="Audience Trend Export"
        subtitle="Daily active users by audience"
        actions={(
          <ActionButton onClick={() => exportCsv(
            `ga4-audience-trend-${formatCsvDate(new Date())}`,
            [
              { key: 'date', label: 'Date' },
              { key: 'audienceName', label: 'Audience Name' },
              { key: 'activeUsers', label: 'Active Users' },
            ],
            exportRows.ga4AudienceTrend
          )}>
            Export CSV
          </ActionButton>
        )}
      >
        <DataTable
          emptyLabel="Audience trend rows will appear here once GA4 audience reporting is available."
          columns={[
            { key: 'date', label: 'Date' },
            { key: 'audienceName', label: 'Audience' },
            { key: 'activeUsers', label: 'Active Users', render: (value) => formatInteger(value) },
          ]}
          rows={ga4.audiences?.trend || []}
        />
      </Card>
    </div>
  );

  const renderRealtimeTab = () => (
    <div className="space-y-8">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Active Users Right Now" value={formatInteger(ga4.realtime?.activeUsers)} sublabel="Live user count reported by GA4 Realtime" icon="🟢" tone="dark" />
        <KpiCard label="Internal Active Members" value={formatInteger(internalOverview.activeStudentsNow)} sublabel={`${formatInteger(internalOverview.activeLessonsNow)} active lessons in the last 2 minutes`} icon="📡" tone="soft" />
        <KpiCard label="Member Engagement" value={formatPercent(internalSummary.engagementRate)} sublabel={`${formatPercent(internalSummary.averageScrollDepth)} average scroll depth`} icon="🧭" />
        <KpiCard label="Views in Window" value={formatInteger(ga4Summary.screenPageViews)} sublabel={`${ga4.range?.days || days}-day GA4 measurement window`} icon="👁️" />
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="Realtime Activity by Minute" subtitle="Last 30 minutes from GA4 Realtime" accent="gradient">
          <RealtimeBars rows={(ga4.realtime?.byMinute || []).map((row) => ({ label: row.label.replace(' ago', ''), activeUsers: row.activeUsers }))} />
        </Card>

        <Card title="Realtime Pages" subtitle="Pages/screens with current live activity">
          <BarsList rows={(ga4.realtime?.pages || []).map((row) => ({ label: row.label, count: row.screenPageViews }))} emptyLabel="Realtime page activity will appear here." />
        </Card>
      </div>

      <div className="grid gap-8 xl:grid-cols-2">
        <Card title="Realtime Countries" subtitle="Live users by country">
          <BarsList rows={(ga4.realtime?.countries || []).map((row) => ({ label: row.label, count: row.activeUsers }))} emptyLabel="Realtime country activity will appear here." />
        </Card>

        <Card title="Realtime Devices" subtitle="Live users by device">
          <BarsList rows={(ga4.realtime?.devices || []).map((row) => ({ label: row.label, count: row.activeUsers }))} emptyLabel="Realtime device activity will appear here." />
        </Card>
      </div>
    </div>
  );

  const renderEmbeddedTab = () => (
    <div className="space-y-8">
      {!ga4.embed?.available ? (
        <StatusBanner title="Embedded analytics workspace is not configured" tone="warning">
          Add `LOOKER_STUDIO_EMBED_URL` in production to show a full embedded reporting workspace here. This is the best path when you want a richer GA-style analysis surface inside the dashboard without rebuilding every report manually.
        </StatusBanner>
      ) : null}

      <Card title="Embedded Reporting Workspace" subtitle="Optional embedded Looker Studio analytics view" accent="gradient">
        {ga4.embed?.available ? (
          <div className="overflow-hidden rounded-3xl border border-gray-200">
            <iframe
              title="Embedded Analytics Workspace"
              src={ga4.embed.url}
              className="h-[900px] w-full bg-white"
            />
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-16 text-center text-sm text-gray-500">
            No embedded report is configured yet.
          </div>
        )}
      </Card>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm">
        <div className="grid gap-8 px-6 py-6 sm:px-8 lg:grid-cols-[1.15fr_0.85fr] lg:px-10 lg:py-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary-100 bg-primary-50 px-4 py-2 text-xs font-medium uppercase tracking-[0.25em] text-primary-700">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              Analytics & Measurements
            </div>
            <h1 className="mt-5 text-4xl font-bold text-gray-900">
              {isRTL ? 'مركز التحليلات والقياسات' : 'Analytics & Measurements Center'}
            </h1>
            <p className="mt-4 max-w-3xl text-lg leading-8 text-gray-500">
              {isRTL
                ? 'لوحة موحدة تجمع تتبع المنصة الداخلي مع تقارير Google Analytics 4، بما في ذلك الاكتساب، التفاعل، التجارة، الاحتفاظ، الجماهير، والتحليلات اللحظية.'
                : 'A single admin workspace combining Aiqda’s internal event tracking with Google Analytics 4 reports for acquisition, engagement, commerce, retention, audiences, and realtime activity.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              {DAY_OPTIONS.map((option) => (
                <TabButton key={option} active={days === option} onClick={() => setDays(option)}>
                  Last {option} Days
                </TabButton>
              ))}
            </div>
            <p className="mt-4 text-xs text-gray-400">
              Generated {center?.generatedAt ? new Date(center.generatedAt).toLocaleString() : 'just now'}
              {hasGa4 ? ` • GA4 property ${ga4.propertyId}` : ' • GA4 reports pending secure connection'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-gradient-to-br from-gray-900 via-primary-700 to-cyan-500 p-5 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Internal Tracking</p>
              <p className="mt-4 text-4xl font-bold">{formatInteger(internalSummary.sessions)}</p>
              <p className="mt-2 text-sm text-white/80">Sessions captured inside Aiqda’s own event pipeline</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">GA4 Measurement</p>
              <p className="mt-4 text-4xl font-bold text-gray-900">{formatInteger(ga4Summary.activeUsers)}</p>
              <p className="mt-2 text-sm text-gray-500">Active users reported by the connected Google Analytics property</p>
            </div>
            <div className="rounded-3xl border border-primary-100 bg-primary-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-500">Conversion Signals</p>
              <p className="mt-4 text-3xl font-bold text-gray-900">{formatInteger(internalSummary.leads)}</p>
              <p className="mt-2 text-sm text-gray-600">Internal lead events across contact, creator, studio, and consultations</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Commerce Pulse</p>
              <p className="mt-4 text-3xl font-bold text-gray-900">{formatCurrency(ga4Summary.totalRevenue || internalSummary.revenue)}</p>
              <p className="mt-2 text-sm text-gray-500">Revenue measured across the selected reporting range</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {TABS.map((tab) => (
          <TabButton key={tab.key} active={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>
            {tab.label}
          </TabButton>
        ))}
        <ActionButton onClick={() => void fetchData()} primary>
          Refresh Data
        </ActionButton>
      </div>

      {activeTab === 'executive' ? renderExecutiveTab() : null}
      {activeTab === 'acquisition' ? renderAcquisitionTab() : null}
      {activeTab === 'engagement' ? renderEngagementTab() : null}
      {activeTab === 'commerce' ? renderCommerceTab() : null}
      {activeTab === 'retention' ? renderRetentionTab() : null}
      {activeTab === 'audiences' ? renderAudiencesTab() : null}
      {activeTab === 'realtime' ? renderRealtimeTab() : null}
      {activeTab === 'embedded' ? renderEmbeddedTab() : null}
    </div>
  );
}

export default AdminAnalyticsMeasurements;
