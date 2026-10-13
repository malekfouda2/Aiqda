import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';
import { sar, FinanceHeader } from '../components/finance/FinanceUI';

// The full breakdown, grouped the way the money flows. [key, label, explanation]
const BREAKDOWN = [
  ['Money in', [
    ['grossPaid', 'Paid by members', 'Every successful subscription payment.'],
    ['refunds', 'Refunded to members', ''],
    ['chargebacks', 'Chargebacks', 'Payments reversed by the member’s bank.'],
    ['gatewayFees', 'Payment gateway fees', 'Charged by Tap, where reported.'],
    ['bankFees', 'Bank fees', 'Entered under Platform costs below.'],
    ['expensesTotal', 'Other costs', 'Entered under Platform costs below.'],
    ['netCashAfterFees', 'Left after refunds, fees and costs', ''],
  ]],
  ['Creators', [
    ['maxInstructorExposure', 'Most creators could earn (30%)', '30% of what members paid. Only earned when members complete chapters.'],
    ['eligibleInstructorLiability', 'Earned, not paid yet', 'What you currently owe creators.'],
    ['approvedUnpaid', 'Approved, not paid yet', 'The part of the above already approved in step 2.'],
    ['actualInstructorPayouts', 'Paid to creators', ''],
    ['instructorRecoveryBalances', 'Owed back by creators', 'Paid for a member who was later refunded. Deducted from their next payout.'],
  ]],
  ['Platform', [
    ['platformGrossShare', 'Platform share before costs (70%)', ''],
    ['platformCashAfterFeesAndLiabilities', 'Left after costs and what creators are owed', ''],
    ['platformCashAfterPayouts', 'Left after costs and payouts made', ''],
  ]],
];

