import { useEffect, useMemo, useState } from 'react';
import { geoEqualEarth, geoGraticule10, geoPath } from 'd3-geo';
import { feature as topojsonFeature } from 'topojson-client';
import worldCountries from 'world-atlas/countries-50m.json';
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
];
const VISUAL_DEMO_GA4 = {
  acquisition: {
    channels: [
      { label: 'Organic Search', sessions: 2480, activeUsers: 1910, newUsers: 1480, engagementRate: 62.4, totalRevenue: 18420 },
      { label: 'Paid Social', sessions: 1940, activeUsers: 1508, newUsers: 1322, engagementRate: 54.8, totalRevenue: 12990 },
      { label: 'Direct', sessions: 1710, activeUsers: 1245, newUsers: 640, engagementRate: 68.1, totalRevenue: 16770 },
      { label: 'Referral', sessions: 920, activeUsers: 702, newUsers: 314, engagementRate: 49.9, totalRevenue: 6440 },
      { label: 'Email', sessions: 610, activeUsers: 488, newUsers: 126, engagementRate: 73.2, totalRevenue: 5980 },
    ],
    countries: [
      { label: 'Saudi Arabia', activeUsers: 1680, sessions: 2140, totalRevenue: 19870 },
      { label: 'Egypt', activeUsers: 1140, sessions: 1530, totalRevenue: 12240 },
      { label: 'United Arab Emirates', activeUsers: 760, sessions: 940, totalRevenue: 10180 },
      { label: 'United States', activeUsers: 520, sessions: 710, totalRevenue: 5820 },
      { label: 'United Kingdom', activeUsers: 350, sessions: 440, totalRevenue: 3610 },
      { label: 'India', activeUsers: 300, sessions: 415, totalRevenue: 2980 },
    ],
  },
  audiences: {
    audiences: [
      { label: 'High-Intent Subscribers', activeUsers: 860, newUsers: 214, sessions: 1420, screenPageViewsPerSession: 5.2, averageSessionDuration: 384, totalRevenue: 15480 },
      { label: 'Creative Explorers', activeUsers: 690, newUsers: 308, sessions: 1180, screenPageViewsPerSession: 4.6, averageSessionDuration: 326, totalRevenue: 9320 },
      { label: 'Returning Professionals', activeUsers: 480, newUsers: 96, sessions: 910, screenPageViewsPerSession: 6.1, averageSessionDuration: 417, totalRevenue: 11890 },
      { label: 'Consultation Prospects', activeUsers: 310, newUsers: 122, sessions: 540, screenPageViewsPerSession: 3.8, averageSessionDuration: 251, totalRevenue: 2440 },
      { label: 'Arabic Mobile Learners', activeUsers: 260, newUsers: 118, sessions: 470, screenPageViewsPerSession: 4.2, averageSessionDuration: 273, totalRevenue: 1880 },
    ],
  },
  realtime: {
    byMinute: [
      { label: '29m', activeUsers: 8 },
      { label: '24m', activeUsers: 12 },
      { label: '19m', activeUsers: 16 },
      { label: '14m', activeUsers: 19 },
      { label: '9m', activeUsers: 22 },
      { label: '4m', activeUsers: 27 },
      { label: 'Now', activeUsers: 24 },
    ],
    countries: [
      { label: 'Saudi Arabia', activeUsers: 12 },
      { label: 'Egypt', activeUsers: 7 },
      { label: 'United Arab Emirates', activeUsers: 4 },
      { label: 'United States', activeUsers: 3 },
      { label: 'United Kingdom', activeUsers: 2 },
    ],
  },
};
const COUNTRY_GEO_ALIASES = {
  saudi: 'Saudi Arabia',
  'saudi arabia': 'Saudi Arabia',
  ksa: 'Saudi Arabia',
  egypt: 'Egypt',
  'united arab emirates': 'United Arab Emirates',
  uae: 'United Arab Emirates',
  qatar: 'Qatar',
  kuwait: 'Kuwait',
  bahrain: 'Bahrain',
  oman: 'Oman',
  jordan: 'Jordan',
  lebanon: 'Lebanon',
  iraq: 'Iraq',
  turkey: 'Turkey',
  india: 'India',
  pakistan: 'Pakistan',
  bangladesh: 'Bangladesh',
  'united states': 'United States',
  usa: 'United States',
  canada: 'Canada',
  mexico: 'Mexico',
  brazil: 'Brazil',
  argentina: 'Argentina',
  chile: 'Chile',
  'united kingdom': 'United Kingdom',
  uk: 'United Kingdom',
  ireland: 'Ireland',
  france: 'France',
  germany: 'Germany',
  spain: 'Spain',
  italy: 'Italy',
  netherlands: 'Netherlands',
  belgium: 'Belgium',
  sweden: 'Sweden',
  norway: 'Norway',
  poland: 'Poland',
  russia: 'Russia',
  nigeria: 'Nigeria',
  kenya: 'Kenya',
  'south africa': 'South Africa',
  australia: 'Australia',
  indonesia: 'Indonesia',
  malaysia: 'Malaysia',
  singapore: 'Singapore',
  japan: 'Japan',
  china: 'China',
  'south korea': 'South Korea',
};

