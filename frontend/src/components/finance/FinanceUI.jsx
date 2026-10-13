import { NavLink } from 'react-router-dom';

// Shared building blocks for the admin finance screens: one header with the steps of the
// monthly flow, plain-language labels for ledger states, a dialog, and money/date formatting.

export const sar = (n) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const monthLabel = (period) => {
  if (!period) return '';
  const [year, month] = period.split('-');
  return `${MONTHS[Number(month) - 1]} ${year}`;
};

export const shortDate = (value) => (value
  ? new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  : '—');

// Statement months follow Riyadh time (UTC+3), like the backend.
export const previousPeriod = () => {
  const riyadhNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const previous = new Date(Date.UTC(riyadhNow.getUTCFullYear(), riyadhNow.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
};

const TONES = {
  gray: 'bg-gray-100 text-gray-600',
  amber: 'bg-amber-50 text-amber-700',
  blue: 'bg-sky-50 text-sky-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-rose-50 text-rose-700',
};

export const EARNING_STATUS = {
  pending_completion: { label: 'Not earned yet', tone: 'gray' },
  eligible: { label: 'Earned', tone: 'amber' },
  on_hold: { label: 'On hold', tone: 'red' },
  approved_for_payout: { label: 'Approved to pay', tone: 'blue' },
  partially_paid: { label: 'Partly paid', tone: 'blue' },
  paid: { label: 'Paid', tone: 'green' },
  voided: { label: 'Cancelled (refund)', tone: 'gray' },
  reversed: { label: 'Refunded after payout', tone: 'red' },
};

export const BATCH_STATUS = {
  draft: { label: 'Waiting for approval', tone: 'amber' },
  awaiting_approval: { label: 'Waiting for approval', tone: 'amber' },
  approved: { label: 'Ready to pay', tone: 'blue' },
  processing_manually: { label: 'Ready to pay', tone: 'blue' },
  partially_paid: { label: 'Partly paid', tone: 'blue' },
  paid: { label: 'Paid', tone: 'green' },
  cancelled: { label: 'Cancelled', tone: 'gray' },
  voided: { label: 'Cancelled', tone: 'gray' },
};

export const PAYMENT_STATE = {
  nothing_due: { label: 'Nothing to pay', tone: 'gray' },
  pending: { label: 'Not paid yet', tone: 'amber' },
  approved: { label: 'Approved to pay', tone: 'blue' },
  partially_paid: { label: 'Partly paid', tone: 'blue' },
  paid: { label: 'Paid', tone: 'green' },
};

export function Badge({ tone = 'gray', children }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${TONES[tone] || TONES.gray}`}>
      {children}
    </span>
  );
}

export function StatusBadge({ map, status }) {
  const entry = map[status] || { label: status, tone: 'gray' };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}

const STEPS = [
  { to: '/admin/finance/statements', title: 'Statements', hint: 'Review each creator’s month and finalize it' },
  { to: '/admin/finance/earnings', title: 'Earnings', hint: 'Approve what will be paid' },
  { to: '/admin/finance/payouts', title: 'Payouts', hint: 'Record the bank transfers' },
];

// Header shown on every finance screen: where you are, and the order the monthly work is done in.
export function FinanceHeader({ title, description, counts = {}, children }) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <NavLink
          to="/admin/finance"
          end
          className={({ isActive }) => `rounded-full px-3 py-1.5 font-medium ${isActive ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
        >
          Overview
        </NavLink>
        <span className="text-gray-300">|</span>
        {STEPS.map((step, index) => (
          <NavLink
            key={step.to}
            to={step.to}
            title={step.hint}
            className={({ isActive }) => `flex items-center gap-2 rounded-full px-3 py-1.5 font-medium ${isActive ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-black/10 text-xs">{index + 1}</span>
            {step.title}
            {counts[step.title] > 0 && (
              <span className="rounded-full bg-amber-400 px-1.5 text-xs font-semibold text-gray-900">{counts[step.title]}</span>
            )}
          </NavLink>
        ))}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          {description && <p className="mt-1 max-w-3xl text-sm text-gray-500">{description}</p>}
        </div>
        {children}
      </div>
    </div>
  );
}

export function Dialog({ title, children, onClose, footer, wide = false }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={`w-full ${wide ? 'max-w-3xl' : 'max-w-md'} rounded-2xl bg-white shadow-xl`}
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="text-gray-400 hover:text-gray-700">✕</button>
        </div>
        <div className="px-5 py-4 text-sm text-gray-700">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function Notice({ tone = 'amber', children }) {
  const styles = { amber: 'bg-amber-50 text-amber-800', red: 'bg-rose-50 text-rose-700', blue: 'bg-sky-50 text-sky-800', gray: 'bg-gray-50 text-gray-600' };
  return <p className={`rounded-lg px-3 py-2 text-xs ${styles[tone]}`}>{children}</p>;
}

export function EmptyRow({ colSpan, children }) {
  return <tr><td colSpan={colSpan} className="px-4 py-8 text-center text-sm text-gray-400">{children}</td></tr>;
}
