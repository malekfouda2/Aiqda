import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';

const sar = (n) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

const STATUSES = ['', 'pending_completion', 'eligible', 'on_hold', 'approved_for_payout', 'partially_paid', 'paid', 'voided', 'reversed'];

function AdminFinanceEarnings() {
  const { showSuccess, showError } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selected, setSelected] = useState({});
  const [filters, setFilters] = useState({ status: '', paid: '', from: '', to: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await financeAPI.getEarnings(params);
      setRows(data);
      setSelected({});
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  }, [filters, showError]);

  useEffect(() => { load(); }, [load]);

  const selectedIds = Object.keys(selected).filter((id) => selected[id]);

  const runBulk = async (action) => {
    if (selectedIds.length === 0) return;
    let reason = '';
    if (action === 'hold' || action === 'void') {
      reason = window.prompt(`Reason for ${action}?`) || '';
    }
    try {
      const { data } = await financeAPI.bulkEarnings({ earningIds: selectedIds, action, reason });
      showSuccess(`${data.updated} earning(s) updated`);
      load();
    } catch (error) {
      showError(error.response?.data?.error || 'Bulk action failed');
    }
  };

  const createBatch = async () => {
    if (selectedIds.length === 0) return;
    const chosen = rows.filter((r) => selected[r.id]);
    const instructorIds = [...new Set(chosen.map((r) => r.instructorId).filter(Boolean))];
    // Earnings carry instructor name only; batch creation is grouped server-side by instructor.
    // Require a single creator selection to avoid mixing payees in one batch.
    if (instructorIds.length > 1) {
      showError('Select earnings for a single creator to create a payout batch.');
      return;
    }
    try {
      await financeAPI.createPayoutBatch({ instructor: instructorIds[0], earningIds: selectedIds });
      showSuccess('Payout batch created (see Payouts).');
      load();
    } catch (error) {
      showError(error.response?.data?.error || 'Could not create batch');
    }
  };

  const exportCsv = async () => {
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([, v]) => v));
      const { data } = await financeAPI.exportEarnings(params);
      const url = URL.createObjectURL(new Blob([data], { type: 'text/csv' }));
      const a = document.createElement('a');
      a.href = url; a.download = 'earnings.csv'; a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(error.response?.data?.error || 'Export failed');
    }
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-4">
      <h1 className="text-2xl font-bold text-gray-900">Earnings queue</h1>

      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-gray-500">Status
          <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="block border rounded-lg px-2 py-1 text-sm">
            {STATUSES.map((s) => <option key={s} value={s}>{s || 'All'}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-500">Paid
          <select value={filters.paid} onChange={(e) => setFilters((f) => ({ ...f, paid: e.target.value }))} className="block border rounded-lg px-2 py-1 text-sm">
            <option value="">All</option><option value="paid">Paid</option><option value="unpaid">Unpaid</option>
          </select>
        </label>
        <label className="text-xs text-gray-500">From<input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="block border rounded-lg px-2 py-1 text-sm" /></label>
        <label className="text-xs text-gray-500">To<input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="block border rounded-lg px-2 py-1 text-sm" /></label>
        <button onClick={exportCsv} className="btn-secondary text-sm">Export CSV</button>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2 rounded-xl bg-gray-50 p-2">
          <span className="text-sm text-gray-600 self-center">{selectedIds.length} selected:</span>
          <button onClick={() => runBulk('approve')} className="btn-secondary text-xs">Approve</button>
          <button onClick={() => runBulk('hold')} className="btn-secondary text-xs">Hold</button>
          <button onClick={() => runBulk('release')} className="btn-secondary text-xs">Release</button>
          <button onClick={() => runBulk('void')} className="btn-secondary text-xs">Void</button>
          <button onClick={createBatch} className="btn-primary text-xs">Create payout batch</button>
        </div>
      )}

      {loading ? <LoadingSpinner /> : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-3 py-2"></th>
                <th className="text-left px-3 py-2">Creator</th>
                <th className="text-left px-3 py-2">Learner</th>
                <th className="text-left px-3 py-2">Chapter</th>
                <th className="text-right px-3 py-2">Max</th>
                <th className="text-right px-3 py-2">Eligible</th>
                <th className="text-right px-3 py-2">Paid</th>
                <th className="text-right px-3 py-2">Completion</th>
                <th className="text-left px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-6 text-center text-gray-400">No earnings match</td></tr>
              ) : rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-3 py-2"><input type="checkbox" checked={!!selected[r.id]} onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))} /></td>
                  <td className="px-3 py-2 text-gray-900">{r.instructor}</td>
                  <td className="px-3 py-2">{r.learner}</td>
                  <td className="px-3 py-2">{r.course}</td>
                  <td className="px-3 py-2 text-right">{sar(r.maxPotential)}</td>
                  <td className="px-3 py-2 text-right">{sar(r.eligible)}</td>
                  <td className="px-3 py-2 text-right">{sar(r.paid)}</td>
                  <td className="px-3 py-2 text-right">{r.completion}%</td>
                  <td className="px-3 py-2">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

export default AdminFinanceEarnings;
