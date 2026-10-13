import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';
import {
  sar, monthLabel, StatusBadge, EARNING_STATUS, FinanceHeader, Dialog, Notice,
} from '../components/finance/FinanceUI';

// Each view answers one question the admin has at this step.
const VIEWS = [
  { key: 'ready', label: 'Ready to approve', params: { ready: 'true' }, empty: 'Nothing is waiting for approval.' },
  { key: 'approved', label: 'Approved, not paid yet', params: { status: 'approved_for_payout' }, empty: 'No approved earnings are waiting for a payout.' },
  { key: 'current', label: 'This month (not final)', params: { status: 'eligible' }, empty: 'No earnings so far this month.' },
  { key: 'hold', label: 'On hold', params: { status: 'on_hold' }, empty: 'Nothing is on hold.' },
  { key: 'paid', label: 'Paid', params: { status: 'paid' }, empty: 'No earnings have been paid yet.' },
  { key: 'all', label: 'All', params: {}, empty: 'No earnings yet. An earning appears when a member completes 80% of a chapter.' },
];

const REASON_ACTIONS = {
  hold: { title: 'Put this earning on hold?', body: 'It is left out of the creator’s statement and cannot be paid until you release it.', button: 'Put on hold', success: 'Earning put on hold' },
  void: { title: 'Cancel this earning?', body: 'The creator will not be paid for it. This cannot be undone.', button: 'Cancel earning', success: 'Earning cancelled' },
};