const WORLD_MAP_WIDTH = 1000;
const WORLD_MAP_HEIGHT = 540;
const WORLD_FEATURE_COLLECTION = topojsonFeature(worldCountries, worldCountries.objects.countries);
const WORLD_PROJECTION = geoEqualEarth().fitSize([WORLD_MAP_WIDTH, WORLD_MAP_HEIGHT], WORLD_FEATURE_COLLECTION);
const WORLD_PATH = geoPath(WORLD_PROJECTION);
const WORLD_GRATICULE_PATH = WORLD_PATH(geoGraticule10());
const WORLD_COUNTRY_FEATURES = (WORLD_FEATURE_COLLECTION.features || [])
  .map((geoFeature) => ({
    id: geoFeature.id || geoFeature.properties?.name,
    name: geoFeature.properties?.name || '',
    path: WORLD_PATH(geoFeature),
  }))
  .filter((entry) => entry.name && entry.path);
const MAP_FEATURE_ROW_ALIASES = {
  'United States of America': 'United States',
  Czechia: 'Czech Republic',
  'Dem. Rep. Congo': 'Democratic Republic of the Congo',
  Congo: 'Republic of the Congo',
  Korea: 'South Korea',
  'S. Korea': 'South Korea',
  'W. Sahara': 'Western Sahara',
};

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
const normalizeCountryKey = (value) => String(value || '').trim().toLowerCase();
const toGeoCountryName = (value) => COUNTRY_GEO_ALIASES[normalizeCountryKey(value)] || String(value || '').trim();
const resolveMapFeatureRow = (rowByCountry, featureName) => (
  rowByCountry[normalizeCountryKey(featureName)]
  || rowByCountry[normalizeCountryKey(MAP_FEATURE_ROW_ALIASES[featureName])]
  || null
);
const toChartPercent = (value, maxValue) => {
  if (!maxValue) {
    return 0;
  }

  return Math.max(8, (Number(value || 0) / maxValue) * 100);
};
const useVisualRows = (rows, fallback, enabled) => (
  Array.isArray(rows) && rows.length > 0 ? rows : enabled ? fallback : []
);

const hasRows = (rows) => Array.isArray(rows) && rows.length > 0;

const firstMetricValue = (...values) => {
  for (const value of values) {
    const numberValue = Number(value);
    if (Number.isFinite(numberValue) && numberValue > 0) {
      return numberValue;
    }
  }

  return 0;
};

const toInternalTrendRows = (rows = []) => rows.map((row) => ({
  ...row,
  activeUsers: Number(row.activeUsers ?? row.uniqueVisitors ?? row.sessions ?? 0),
  screenPageViews: Number(row.screenPageViews ?? row.pageViews ?? 0),
  totalRevenue: Number(row.totalRevenue ?? row.revenue ?? 0),
}));

const toInternalChannelRows = (rows = []) => rows.map((row) => ({
  label: row.label || 'Unassigned',
  sessions: Number(row.sessions ?? row.count ?? 0),
  activeUsers: Number(row.activeUsers ?? row.uniqueVisitors ?? row.count ?? 0),
  newUsers: Number(row.newUsers ?? 0),
  engagementRate: Number(row.engagementRate ?? 0),
  totalRevenue: Number(row.totalRevenue ?? row.revenue ?? 0),
}));

