import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';

const sar = (n) => `${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} SAR`;

// Statement months follow Riyadh time (UTC+3), like the backend.
const previousPeriod = () => {
  const riyadhNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const previous = new Date(Date.UTC(riyadhNow.getUTCFullYear(), riyadhNow.getUTCMonth() - 1, 1));
  return `${previous.getUTCFullYear()}-${String(previous.getUTCMonth() + 1).padStart(2, '0')}`;
};

const buildDraft = (statement) => ({
  note: statement.note || '',
  amounts: Object.fromEntries(statement.chapters.map((chapter) => [chapter.courseId, String(chapter.final)])),
});

function AdminFinanceStatements() {
  const { showSuccess, showError } = useUIStore();
  const [period, setPeriod] = useState(previousPeriod);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ statements: [], periodEnded: false, periodLabel: '' });
  const [openId, setOpenId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!period) return;
    setLoading(true);
    try {
      const { data: response } = await financeAPI.getStatements(period);
      setData(response);
      setDrafts(Object.fromEntries(response.statements.map((s) => [s.instructorId, buildDraft(s)])));
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load statements');
    } finally {
      setLoading(false);
    }
  }, [period, showError]);

  useEffect(() => { load(); }, [load]);

  const applyUpdated = (updated) => {
    setData((current) => ({
      ...current,
      statements: current.statements.map((s) => (s.instructorId === updated.instructorId ? updated : s)),
    }));
    setDrafts((current) => ({ ...current, [updated.instructorId]: buildDraft(updated) }));
  };

  const setAmount = (instructorId, courseId, value) => setDrafts((current) => ({
    ...current,
    [instructorId]: {
      ...current[instructorId],
      amounts: { ...current[instructorId].amounts, [courseId]: value },
    },
  }));

  const setNote = (instructorId, value) => setDrafts((current) => ({
    ...current,
    [instructorId]: { ...current[instructorId], note: value },
  }));

  const draftPayload = (statement) => {
    const draft = drafts[statement.instructorId];
    return {
      note: draft.note,
      chapters: statement.chapters.map((chapter) => ({
        courseId: chapter.courseId,
        final: draft.amounts[chapter.courseId],
      })),
    };
  };

  const draftTotal = (statement) => statement.chapters.reduce(
    (sum, chapter) => sum + (Number(drafts[statement.instructorId]?.amounts[chapter.courseId]) || 0),
    0,
  );

  const run = async (action, successMessage) => {
    setBusy(true);
    try {
      const { data: updated } = await action();
      applyUpdated(updated);
      showSuccess(successMessage);
    } catch (error) {
      showError(error.response?.data?.error || 'Action failed');
    } finally {
      setBusy(false);
    }
  };

  const save = (statement) => run(
    () => financeAPI.saveStatement(statement.instructorId, period, draftPayload(statement)),
    'Draft saved. The creator cannot see it yet.',
  );

  const finalize = (statement) => {
    // The exact total confirmed below is sent along; the server refuses to finalize anything else.
    const expectedTotal = Math.round(draftTotal(statement) * 100) / 100;
    const total = sar(expectedTotal);
    const message = statement.hasPublishedVersion
      ? `Finalize the corrected ${data.periodLabel} statement for ${statement.name} at ${total}? The creator will be notified in the app and by email that it was updated.`
      : `Finalize ${data.periodLabel} for ${statement.name} at ${total}? The creator will see this statement and be notified in the app and by email.`;
    if (!window.confirm(message)) return;
    // Save the on-screen edits first so what the admin sees is exactly what gets finalized.
    run(async () => {
      await financeAPI.saveStatement(statement.instructorId, period, draftPayload(statement));
      return financeAPI.finalizeStatement(statement.instructorId, period, expectedTotal);
    }, 'Statement finalized. The creator has been notified.');
  };

  const reopen = (statement) => {
    if (!window.confirm(`Reopen the ${data.periodLabel} statement for ${statement.name}? The creator keeps seeing the current version until you finalize again.`)) return;
    run(() => financeAPI.reopenStatement(statement.instructorId, period), 'Statement reopened for editing.');
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Creator statements</h1>
        <p className="mt-1 text-sm text-gray-500">
          Revenue is calculated automatically, but creators only see a month after you finalize it here.
          Revenue counts in the month a member completed 80% of the chapter.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="text-xs text-gray-500">Month
          <input type="month" value={period} onChange={(e) => { setPeriod(e.target.value); setOpenId(null); }} className="block border rounded-lg px-2 py-1 text-sm" />
        </label>
        {!loading && !data.periodEnded && (
          <p className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
            This month has not ended yet. Figures can still change and it cannot be finalized.
          </p>
        )}
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="rounded-2xl border border-gray-100 bg-white overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="text-left px-3 py-2">Creator</th>
                <th className="text-right px-3 py-2">Calculated</th>
                <th className="text-right px-3 py-2">Final</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.statements.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No creators with chapters yet</td></tr>
              ) : data.statements.map((statement) => {
                const isOpen = openId === statement.instructorId;
                const finalized = statement.status === 'finalized';
                const draft = drafts[statement.instructorId];
                return [
                  <tr key={statement.instructorId} className="border-t">
                    <td className="px-3 py-2">
                      <p className="text-gray-900 font-medium">{statement.name}</p>
                      <p className="text-xs text-gray-400">{statement.email}</p>
                    </td>
                    <td className="px-3 py-2 text-right">{sar(statement.calculatedTotal)}</td>
                    <td className="px-3 py-2 text-right font-semibold">{sar(finalized ? statement.finalTotal : draftTotal(statement))}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${finalized ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
                        {finalized ? 'Finalized' : statement.hasPublishedVersion ? 'Reopened' : 'Draft'}
                      </span>
                      {statement.calculationChanged && (
                        <span className="ml-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Needs review</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setOpenId(isOpen ? null : statement.instructorId)} className="btn-secondary text-xs">
                        {isOpen ? 'Close' : finalized ? 'View' : 'Review'}
                      </button>
                    </td>
                  </tr>,
                  isOpen && draft && (
                    <tr key={`${statement.instructorId}-detail`} className="border-t bg-gray-50/60">
                      <td colSpan={5} className="px-3 py-4">
                        <table className="w-full text-sm bg-white rounded-xl border border-gray-100">
                          <thead className="text-gray-500">
                            <tr>
                              <th className="text-left px-3 py-2">Chapter</th>
                              <th className="text-right px-3 py-2">Enrolled</th>
                              <th className="text-right px-3 py-2">Reached 80%</th>
                              <th className="text-right px-3 py-2">Not yet</th>
                              <th className="text-right px-3 py-2">Calculated</th>
                              <th className="text-right px-3 py-2">Final amount (SAR)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {statement.chapters.length === 0 ? (
                              <tr><td colSpan={6} className="px-3 py-4 text-center text-gray-400">No chapters</td></tr>
                            ) : statement.chapters.map((chapter) => (
                              <tr key={chapter.courseId} className="border-t">
                                <td className="px-3 py-2 text-gray-900">{chapter.title}</td>
                                <td className="px-3 py-2 text-right">{chapter.enrolled}</td>
                                <td className="px-3 py-2 text-right">{chapter.reached}</td>
                                <td className="px-3 py-2 text-right">{chapter.notYet}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{sar(chapter.calculated)}</td>
                                <td className="px-3 py-2 text-right">
                                  {finalized ? (
                                    <span className="font-semibold">{sar(chapter.final)}{chapter.edited ? ' (edited)' : ''}</span>
                                  ) : (
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      value={draft.amounts[chapter.courseId] ?? ''}
                                      onChange={(e) => setAmount(statement.instructorId, chapter.courseId, e.target.value)}
                                      className="w-32 border rounded-lg px-2 py-1 text-sm text-right"
                                    />
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <label className="mt-3 block text-xs text-gray-500">Note shown to the creator (optional)
                          <textarea
                            value={draft.note}
                            onChange={(e) => setNote(statement.instructorId, e.target.value)}
                            disabled={finalized}
                            rows={2}
                            maxLength={2000}
                            className="mt-1 block w-full border rounded-lg px-2 py-1 text-sm disabled:bg-gray-100"
                          />
                        </label>

                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {statement.heldTotal > 0 && (
                            <p className="w-full rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
                              {sar(statement.heldTotal)} of this month's earnings is on hold and is not included in this statement.
                            </p>
                          )}
                          {statement.calculationChanged && (
                            <p className="w-full rounded-lg bg-red-50 px-3 py-1.5 text-xs text-red-700">
                              The calculation changed after this statement was finalized (refund, chargeback or hold):
                              it is now {sar(statement.currentCalculatedTotal)} instead of {sar(statement.calculatedTotal)}.
                              Reopen the statement to review it.
                            </p>
                          )}
                          {finalized ? (
                            <>
                              <span className="text-xs text-gray-500">
                                Finalized {new Date(statement.finalizedAt).toLocaleString()} (version {statement.revision}).
                              </span>
                              <button onClick={() => reopen(statement)} disabled={busy} className="btn-secondary text-xs">Reopen to correct</button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => save(statement)} disabled={busy} className="btn-secondary text-xs">Save draft</button>
                              <button onClick={() => finalize(statement)} disabled={busy || !statement.canFinalize} className="btn-primary text-xs disabled:opacity-50">
                                Finalize and notify creator
                              </button>
                              {statement.hasPublishedVersion && (
                                <span className="text-xs text-amber-700">Creator still sees the previously finalized version.</span>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </div>
      )}
    </motion.div>
  );
}

export default AdminFinanceStatements;