function AdminFinance() {
  const { showError, showSuccess } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [byInstructor, setByInstructor] = useState([]);
  const [todo, setTodo] = useState(null);
  const [range, setRange] = useState({ from: '', to: '' });
  const [feeForm, setFeeForm] = useState({ bankFee: '', expenses: [] });
  const [savingFees, setSavingFees] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [showCosts, setShowCosts] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [overview, settings, todoRes] = await Promise.all([
        financeAPI.getOverview({ from: range.from || undefined, to: range.to || undefined }),
        financeAPI.getSettings(),
        financeAPI.getTodo(),
      ]);
      setSummary(overview.data.summary);
      setByInstructor(overview.data.byInstructor || []);
      setTodo(todoRes.data);
      setFeeForm({
        bankFee: String(settings.data.bankFee ?? ''),
        expenses: (settings.data.expenses || []).map((e) => ({ label: e.label, amount: String(e.amount ?? '') })),
      });
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load financial overview');
    } finally {
      setLoading(false);
    }
  };

  const addExpense = () => setFeeForm((f) => ({ ...f, expenses: [...f.expenses, { label: '', amount: '' }] }));
  const removeExpense = (idx) => setFeeForm((f) => ({ ...f, expenses: f.expenses.filter((_, i) => i !== idx) }));
  const updateExpense = (idx, field, value) => setFeeForm((f) => ({
    ...f,
    expenses: f.expenses.map((e, i) => (i === idx ? { ...e, [field]: value } : e)),
  }));

  const saveFees = async (e) => {
    e.preventDefault();
    setSavingFees(true);
    try {
      await financeAPI.updateSettings({
        bankFee: Number(feeForm.bankFee) || 0,
        expenses: feeForm.expenses
          .filter((row) => row.label.trim() || row.amount)
          .map((row) => ({ label: row.label.trim(), amount: Number(row.amount) || 0 })),
      });
      showSuccess('Costs updated');
      await load();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to update costs');
    } finally {
      setSavingFees(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (loading) return <LoadingSpinner />;

  const collected = (summary?.grossPaid || 0) - (summary?.refunds || 0) - (summary?.chargebacks || 0);
  const owed = summary?.eligibleInstructorLiability || 0;
  const paid = summary?.actualInstructorPayouts || 0;
  const kept = (summary?.netCashAfterFees || 0) - owed - paid;
  const headline = [
    ['Collected from members', collected, 'After refunds and chargebacks'],
    ['Earned by creators', owed + paid, `${sar(owed)} still to pay`],
    ['Paid to creators', paid, 'Bank transfers recorded'],
    ['Left for the platform', kept, 'After fees, costs and creator earnings'],
  ];

  const tasks = [
    ...(todo?.statementsToFinalize || []).map((item) => ({
      key: `finalize-${item.period}`, step: 1, to: `/admin/finance/statements?period=${item.period}`, action: 'Review and finalize',
      text: `${item.creators} creator statement${item.creators === 1 ? '' : 's'} for ${item.periodLabel} to finalize`,
    })),
    ...(todo?.statementsNeedingReview || []).map((item) => ({
      key: `review-${item.instructorId}-${item.period}`, step: 1, tone: 'red', action: 'Review',
      to: `/admin/finance/statements?period=${item.period}&creator=${item.instructorId}`,
      text: `${item.name}’s ${item.periodLabel} statement changed after it was finalized (refund or hold)`,
    })),
    ...(todo?.earningsToApprove?.count ? [{
      key: 'approve', step: 2, to: '/admin/finance/earnings', action: 'Approve',
      text: `${todo.earningsToApprove.count} earning${todo.earningsToApprove.count === 1 ? '' : 's'} ready to approve: ${sar(todo.earningsToApprove.total)}`,
    }] : []),
    ...(todo?.earningsToBatch?.count ? [{
      key: 'batch', step: 2, to: '/admin/finance/earnings?view=approved', action: 'Create payouts',
      text: `${sar(todo.earningsToBatch.total)} approved and waiting for a payout to be created`,
    }] : []),
    ...(todo?.batchesToApprove?.count ? [{
      key: 'batches-approve', step: 3, to: '/admin/finance/payouts', action: 'Approve',
      text: `${todo.batchesToApprove.count} payout${todo.batchesToApprove.count === 1 ? '' : 's'} waiting for approval: ${sar(todo.batchesToApprove.total)}`,
    }] : []),
    ...(todo?.batchesToPay?.count ? [{
      key: 'batches-pay', step: 3, to: '/admin/finance/payouts', action: 'Record payment',
      text: `${todo.batchesToPay.count} payout${todo.batchesToPay.count === 1 ? '' : 's'} approved and waiting to be paid: ${sar(todo.batchesToPay.total)}`,
    }] : []),
  ];

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6">
      <FinanceHeader
        title="Finance"
        description="Each month: 1. finalize creator statements, 2. approve their earnings, 3. pay them and record the transfer."
      />

      <div className="rounded-2xl border border-gray-100 bg-white">
        <div className="border-b px-4 py-3 font-semibold text-gray-900">Needs your attention</div>
        {tasks.length === 0 ? (
          <p className="px-4 py-6 text-sm text-gray-500">You are all caught up. Nothing to finalize, approve or pay right now.</p>
        ) : (
          <ul className="divide-y">
            {tasks.map((task) => (
              <li key={task.key} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${task.tone === 'red' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'}`}>{task.step}</span>
                  <span className="text-sm text-gray-800">{task.text}</span>
                </div>
                <Link to={task.to} className="btn-primary text-xs">{task.action} →</Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-semibold text-gray-900">{range.from || range.to ? 'Selected period' : 'All time'}</h2>
          <div className="flex items-end gap-2">
            <label className="text-xs text-gray-500">From
              <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="block rounded-lg border px-2 py-1 text-sm" />
            </label>
            <label className="text-xs text-gray-500">To
              <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="block rounded-lg border px-2 py-1 text-sm" />
            </label>
            <button type="button" onClick={load} className="btn-secondary text-sm">Apply</button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {headline.map(([label, value, hint]) => (
            <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{sar(value)}</p>
              <p className="mt-1 text-xs text-gray-400">{hint}</p>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setShowBreakdown((v) => !v)} className="mt-3 text-sm text-primary-600 hover:underline">
          {showBreakdown ? 'Hide full breakdown' : 'Show full breakdown'}
        </button>
        {showBreakdown && (
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {BREAKDOWN.map(([group, lines]) => (
              <div key={group} className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="mb-2 text-sm font-semibold text-gray-900">{group}</p>
                <dl className="space-y-2">
                  {lines.map(([key, label, hint]) => (
                    <div key={key} className="flex items-start justify-between gap-3 text-sm">
                      <dt className="text-gray-600">{label}{hint && <span className="block text-xs text-gray-400">{hint}</span>}</dt>
                      <dd className="whitespace-nowrap font-medium text-gray-900">{sar(summary?.[key])}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
        <div className="border-b px-4 py-3 font-semibold text-gray-900">Creators</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-2 text-left">Creator</th>
                <th className="px-4 py-2 text-right">Earned, not paid yet</th>
                <th className="px-4 py-2 text-right">Approved, not paid yet</th>
                <th className="px-4 py-2 text-right">Paid</th>
                <th className="px-4 py-2 text-right">Owes back</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {byInstructor.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No creator has earned anything yet. Earnings appear when a member completes 80% of a chapter.</td></tr>
              ) : byInstructor.map((row) => (
                <tr key={row.instructor} className="border-t">
                  <td className="px-4 py-2 text-gray-900">{row.name}</td>
                  <td className="px-4 py-2 text-right">{sar(row.eligible - row.paid > 0 ? row.eligible - row.paid : 0)}</td>
                  <td className="px-4 py-2 text-right">{sar(row.approvedUnpaid)}</td>
                  <td className="px-4 py-2 text-right">{sar(row.paid)}</td>
                  <td className={`px-4 py-2 text-right ${row.recovery > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{sar(row.recovery)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/admin/finance/instructors/${row.instructor}`} className="text-primary-600 hover:underline">Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white">
        <button type="button" onClick={() => setShowCosts((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left">
          <span>
            <span className="font-semibold text-gray-900">Platform costs</span>
            <span className="block text-xs text-gray-500">Bank fees and expenses you enter by hand: {sar((summary?.bankFees || 0) + (summary?.expensesTotal || 0))}</span>
          </span>
          <span className="text-sm text-primary-600">{showCosts ? 'Close' : 'Edit'}</span>
        </button>
        {showCosts && (
          <form onSubmit={saveFees} className="border-t p-4">
            <p className="mb-4 text-xs text-gray-500">These are subtracted from what is left for the platform. They never change what creators earn.</p>
            <label className="mb-4 block text-xs text-gray-500">Bank fees (SAR)
              <input type="number" min="0" step="0.01" value={feeForm.bankFee} onChange={(e) => setFeeForm((f) => ({ ...f, bankFee: e.target.value }))} className="mt-1 block w-40 rounded-lg border px-2 py-1 text-sm" />
            </label>
            <p className="mb-2 text-xs font-medium text-gray-600">Expenses</p>
            <div className="mb-3 space-y-2">
              {feeForm.expenses.length === 0 && <p className="text-xs text-gray-400">No expenses added yet.</p>}
              {feeForm.expenses.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input type="text" placeholder="Expense name (e.g. Office rent)" value={row.label} onChange={(e) => updateExpense(idx, 'label', e.target.value)} className="min-w-0 flex-1 rounded-lg border px-2 py-1 text-sm" />
                  <input type="number" min="0" step="0.01" placeholder="Amount" value={row.amount} onChange={(e) => updateExpense(idx, 'amount', e.target.value)} className="w-32 rounded-lg border px-2 py-1 text-sm" />
                  <span className="text-xs text-gray-400">SAR</span>
                  <button type="button" onClick={() => removeExpense(idx)} className="px-1 text-gray-300 hover:text-red-500" aria-label="Remove expense">✕</button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={addExpense} className="text-sm text-primary-600 hover:text-primary-700">+ Add expense</button>
              <button type="submit" disabled={savingFees} className="btn-primary text-sm disabled:opacity-60">{savingFees ? 'Saving…' : 'Save costs'}</button>
            </div>
          </form>
        )}
      </div>
    </motion.div>
  );
}

export default AdminFinance;