const toInternalCountryRows = (rows = []) => rows.map((row) => ({
  label: row.label || row.countryName || 'Unknown',
  countryCode: row.countryCode || '',
  sessions: Number(row.sessions ?? row.count ?? 0),
  activeUsers: Number(row.activeUsers ?? row.uniqueVisitors ?? row.visitors ?? row.count ?? 0),
  totalRevenue: Number(row.totalRevenue ?? row.revenue ?? 0),
}));

const toInternalTopPageRows = (rows = []) => rows.map((row) => ({
  path: row.path || '/',
  title: row.title || row.path || 'Untitled page',
  screenPageViews: Number(row.screenPageViews ?? row.pageViews ?? 0),
  activeUsers: Number(row.activeUsers ?? row.uniqueVisitors ?? 0),
  engagementRate: Number(row.engagementRate ?? 0),
  averageSessionDuration: Number(row.averageSessionDuration ?? row.avgEngagementTimeSeconds ?? 0),
  eventCount: Number(row.eventCount ?? row.ctaClicks ?? 0),
}));

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
    <section className={`h-full rounded-3xl border p-4 shadow-sm sm:p-5 lg:p-6 ${accentClass}`}>
      <div className="mb-4 flex flex-col gap-3 lg:mb-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-semibold text-gray-900">{title}</h2>
          {subtitle ? <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
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
    <div className={`flex h-full min-h-[164px] flex-col rounded-2xl border p-4 ${tones[tone] || tones.default}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`text-xs uppercase tracking-[0.16em] ${tone === 'dark' ? 'text-white/70' : 'text-gray-400'}`}>{label}</span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-3xl font-bold ${tone === 'dark' ? 'text-white' : 'text-gray-900'}`}>{value}</p>
      {sublabel ? <p className={`mt-2 text-sm leading-6 ${tone === 'dark' ? 'text-white/70' : 'text-gray-500'}`}>{sublabel}</p> : null}
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
      <div className="mt-2 text-sm leading-6">{children}</div>
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
                <td key={column.key} className="break-words px-3 py-4 text-sm leading-6 text-gray-700 first:pl-0 last:pr-0">
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
    <div className="space-y-3">
      {rows.map((row) => {
        const rawValue = Number(row?.[valueKey] || 0);
        const width = `${Math.max(8, (rawValue / maxValue) * 100)}%`;
        return (
          <div key={`${row?.[labelKey]}-${rawValue}`} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
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

function ChannelMixIllustration({ rows = [] }) {
  const topRows = rows.slice(0, 5);
  const totalSessions = topRows.reduce((sum, row) => sum + Number(row.sessions || 0), 0) || 1;
  const palette = ['#ec4899', '#8b5cf6', '#06b6d4', '#14b8a6', '#f59e0b'];
  let cumulative = 0;

  const segments = topRows.map((row, index) => {
    const portion = Number(row.sessions || 0) / totalSessions;
    const start = cumulative;
    cumulative += portion;
    const dashLength = portion * 314;
    const dashOffset = -(start * 314);

    return {
      ...row,
      color: palette[index % palette.length],
      dashLength,
      dashOffset,
      share: portion * 100,
    };
  });

  return (
    <div className="h-full rounded-[2rem] border border-primary-100 bg-gradient-to-br from-slate-950 via-slate-900 to-cyan-950 p-5 text-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-200/80">Acquisition Signature</p>
          <h3 className="mt-3 text-2xl font-semibold">Channel mix illustration</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-slate-300">
            A compact premium view of which traffic streams are shaping current demand.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right backdrop-blur">
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Top Channels</p>
          <p className="mt-2 text-2xl font-bold">{formatInteger(topRows.length)}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="flex items-center justify-center">
          <div className="relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64">
            <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
              <defs>
                <radialGradient id="channelMixGlow" cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor="#ffffff" stopOpacity="0.16" />
                  <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
                </radialGradient>
              </defs>
              <circle cx="70" cy="70" r="58" fill="url(#channelMixGlow)" />
              <circle cx="70" cy="70" r="50" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="12" />
              {segments.map((segment) => (
                <circle
                  key={segment.label}
                  cx="70"
                  cy="70"
                  r="50"
                  fill="none"
                  stroke={segment.color}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${segment.dashLength} 314`}
                  strokeDashoffset={segment.dashOffset}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-xs uppercase tracking-[0.22em] text-slate-300">Tracked Sessions</span>
              <span className="mt-2 text-4xl font-bold">{formatInteger(totalSessions)}</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {segments.length ? segments.map((segment) => (
            <div key={segment.label} className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                  <span className="text-sm font-medium text-white">{segment.label}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-white">{formatInteger(segment.sessions)}</p>
                  <p className="text-xs text-slate-300">{formatPercent(segment.share)}</p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/10">
                <div className="h-2 rounded-full" style={{ width: `${segment.share}%`, backgroundColor: segment.color }} />
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center text-sm text-slate-300">
              Channel illustration will appear once acquisition rows are available.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function GeoAudienceMap({ rows = [], valueKey = 'activeUsers', title = 'Global presence', subtitle = 'Hover a country to inspect traffic concentration.' }) {
  const [hoveredId, setHoveredId] = useState(null);
  const normalizedRows = useMemo(() => rows
    .map((row, index) => ({
      ...row,
      id: `${normalizeCountryKey(row.label) || 'country'}-${index}`,
      geoLabel: toGeoCountryName(row.label),
      value: Number(row?.[valueKey] || 0),
    }))
    .filter((row) => row.value > 0)
    .sort((left, right) => right.value - left.value), [rows, valueKey]);
  const rowByCountry = normalizedRows.reduce((acc, row) => {
    acc[normalizeCountryKey(row.geoLabel)] = row;
    return acc;
  }, {});
  const maxValue = Math.max(...normalizedRows.map((row) => row.value), 1);
  const activeRow = normalizedRows.find((row) => row.id === hoveredId) || normalizedRows[0] || null;
  const setHoverIfChanged = (nextId) => {
    setHoveredId((currentId) => (currentId === nextId ? currentId : nextId));
  };
  const getCountryFill = (row) => {
    if (!row) {
      return '#dbeafe';
    }

    const intensity = row.value / maxValue;
    if (intensity > 0.72) return '#ec4899';
    if (intensity > 0.45) return '#38bdf8';
    if (intensity > 0.22) return '#67e8f9';
    return '#bae6fd';
  };

  return (
    <div className="h-full rounded-2xl border border-cyan-100 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-700/80">Geographic Intelligence</p>
          <h3 className="mt-3 text-2xl font-semibold text-gray-900">{title}</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">{subtitle}</p>
        </div>
        <div className="min-w-[240px] rounded-2xl border border-cyan-100 bg-white/90 p-4 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-gray-400">Focused Country</p>
          {activeRow ? (
            <>
              <p className="mt-3 text-2xl font-bold text-gray-900">{activeRow.label}</p>
              <p className="mt-1 text-sm text-gray-500">{formatInteger(activeRow.value)} measured users</p>
              <div className="mt-4 h-2 rounded-full bg-white/10">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-primary-400 to-cyan-300"
                  style={{ width: `${toChartPercent(activeRow.value, maxValue)}%` }}
                />
              </div>
            </>
          ) : (
            <p className="mt-3 text-sm text-gray-500">Country signals will appear here once traffic data is available.</p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <div className="rounded-2xl border border-gray-100 bg-slate-50 p-3 shadow-sm">
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-slate-50 via-cyan-50/70 to-white">
            {normalizedRows.length ? (
              <>
                <svg
                  viewBox={`0 0 ${WORLD_MAP_WIDTH} ${WORLD_MAP_HEIGHT}`}
                  className="block aspect-[1.85/1] w-full"
                  role="img"
                  aria-label="World map with country activity"
                  onPointerLeave={() => setHoverIfChanged(null)}
                >
                  <rect width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} fill="#f8fafc" />
                  {WORLD_GRATICULE_PATH ? (
                    <path
                      d={WORLD_GRATICULE_PATH}
                      fill="none"
                      stroke="#cbd5e1"
                      strokeOpacity="0.55"
                      strokeWidth="0.8"
                    />
                  ) : null}
                  {WORLD_COUNTRY_FEATURES.map((feature) => {
                    const row = resolveMapFeatureRow(rowByCountry, feature.name);
                    const isActive = activeRow?.id === row?.id;
                    return (
                      <path
                        key={`${feature.id}-${feature.name}`}
                        d={feature.path}
                        fill={getCountryFill(row)}
                        stroke={isActive ? '#111827' : row ? '#0f172a' : '#ffffff'}
                        strokeWidth={isActive ? '1.25' : row ? '0.85' : '0.45'}
                        opacity={row ? 1 : 0.62}
                        className={row ? 'cursor-pointer outline-none transition-colors duration-150' : 'transition-colors duration-150'}
                        onPointerEnter={() => row && setHoverIfChanged(row.id)}
                        onFocus={() => row && setHoverIfChanged(row.id)}
                        onClick={() => row && setHoverIfChanged(row.id)}
                        tabIndex={row ? 0 : undefined}
                        aria-label={row ? `${row.label}: ${formatInteger(row.value)} measured users` : feature.name}
                      >
                        {row ? <title>{`${row.label}: ${formatInteger(row.value)} users`}</title> : null}
                      </path>
                    );
                  })}
                </svg>

                {activeRow ? (
                  <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-gray-200 bg-white/95 px-4 py-3 shadow-lg backdrop-blur">
                    <p className="text-xs uppercase tracking-[0.16em] text-gray-400">Hovered Country</p>
                    <p className="mt-1 text-sm font-semibold text-gray-900">{activeRow.label}</p>
                    <p className="text-xs text-gray-500">{formatInteger(activeRow.value)} measured users</p>
                  </div>
                ) : null}
              </>
            ) : (
              <div className="flex aspect-[1.85/1] items-center justify-center px-6 text-center text-sm text-gray-500">
                Country performance data will appear here once traffic data is available.
              </div>
            )}
          </div>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-gray-400">
            Hover any highlighted country on the world map to inspect its measured volume.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {normalizedRows.slice(0, 6).map((row, index) => (
            <button
              key={row.id}
              type="button"
              onPointerEnter={() => setHoverIfChanged(row.id)}
              onFocus={() => setHoverIfChanged(row.id)}
              className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
                activeRow?.id === row.id
                  ? 'border-cyan-200 bg-cyan-50 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-cyan-100 hover:bg-cyan-50/40'
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">Rank #{index + 1}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-gray-900">{formatInteger(row.value)}</p>
                  <p className="text-xs text-gray-400">Mapped country</p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-gray-100">
                <div
                  className="h-2 rounded-full bg-gradient-to-r from-primary-400 to-cyan-300"
                  style={{ width: `${toChartPercent(row.value, maxValue)}%` }}
                />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function AudienceSpectrum({ rows = [] }) {
  const topRows = rows.slice(0, 5);
  const maxUsers = Math.max(...topRows.map((row) => Number(row.activeUsers || 0)), 1);
  const palette = [
    'from-primary-400/80 to-pink-300/60',
    'from-cyan-400/80 to-sky-300/60',
    'from-emerald-400/80 to-teal-300/60',
    'from-amber-400/80 to-orange-300/60',
    'from-violet-400/80 to-fuchsia-300/60',
  ];

  return (
    <div className="rounded-[2rem] border border-violet-100 bg-gradient-to-br from-[#fff7fb] via-white to-[#ecfeff] p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.22em] text-violet-500">Audience Spectrum</p>
          <h3 className="mt-3 text-2xl font-semibold text-gray-900">Who is responding the most</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Illustrated audience bands highlight the strongest demand pockets and their relative momentum.
          </p>
        </div>
        <div className="rounded-2xl border border-violet-100 bg-white/90 px-4 py-3">
          <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Audience Sets</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{formatInteger(topRows.length)}</p>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {topRows.length ? topRows.map((row, index) => {
          const width = `${Math.max(20, (Number(row.activeUsers || 0) / maxUsers) * 100)}%`;
          return (
            <div key={`${row.label}-${index}`} className="rounded-2xl border border-gray-100 bg-white/80 p-4 backdrop-blur">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{row.label}</p>
                  <p className="mt-1 text-xs text-gray-400">{formatInteger(row.sessions)} sessions · {formatCurrency(row.totalRevenue || 0)}</p>
                </div>
                <p className="text-lg font-bold text-gray-900">{formatInteger(row.activeUsers)}</p>
              </div>
              <div className="h-4 rounded-full bg-gray-100">
                <div className={`h-4 rounded-full bg-gradient-to-r ${palette[index % palette.length]}`} style={{ width }} />
              </div>
            </div>
          );
        }) : (
          <div className="rounded-2xl border border-dashed border-gray-200 bg-white/80 px-4 py-12 text-center text-sm text-gray-500">
            Audience illustrations will appear once GA4 audience rows are available.
          </div>
        )}
      </div>
    </div>
  );
}

function RetentionGrid({ rows }) {
  if (!rows.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-16 text-center text-sm text-gray-500">
        Retention data will appear here after Google Analytics has enough measured traffic to build cohorts.
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

  useEffect(() => {
    if (activeTab === 'embedded' && center && !center.ga4?.embed?.available) {
      setActiveTab('executive');
    }
  }, [activeTab, center]);

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
        const legacyRes = await analyticsAPI.getAdminAnalytics({ days: nextDays });
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
  const internalTrendRows = toInternalTrendRows(internal.analytics?.trends || []);
  const ga4Trend = hasRows(ga4.overview?.trend) ? ga4.overview.trend : internalTrendRows;
  const internalChannelRows = toInternalChannelRows(hasRows(internalAcquisition.sources) ? internalAcquisition.sources : internalAcquisition.referrers || []);
  const internalCountryRows = toInternalCountryRows(internalAcquisition.countries || []);
  const internalTopPageRows = toInternalTopPageRows(internalBehavior.topPages || []);
  const selectedMetric = TREND_METRICS.find((metric) => metric.key === selectedTrendMetric) || TREND_METRICS[0];
  const hasGa4 = Boolean(ga4.enabled);
  const useDemoVisuals = import.meta.env.DEV && !hasGa4 && !hasRows(internalTrendRows);
  const visualChannels = hasRows(ga4.acquisition?.channels)
    ? ga4.acquisition.channels
    : useVisualRows(internalChannelRows, VISUAL_DEMO_GA4.acquisition.channels, useDemoVisuals);
  const visualCountries = hasRows(ga4.acquisition?.countries)
    ? ga4.acquisition.countries
    : useVisualRows(internalCountryRows, VISUAL_DEMO_GA4.acquisition.countries, useDemoVisuals);
  const visualAudiences = useVisualRows(ga4.audiences?.audiences, VISUAL_DEMO_GA4.audiences.audiences, useDemoVisuals);
  const visualRealtimeByMinute = useVisualRows(ga4.realtime?.byMinute, VISUAL_DEMO_GA4.realtime.byMinute, useDemoVisuals);
  const visualRealtimeCountries = hasRows(ga4.realtime?.countries)
    ? ga4.realtime.countries
    : useVisualRows(internalCountryRows, VISUAL_DEMO_GA4.realtime.countries, useDemoVisuals);
  const measuredActiveUsers = firstMetricValue(ga4Summary.activeUsers, internalSummary.uniqueVisitors, internalSummary.sessions);
  const measuredSessions = firstMetricValue(ga4Summary.sessions, internalSummary.sessions);
  const measuredEngagementRate = firstMetricValue(ga4Summary.engagementRate, internalSummary.engagementRate);
  const measuredAverageSessionDuration = firstMetricValue(ga4Summary.averageSessionDuration, internalSummary.averageEngagementTimePerSessionSeconds);
  const measuredViews = firstMetricValue(ga4Summary.screenPageViews, internalSummary.pageViews);
  const measuredRevenue = firstMetricValue(ga4Summary.totalRevenue, internalSummary.revenue);
  const measuredRefunds = firstMetricValue(ga4Summary.refundAmount, internalSummary.refunds);
  const availableTabs = ga4.embed?.available ? [...TABS, { key: 'embedded', label: 'Embedded' }] : TABS;

  const financeSnapshot = [
    { label: 'Gross payments', value: formatCurrency(finance?.grossPaid) },
    { label: 'Net cash after fees', value: formatCurrency(finance?.netCashAfterFees) },
    { label: 'Creator liability', value: formatCurrency(finance?.eligibleInstructorLiability) },
    { label: 'Platform cash after payouts', value: formatCurrency(finance?.platformCashAfterPayouts) },
  ];

  const exportRows = useMemo(() => ({
    ga4Trend,
    ga4Channels: visualChannels,
    ga4SourceMediums: ga4.acquisition?.sourceMediums || [],
    ga4Campaigns: ga4.acquisition?.campaigns || [],
    ga4Countries: visualCountries,
    ga4TopPages: hasRows(ga4.engagement?.topPages) ? ga4.engagement.topPages : internalTopPageRows,
    ga4Events: ga4.engagement?.events || [],
    ga4Products: ga4.commerce?.products || [],
    ga4Currencies: ga4.commerce?.currencies || [],
    ga4Retention: ga4.retention?.rows || [],
    ga4Audiences: visualAudiences,
    ga4AudienceTrend: ga4.audiences?.trend || [],
    internalTopPages: internalBehavior.topPages || [],
    internalFlows: internalBehavior.navigationFlows || [],
    internalCtas: internalBehavior.ctaPerformance || [],
    internalCheckoutMethods: internalCommerce.checkoutMethods || [],
  }), [ga4, internalBehavior, internalCommerce, ga4Trend, visualAudiences, visualChannels, visualCountries, internalTopPageRows]);

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
          label={hasGa4 ? 'GA4 Active Users' : 'Measured Visitors'}
          value={formatInteger(measuredActiveUsers)}
          sublabel={`${formatInteger(measuredSessions)} sessions in the selected window`}
          icon="🌐"
          tone="soft"
        />
        <KpiCard
          label={hasGa4 ? 'GA4 Engagement' : 'Internal Engagement'}
          value={formatPercent(measuredEngagementRate)}
          sublabel={`${formatSeconds(measuredAverageSessionDuration)} avg session duration`}
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
          value={formatCurrency(measuredRevenue)}
          sublabel={`${formatCurrency(measuredRefunds)} refunds tracked`}
          icon="💳"
          tone="dark"
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.35fr_0.65fr]">
        <Card
          title={hasGa4 ? 'GA4 Executive Trend' : 'Internal Executive Trend'}
          subtitle={`Selected ${hasGa4 ? 'Google Analytics' : 'Aiqda internal'} metric over the last ${ga4.range?.days || days} days`}
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
            emptyLabel="Trend data will appear here after traffic is captured."
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

      <div className="grid gap-6">
        <ChannelMixIllustration rows={visualChannels} />
        <GeoAudienceMap
          rows={visualCountries}
          valueKey="activeUsers"
          title="Audience concentration map"
          subtitle="A premium geographic overlay showing where the strongest audience clusters are forming across the measured range."
        />
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
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
      {useDemoVisuals ? (
        <StatusBanner title="Development preview visuals are active" tone="info">
          Premium acquisition and audience illustrations are showing local preview data for design review.
        </StatusBanner>
      ) : null}

      <div className="grid gap-6">
        <GeoAudienceMap
          rows={visualCountries}
          valueKey="activeUsers"
          title="Country performance map"
          subtitle="Hover highlighted countries on the world map to compare active users and quickly spot high-value demand zones."
        />
        <ChannelMixIllustration rows={visualChannels} />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
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
          <BarsList rows={visualChannels} valueKey="sessions" emptyLabel="GA4 channel data will appear here." />
        </Card>

        <Card title="Internal Referrers" subtitle="Referrer hosts from internal tracking">
          <BarsList rows={internalAcquisition.referrers || []} emptyLabel="Internal referrer data will appear here." />
        </Card>

        <Card title="Internal Sources" subtitle="UTM sources from internal tracking">
          <BarsList rows={internalAcquisition.sources || []} emptyLabel="Internal source data will appear here." />
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
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
          title={hasGa4 ? 'GA4 Countries' : 'Internal Countries'}
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
          <BarsList rows={visualCountries} valueKey="activeUsers" emptyLabel="Country performance data will appear here." />
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
      <div className="grid gap-6 2xl:grid-cols-[1.25fr_0.75fr]">
        <Card
          title={hasGa4 ? 'GA4 Top Pages' : 'Internal Top Pages'}
          subtitle={hasGa4 ? 'Official page engagement from Google Analytics' : 'Page engagement captured by Aiqda internal tracking'}
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
            emptyLabel="Page performance will appear here after traffic is captured."
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
            rows={exportRows.ga4TopPages}
          />
        </Card>

        <Card title="Hourly Activity" subtitle="GA4 active users and event load by hour">
          <BarsList rows={(ga4.engagement?.hourly || []).map((row) => ({ ...row, label: row.hour, count: row.activeUsers }))} emptyLabel="Hourly GA4 activity will appear here." />
        </Card>
      </div>

      <div className="grid gap-6 2xl:grid-cols-2">
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

      <div className="grid gap-6 2xl:grid-cols-2">
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

      <div className="grid gap-6 xl:grid-cols-3">
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
      {useDemoVisuals ? (
        <StatusBanner title="Development preview visuals are active" tone="info">
          Audience illustration cards are showing local preview data for design review.
        </StatusBanner>
      ) : null}

      <AudienceSpectrum rows={visualAudiences} />

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
          rows={visualAudiences}
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
        <KpiCard label="Views in Window" value={formatInteger(measuredViews)} sublabel={`${ga4.range?.days || days}-day measurement window`} icon="👁️" />
      </div>

      <div className="grid gap-6 2xl:grid-cols-[1.2fr_0.8fr]">
        <Card title="Realtime Activity by Minute" subtitle="Last 30 minutes from GA4 Realtime" accent="gradient">
          <RealtimeBars rows={visualRealtimeByMinute.map((row) => ({ label: row.label.replace(' ago', ''), activeUsers: row.activeUsers }))} />
        </Card>

        <Card title="Realtime Pages" subtitle="Pages/screens with current live activity">
          <BarsList rows={(ga4.realtime?.pages || []).map((row) => ({ label: row.label, count: row.screenPageViews }))} emptyLabel="Realtime page activity will appear here." />
        </Card>
      </div>

      <GeoAudienceMap
        rows={visualRealtimeCountries}
        valueKey="activeUsers"
        title="Live audience geography"
        subtitle="A realtime world view of where current active users are concentrated. Hover each country marker to inspect its live load."
      />

      <div className="grid gap-6 2xl:grid-cols-2">
        <Card title="Realtime Countries" subtitle="Live users by country">
          <BarsList rows={visualRealtimeCountries.map((row) => ({ label: row.label, count: row.activeUsers }))} emptyLabel="Realtime country activity will appear here." />
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
              {hasGa4 ? ` • GA4 property ${ga4.propertyId}` : ' • Using internal analytics data'}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-gradient-to-br from-gray-900 via-primary-700 to-cyan-500 p-5 text-white">
              <p className="text-xs uppercase tracking-[0.2em] text-white/70">Website Visits</p>
              <p className="mt-4 text-4xl font-bold">{formatInteger(internalSummary.sessions)}</p>
              <p className="mt-2 text-sm text-white/80">All non-admin, non-creator sessions captured by Aiqda’s event pipeline</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">GA4 Measurement</p>
              <p className="mt-4 text-4xl font-bold text-gray-900">{formatInteger(measuredActiveUsers)}</p>
              <p className="mt-2 text-sm text-gray-500">Active users reported by the connected Google Analytics property</p>
            </div>
            <div className="rounded-3xl border border-primary-100 bg-primary-50 p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-primary-500">Conversion Signals</p>
              <p className="mt-4 text-3xl font-bold text-gray-900">{formatInteger(internalSummary.leads)}</p>
              <p className="mt-2 text-sm text-gray-600">Internal lead events across contact, creator, studio, and consultations</p>
            </div>
            <div className="rounded-3xl border border-gray-200 bg-white p-5">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-400">Commerce Pulse</p>
              <p className="mt-4 text-3xl font-bold text-gray-900">{formatCurrency(measuredRevenue)}</p>
              <p className="mt-2 text-sm text-gray-500">Revenue measured across the selected reporting range</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {availableTabs.map((tab) => (
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
      {activeTab === 'embedded' && ga4.embed?.available ? renderEmbeddedTab() : null}
    </div>
  );
}

export default AdminAnalyticsMeasurements;
