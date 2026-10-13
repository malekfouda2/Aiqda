import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';
import {
  sar, monthLabel, shortDate, StatusBadge, BATCH_STATUS, FinanceHeader, Dialog, Notice,
} from '../components/finance/FinanceUI';

const m = (n) => Number(n || 0) / 100; // minor units -> decimal SAR for display
const OPEN_STATUSES = ['draft', 'awaiting_approval', 'approved', 'processing_manually', 'partially_paid'];
const METHODS = [['bank_transfer', 'Bank transfer'], ['cash', 'Cash'], ['wallet', 'Wallet'], ['other', 'Other']];
const methodLabel = (value) => METHODS.find(([key]) => key === value)?.[1] || value;

function AdminFinancePayouts() {
  const { showSuccess, showError } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [batches, setBatches] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState({ amount: '', method: 'bank_transfer', reference: '', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await financeAPI.getPayoutBatches();
      setBatches(data);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load payouts');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  const run = async (action, successMessage) => {
    setBusy(true);
    try {
      await action();
      showSuccess(successMessage);
      setDialog(null);
      await load();
    } catch (error) {
      showError(error.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const openPay = (batch) => {
    setForm({ amount: m(batch.totalRemainingMinor).toFixed(2), method: 'bank_transfer', reference: '', notes: '' });
    setDialog({ type: 'pay', batch });
  };
  const pay = (batch) => run(() => financeAPI.settlePayoutBatch(batch._id, {
    paidAmount: Number(form.amount),
    settlementMethod: form.method,
    settlementReference: form.reference.trim(),
    notes: form.notes.trim(),
  }), 'Payment recorded. The creator has been notified.');

  const open = batches.filter((b) => OPEN_STATUSES.includes(b.status));
  const visible = showAll ? batches : open;
  const amountValid = dialog?.type === 'pay' && Number(form.amount) > 0 && Number(form.amount) <= m(dialog.batch.totalRemainingMinor);

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-5">
      <FinanceHeader
        title="Payouts"
        description="Step 3 of 3. A payout is one payment to one creator. Approve it, send the money from your bank, then record the transfer here so the creator is told they were paid."
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button type="button" onClick={() => setShowAll(false)} className={`rounded-full px-3 py-1.5 ${!showAll ? 'bg-primary-50 font-semibold text-primary-700 ring-1 ring-primary-200' : 'text-gray-600 hover:bg-gray-100'}`}>
          Open ({open.length})
        </button>
        <button type="button" onClick={() => setShowAll(true)} className={`rounded-full px-3 py-1.5 ${showAll ? 'bg-primary-50 font-semibold text-primary-700 ring-1 ring-primary-200' : 'text-gray-600 hover:bg-gray-100'}`}>
          All ({batches.length})
        </button>
      </div>

      {loading ? <LoadingSpinner /> : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">
          {showAll ? 'No payouts yet.' : 'No open payouts.'} Payouts are created in step 2 from approved{' '}
          <Link to="/admin/finance/earnings?view=approved" className="text-primary-600 hover:underline">earnings</Link>.
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map((batch) => {
            const waitingApproval = ['draft', 'awaiting_approval'].includes(batch.status);
            const payable = ['approved', 'processing_manually', 'partially_paid'].includes(batch.status);
            return (
              <div key={batch._id} className="rounded-2xl border border-gray-100 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-gray-900">{batch.instructor?.name || 'Unknown creator'}</p>
                      <StatusBadge map={BATCH_STATUS} status={batch.status} />
                    </div>
                    <p className="mt-1 text-xs text-gray-500">
                      {batch.earningsCount} earning{batch.earningsCount === 1 ? '' : 's'}
                      {batch.periods?.length > 0 && ` for ${batch.periods.map(monthLabel).join(', ')}`}
                      {' · '}created {shortDate(batch.createdAt)}
                    </p>
                    {batch.settlementAt && (
                      <p className="mt-1 text-xs text-gray-500">
                        Last payment {shortDate(batch.settlementAt)} by {methodLabel(batch.settlementMethod).toLowerCase()}
                        {batch.settlementReference ? `, reference ${batch.settlementReference}` : ''}
                        {batch.notes ? ` · ${batch.notes}` : ''}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">{batch.status === 'paid' ? 'Paid' : 'To pay'}</p>
                    <p className="text-xl font-semibold text-gray-900">{sar(batch.status === 'paid' ? m(batch.totalPaidMinor) : m(batch.totalRemainingMinor))}</p>
                    {batch.status !== 'paid' && batch.totalPaidMinor > 0 && <p className="text-xs text-gray-400">{sar(m(batch.totalPaidMinor))} already paid</p>}
                  </div>
                </div>

                {batch.recoveryAppliedMinor > 0 && (
                  <div className="mt-3">
                    <Notice>
                      Approved earnings are {sar(m(batch.totalApprovedMinor))}. {sar(m(batch.recoveryAppliedMinor))} is deducted because this creator
                      was paid for a member who was later refunded.
                    </Notice>
                  </div>
                )}

                {(waitingApproval || payable) && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    {waitingApproval && <button type="button" disabled={busy} onClick={() => setDialog({ type: 'approve', batch })} className="btn-primary text-xs">Approve payout</button>}
                    {payable && <button type="button" disabled={busy} onClick={() => openPay(batch)} className="btn-primary text-xs">Record payment</button>}
                    <button type="button" disabled={busy} onClick={() => setDialog({ type: 'cancel', batch })} className="text-xs text-rose-600 hover:underline">Cancel payout</button>
                    <span className="text-xs text-gray-400">
                      {waitingApproval ? 'Approve first, then send the money and record it.' : 'Send the money from your bank, then record it here.'}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {dialog?.type === 'approve' && (
        <Dialog
          title={`Approve payout to ${dialog.batch.instructor?.name}?`}
          onClose={() => setDialog(null)}
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" disabled={busy} onClick={() => run(() => financeAPI.approvePayoutBatch(dialog.batch._id), 'Payout approved. Send the money, then record the payment.')} className="btn-primary text-sm disabled:opacity-60">Approve</button>
            </>
          )}
        >
          <p className="text-2xl font-semibold text-gray-900">{sar(m(dialog.batch.totalRemainingMinor))}</p>
          <p className="mt-2">This confirms the amount is correct. No money moves: you send the transfer yourself and record it afterwards.</p>
        </Dialog>
      )}

      {dialog?.type === 'cancel' && (
        <Dialog
          title="Cancel this payout?"
          onClose={() => setDialog(null)}
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary text-sm">Keep it</button>
              <button type="button" disabled={busy} onClick={() => run(() => financeAPI.cancelPayoutBatch(dialog.batch._id), 'Payout cancelled')} className="btn-primary text-sm disabled:opacity-60">Cancel payout</button>
            </>
          )}
        >
          <p>The earnings go back to &quot;Approved, not paid yet&quot; in step 2, so you can create a new payout later. Payments already recorded are kept.</p>
        </Dialog>
      )}

      {dialog?.type === 'pay' && (
        <Dialog
          title={`Record payment to ${dialog.batch.instructor?.name}`}
          onClose={() => setDialog(null)}
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" disabled={busy || !amountValid} onClick={() => pay(dialog.batch)} className="btn-primary text-sm disabled:opacity-60">
                Record {amountValid ? sar(Number(form.amount)) : 'payment'}
              </button>
            </>
          )}
        >
          <p className="mb-3 text-xs text-gray-500">Record this after you have sent the money. The creator is notified in the app.</p>
          <div className="space-y-3">
            <label className="block text-xs text-gray-500">Amount sent (SAR) · {sar(m(dialog.batch.totalRemainingMinor))} remaining
              <input type="number" min="0" step="0.01" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} className="mt-1 block w-full rounded-lg border px-2 py-1.5 text-sm" />
            </label>
            {form.amount !== '' && !amountValid && <Notice tone="red">Enter an amount above 0 and not more than what remains.</Notice>}
            {amountValid && Number(form.amount) < m(dialog.batch.totalRemainingMinor) && (
              <Notice>This is a partial payment. {sar(m(dialog.batch.totalRemainingMinor) - Number(form.amount))} will remain to pay.</Notice>
            )}
            <label className="block text-xs text-gray-500">How it was paid
              <select value={form.method} onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))} className="mt-1 block w-full rounded-lg border px-2 py-1.5 text-sm">
                {METHODS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="block text-xs text-gray-500">Transfer reference (shown to the creator)
              <input type="text" value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} placeholder="Bank reference number" className="mt-1 block w-full rounded-lg border px-2 py-1.5 text-sm" />
            </label>
            <label className="block text-xs text-gray-500">Internal note (optional)
              <input type="text" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} className="mt-1 block w-full rounded-lg border px-2 py-1.5 text-sm" />
            </label>
          </div>
        </Dialog>
      )}
    </motion.div>
  );
}

export default AdminFinancePayouts;
