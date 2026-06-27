import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';

const sar = (n) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

const FIGURES = [
  ['grossPaid', 'Gross learner payments'],
  ['gatewayFees', 'Tap gateway fees'],
  ['maxInstructorExposure', 'Max instructor pool (30%)'],
  ['pendingInstructorPotential', 'Pending potential (not earned)'],
  ['eligibleInstructorLiability', 'Eligible liability (unpaid)'],
  ['approvedUnpaid', 'Approved but unpaid'],
  ['actualInstructorPayouts', 'Actual payouts made'],
  ['instructorRecoveryBalances', 'Recovery balances'],
  ['platformGrossShare', 'Platform gross share (70%)'],
  ['platformCashAfterFeesAndLiabilities', 'Platform cash after fees + liabilities'],
  ['platformCashAfterPayouts', 'Platform cash after payouts'],
  ['refunds', 'Refunds'],
  ['chargebacks', 'Chargebacks'],
  ['netCashAfterFees', 'Net cash after fees'],
];

function AdminFinance() {
  const { showError } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [byInstructor, setByInstructor] = useState([]);
  const [range, setRange] = useState({ from: '', to: '' });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await financeAPI.getOverview({ from: range.from || undefined, to: range.to || undefined });
      setSummary(data.summary);
      setByInstructor(data.byInstructor || []);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load financial overview');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Financial Overview</h1>
        <div className="flex items-end gap-2">
          <label className="text-xs text-gray-500">From
            <input type="date" value={range.from} onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} className="block border rounded-lg px-2 py-1 text-sm" />
          </label>
          <label className="text-xs text-gray-500">To
            <input type="date" value={range.to} onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} className="block border rounded-lg px-2 py-1 text-sm" />
          </label>
          <button onClick={load} className="btn-primary text-sm">Apply</button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {FIGURES.map(([key, label]) => (
          <div key={key} className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{sar(summary?.[key])}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white overflow-hidden">
        <div className="px-4 py-3 border-b font-semibold text-gray-900">Revenue by creator</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Creator</th>
              <th className="text-right px-4 py-2">Max potential</th>
              <th className="text-right px-4 py-2">Eligible</th>
              <th className="text-right px-4 py-2">Approved unpaid</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Recovery</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {byInstructor.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No earnings yet</td></tr>
            ) : byInstructor.map((row) => (
              <tr key={row.instructor} className="border-t">
                <td className="px-4 py-2 text-gray-900">{row.name}</td>
                <td className="px-4 py-2 text-right">{sar(row.maxPotential)}</td>
                <td className="px-4 py-2 text-right">{sar(row.eligible)}</td>
                <td className="px-4 py-2 text-right">{sar(row.approvedUnpaid)}</td>
                <td className="px-4 py-2 text-right">{sar(row.paid)}</td>
                <td className="px-4 py-2 text-right text-rose-600">{sar(row.recovery)}</td>
                <td className="px-4 py-2 text-right">
                  <Link to={`/admin/finance/instructors/${row.instructor}`} className="text-primary-600 hover:underline">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

export default AdminFinance;
