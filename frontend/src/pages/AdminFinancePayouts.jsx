import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';

const sar = (minorDecimal) => `${Number(minorDecimal || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;
const m = (n) => Number(n || 0) / 100; // minor units -> decimal SAR for display

const STATUS_COLORS = {
  draft: 'bg-gray-100 text-gray-600',
  approved: 'bg-sky-50 text-sky-700',
  partially_paid: 'bg-indigo-50 text-indigo-700',
  paid: 'bg-green-50 text-green-700',
  cancelled: 'bg-rose-50 text-rose-600',
};

function AdminFinancePayouts() {
  const { showSuccess, showError } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await financeAPI.getPayoutBatches();
      setBatches(data);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load payout batches');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id) => {
    try { await financeAPI.approvePayoutBatch(id); showSuccess('Batch approved'); load(); }
    catch (error) { showError(error.response?.data?.error || 'Approve failed'); }
  };

  const cancel = async (id) => {
    if (!window.confirm('Cancel this batch?')) return;
    try { await financeAPI.cancelPayoutBatch(id); showSuccess('Batch cancelled'); load(); }
    catch (error) { showError(error.response?.data?.error || 'Cancel failed'); }
  };

  const settle = async (batch) => {
    const remaining = m(batch.totalRemainingMinor);
    const amountStr = window.prompt(`Settlement amount (SAR). Remaining ${remaining.toFixed(2)}:`, remaining.toFixed(2));
    if (amountStr == null) return;
    const settlementReference = window.prompt('Settlement reference (bank/transfer ref):', '') || '';
    try {
      await financeAPI.settlePayoutBatch(batch._id, {
        paidAmount: Number(amountStr),
        settlementMethod: 'bank_transfer',
        settlementReference,
      });
      showSuccess('Batch settled');
      load();
    } catch (error) {
      showError(error.response?.data?.error || 'Settle failed');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Manual payout batches</h1>
      <p className="text-sm text-gray-500">Create batches from the Earnings queue. Settle them manually here.</p>

      <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="text-left px-4 py-2">Creator</th>
              <th className="text-right px-4 py-2">Approved</th>
              <th className="text-right px-4 py-2">Recovery applied</th>
              <th className="text-right px-4 py-2">Paid</th>
              <th className="text-right px-4 py-2">Remaining</th>
              <th className="text-left px-4 py-2">Method / Ref</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="px-4 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-6 text-center text-gray-400">No payout batches</td></tr>
            ) : batches.map((b) => (
              <tr key={b._id} className="border-t">
                <td className="px-4 py-2 text-gray-900">{b.instructor?.name || '—'}</td>
                <td className="px-4 py-2 text-right">{sar(m(b.totalApprovedMinor))}</td>
                <td className="px-4 py-2 text-right text-rose-600">{sar(m(b.recoveryAppliedMinor))}</td>
                <td className="px-4 py-2 text-right">{sar(m(b.totalPaidMinor))}</td>
                <td className="px-4 py-2 text-right">{sar(m(b.totalRemainingMinor))}</td>
                <td className="px-4 py-2 text-gray-500">{b.settlementReference ? `${b.settlementMethod}: ${b.settlementReference}` : '—'}</td>
                <td className="px-4 py-2"><span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[b.status] || 'bg-gray-100 text-gray-600'}`}>{b.status}</span></td>
                <td className="px-4 py-2 text-right space-x-2 whitespace-nowrap">
                  {b.status === 'draft' && <button onClick={() => approve(b._id)} className="text-sky-600 hover:underline">Approve</button>}
                  {['approved', 'partially_paid'].includes(b.status) && <button onClick={() => settle(b)} className="text-green-600 hover:underline">Settle</button>}
                  {!['paid', 'cancelled', 'voided'].includes(b.status) && <button onClick={() => cancel(b._id)} className="text-rose-600 hover:underline">Cancel</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

export default AdminFinancePayouts;