function AdminFinanceEarnings() {
  const { showSuccess, showError } = useUIStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = VIEWS.find((v) => v.key === searchParams.get('view')) || VIEWS[0];
  const period = searchParams.get('period') || '';
  const creator = searchParams.get('creator') || '';
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState('');

  const setParam = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    setSearchParams(next);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { ...view.params };
      if (period) params.period = period;
      if (creator) params.instructor = creator;
      const { data } = await financeAPI.getEarnings(params);
      // "This month" means earnings whose month is still open; "ready" is already filtered by the server.
      setRows(view.key === 'current' ? data.filter((r) => !r.monthEnded) : data);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load earnings');
    } finally {
      setLoading(false);
    }
  }, [view, period, creator, showError]);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => {
    const byCreator = new Map();
    for (const row of rows) {
      const key = String(row.instructorId);
      if (!byCreator.has(key)) byCreator.set(key, { id: key, name: row.instructor || 'Unknown creator', rows: [] });
      byCreator.get(key).rows.push(row);
    }
    return [...byCreator.values()].map((group) => {
      const approvable = group.rows.filter((r) => r.status === 'eligible' && r.monthEnded);
      const payable = group.rows.filter((r) => r.status === 'approved_for_payout' && !r.inPayoutBatch);
      return {
        ...group,
        approvable,
        payable,
        approvableTotal: approvable.reduce((sum, r) => sum + r.eligible, 0),
        payableTotal: payable.reduce((sum, r) => sum + (r.approved - r.paid), 0),
        total: group.rows.reduce((sum, r) => sum + (r.status === 'voided' ? 0 : r.eligible), 0),
      };
    });
  }, [rows]);

  const allApprovable = groups.flatMap((g) => g.approvable);
  const allApprovableTotal = groups.reduce((sum, g) => sum + g.approvableTotal, 0);

  const bulk = async (earningIds, action, successMessage, actionReason = '') => {
    setBusy(true);
    try {
      const { data } = await financeAPI.bulkEarnings({ earningIds, action, reason: actionReason });
      if (data.updated < earningIds.length) {
        showError(`${data.updated} of ${earningIds.length} updated. The rest are no longer in a state that allows this.`);
      } else {
        showSuccess(successMessage);
      }
      setDialog(null);
      setReason('');
      await load();
    } catch (error) {
      showError(error.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const createPayout = async (group) => {
    setBusy(true);
    try {
      await financeAPI.createPayoutBatch({ instructor: group.id, earningIds: group.payable.map((r) => r.id) });
      showSuccess('Payout created. Approve and pay it in step 3.');
      setDialog(null);
      await load();
    } catch (error) {
      showError(error.response?.data?.error || 'Could not create the payout');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = async () => {
    try {
      const params = { ...view.params };
      if (period) params.period = period;
      if (creator) params.instructor = creator;
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
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-5">
      <FinanceHeader
        title="Earnings"
        description="Step 2 of 3. Every time a member completes 80% of a chapter, its creator gets one earning. Approve the earnings of finished months, then create a payout for each creator."
      >
        <button type="button" onClick={exportCsv} className="btn-secondary text-sm">Export CSV</button>
      </FinanceHeader>

      <div className="flex flex-wrap items-center gap-2">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => setParam('view', v.key === 'ready' ? '' : v.key)}
            className={`rounded-full px-3 py-1.5 text-sm ${view.key === v.key ? 'bg-primary-50 font-semibold text-primary-700 ring-1 ring-primary-200' : 'text-gray-600 hover:bg-gray-100'}`}
          >
            {v.label}
          </button>
        ))}
        <span className="mx-1 text-gray-200">|</span>
        <label className="flex items-center gap-2 text-xs text-gray-500">Month
          <input type="month" value={period} onChange={(e) => setParam('period', e.target.value)} className="rounded-lg border px-2 py-1 text-sm" />
        </label>
        {(period || creator) && (
          <button type="button" onClick={() => setSearchParams(view.key === 'ready' ? {} : { view: view.key })} className="text-xs text-primary-600 hover:underline">
            Clear filters
          </button>
        )}
      </div>

      {view.key === 'current' && (
        <Notice tone="blue">
          These amounts are not final. A member&apos;s payment is split over the chapters they are enrolled in by the end of the month,
          so they can still change. They can be approved once the month ends.
        </Notice>
      )}

      {loading ? <LoadingSpinner /> : groups.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-4 py-10 text-center text-sm text-gray-400">{view.empty}</div>
      ) : (
        <>
          {allApprovable.length > 0 && groups.length > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <p className="text-sm text-gray-600">{allApprovable.length} earnings for {groups.filter((g) => g.approvable.length).length} creators are ready: {sar(allApprovableTotal)}</p>
              <button type="button" onClick={() => setDialog({ type: 'approve', ids: allApprovable.map((r) => r.id), total: allApprovableTotal, who: 'all creators' })} className="btn-primary text-sm">
                Approve all
              </button>
            </div>
          )}

          {groups.map((group) => (
            <div key={group.id} className="overflow-hidden rounded-2xl border border-gray-100 bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50 px-4 py-3">
                <div>
                  <Link to={`/admin/finance/instructors/${group.id}`} className="font-semibold text-gray-900 hover:underline">{group.name}</Link>
                  <p className="text-xs text-gray-500">{group.rows.length} earning{group.rows.length === 1 ? '' : 's'} · {sar(group.total)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group.approvable.length > 0 && (
                    <button type="button" disabled={busy} onClick={() => setDialog({ type: 'approve', ids: group.approvable.map((r) => r.id), total: group.approvableTotal, who: group.name })} className="btn-primary text-xs">
                      Approve {group.approvable.length} · {sar(group.approvableTotal)}
                    </button>
                  )}
                  {group.payable.length > 0 && (
                    <button type="button" disabled={busy} onClick={() => setDialog({ type: 'payout', group })} className="btn-primary text-xs">
                      Create payout · {sar(group.payableTotal)}
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-gray-500">
                    <tr>
                      <th className="px-4 py-2 text-left">Member</th>
                      <th className="px-4 py-2 text-left">Chapter</th>
                      <th className="px-4 py-2 text-left">Month</th>
                      <th className="px-4 py-2 text-right">Amount</th>
                      <th className="px-4 py-2 text-left">Status</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((row) => (
                      <tr key={row.id} className="border-t">
                        <td className="px-4 py-2 text-gray-900">{row.learner || 'Deleted member'}</td>
                        <td className="px-4 py-2">{row.course || 'Deleted chapter'}</td>
                        <td className="px-4 py-2 text-gray-500">{monthLabel(row.period)}</td>
                        <td className="px-4 py-2 text-right font-medium">
                          {sar(row.status === 'approved_for_payout' || row.status === 'partially_paid' || row.status === 'paid' ? row.approved : row.eligible)}
                          {row.paid > 0 && row.status !== 'paid' && <span className="block text-xs font-normal text-gray-400">{sar(row.paid)} paid</span>}
                        </td>
                        <td className="px-4 py-2">
                          <StatusBadge map={EARNING_STATUS} status={row.status} />
                          {row.status === 'eligible' && !row.monthEnded && <span className="block text-xs text-gray-400">final after {monthLabel(row.period)} ends</span>}
                          {row.status === 'approved_for_payout' && row.inPayoutBatch && <span className="block text-xs text-gray-400">in a payout</span>}
                          {row.status === 'on_hold' && row.holdReason && <span className="block text-xs text-gray-400">{row.holdReason}</span>}
                        </td>
                        <td className="whitespace-nowrap px-4 py-2 text-right text-xs">
                          {['eligible', 'approved_for_payout'].includes(row.status) && !row.inPayoutBatch && (
                            <button type="button" onClick={() => setDialog({ type: 'hold', ids: [row.id] })} className="text-gray-500 hover:text-gray-900 hover:underline">Hold</button>
                          )}
                          {row.status === 'on_hold' && (
                            <>
                              <button type="button" disabled={busy} onClick={() => bulk([row.id], 'release', 'Earning released')} className="text-primary-600 hover:underline">Release</button>
                              <button type="button" onClick={() => setDialog({ type: 'void', ids: [row.id] })} className="ml-3 text-rose-600 hover:underline">Cancel</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      )}

      {dialog?.type === 'approve' && (
        <Dialog
          title={`Approve ${dialog.ids.length} earning${dialog.ids.length === 1 ? '' : 's'}?`}
          onClose={() => setDialog(null)}
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" disabled={busy} onClick={() => bulk(dialog.ids, 'approve', 'Earnings approved. Next: create the payout.')} className="btn-primary text-sm disabled:opacity-60">
                Approve {sar(dialog.total)}
              </button>
            </>
          )}
        >
          <p className="text-2xl font-semibold text-gray-900">{sar(dialog.total)}</p>
          <p className="mt-2">For {dialog.who}. Approving fixes these amounts and makes them available for a payout. No money moves yet.</p>
        </Dialog>
      )}

      {dialog?.type === 'payout' && (
        <Dialog
          title={`Create a payout for ${dialog.group.name}?`}
          onClose={() => setDialog(null)}
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" disabled={busy} onClick={() => createPayout(dialog.group)} className="btn-primary text-sm disabled:opacity-60">Create payout</button>
            </>
          )}
        >
          <p className="text-2xl font-semibold text-gray-900">{sar(dialog.group.payableTotal)}</p>
          <p className="mt-2">
            Groups {dialog.group.payable.length} approved earning{dialog.group.payable.length === 1 ? '' : 's'} into one payment.
            If this creator owes money back from an earlier refund, it is deducted automatically. You record the bank transfer in step 3.
          </p>
        </Dialog>
      )}

      {REASON_ACTIONS[dialog?.type] && (
        <Dialog
          title={REASON_ACTIONS[dialog.type].title}
          onClose={() => { setDialog(null); setReason(''); }}
          footer={(
            <>
              <button type="button" onClick={() => { setDialog(null); setReason(''); }} className="btn-secondary text-sm">Back</button>
              <button type="button" disabled={busy || !reason.trim()} onClick={() => bulk(dialog.ids, dialog.type, REASON_ACTIONS[dialog.type].success, reason.trim())} className="btn-primary text-sm disabled:opacity-60">
                {REASON_ACTIONS[dialog.type].button}
              </button>
            </>
          )}
        >
          <p>{REASON_ACTIONS[dialog.type].body}</p>
          <label className="mt-3 block text-xs text-gray-500">Reason (kept in the audit log)
            <input autoFocus type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 block w-full rounded-lg border px-2 py-1.5 text-sm" />
          </label>
        </Dialog>
      )}
    </motion.div>
  );
}

export default AdminFinanceEarnings;
