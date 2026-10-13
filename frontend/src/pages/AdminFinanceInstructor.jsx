import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';
import { StatusBadge, EARNING_STATUS, shortDate } from '../components/finance/FinanceUI';

const sar = (n) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

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
        <Link to="/admin/finance" className="text-sm text-primary-600 hover:underline">← Finance overview</Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{instructor.name}</h1>
        <p className="text-sm text-gray-500">{instructor.email}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[['Earned so far', summary.eligible], ['Approved, not paid yet', summary.approvedUnpaid], ['Paid', summary.paid], ['Owes back', summary.recovery]].map(([label, val]) => (
          <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-gray-900">{sar(val)}</p>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
        <div className="px-4 py-3 border-b font-semibold text-gray-900">Every earning<span className="block text-xs font-normal text-gray-500">One line each time a member completed 80% of one of this creator&apos;s chapters.</span></div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Member</th>
              <th className="text-left px-4 py-2">Chapter</th>
              <th className="text-left px-4 py-2">Reached 80%</th>
              <th className="text-right px-4 py-2">Amount</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Owes back</th>
              <th className="text-left px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-6 text-center text-gray-400">No earnings yet</td></tr>
            ) : ledger.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="px-4 py-2 text-gray-900">{row.learner}</td>
                <td className="px-4 py-2">{row.course}</td>
                <td className="px-4 py-2 text-gray-500">{shortDate(row.eligibilityAt)}</td>
                <td className="px-4 py-2 text-right font-medium">{sar(row.amount)}</td>
                <td className="px-4 py-2 text-right">{sar(row.paid)}</td>
                <td className={`px-4 py-2 text-right ${row.recovery > 0 ? 'text-rose-600' : 'text-gray-400'}`}>{sar(row.recovery)}</td>
                <td className="px-4 py-2">
                  <StatusBadge map={EARNING_STATUS} status={row.status} />
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
