import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';

const sar = (n) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

const STATUS_COLORS = {
  pending_completion: 'bg-gray-100 text-gray-600',
  eligible: 'bg-emerald-50 text-emerald-700',
  on_hold: 'bg-amber-50 text-amber-700',
  approved_for_payout: 'bg-sky-50 text-sky-700',
  partially_paid: 'bg-indigo-50 text-indigo-700',
  paid: 'bg-green-50 text-green-700',
  voided: 'bg-rose-50 text-rose-600',
  reversed: 'bg-rose-50 text-rose-600',
};

function AdminFinanceInstructor() {
  const { id } = useParams();
  const { showError } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await financeAPI.getInstructorProfile(id);
        setData(res.data);
      } catch (error) {
        showError(error.response?.data?.error || 'Failed to load creator financials');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, showError]);

  if (loading) return <LoadingSpinner />;
  if (!data) return null;

  const { summary, ledger, instructor } = data;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-6">
      <div>
        <Link to="/admin/finance" className="text-sm text-primary-600 hover:underline">← Back to overview</Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{instructor.name}</h1>
        <p className="text-sm text-gray-500">{instructor.email}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[['Max potential', summary.maxPotential], ['Eligible', summary.eligible], ['Approved unpaid', summary.approvedUnpaid], ['Paid', summary.paid], ['Recovery', summary.recovery]].map(([label, val]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{sar(val)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
        <div className="px-4 py-3 border-b font-semibold text-gray-900">Learner ledger</div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Learner</th>
              <th className="text-left px-4 py-2">Chapter</th>
              <th className="text-right px-4 py-2">Max</th>
              <th className="text-right px-4 py-2">Alloc%</th>
              <th className="text-right px-4 py-2">Completion</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Remaining</th>
              <th className="text-right px-4 py-2">Recovery</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No earnings</td></tr>
            ) : ledger.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2 text-gray-900">{row.learner}</td>
                <td className="px-4 py-2">{row.course}</td>
                <td className="px-4 py-2 text-right">{sar(row.maxPotential)}</td>
                <td className="px-4 py-2 text-right">{(row.allocationBps / 100).toFixed(1)}%</td>
                <td className="px-4 py-2 text-right">{row.completion}%</td>
                <td className="px-4 py-2 text-right">{sar(row.paid)}</td>
                <td className="px-4 py-2 text-right">{sar(row.remaining)}</td>
                <td className="px-4 py-2 text-right text-rose-600">{sar(row.recovery)}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[row.status] || 'bg-gray-100 text-gray-600'}`}>{row.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

export default AdminFinanceInstructor;
