import { useState, useEffect, useCallback, Fragment } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { financeAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';
import {
  sar, shortDate, previousPeriod, Badge, StatusBadge, PAYMENT_STATE, EARNING_STATUS,
  FinanceHeader, Dialog, Notice, EmptyRow,
} from '../components/finance/FinanceUI';

const shiftPeriod = (period, delta) => {
  const [year, month] = period.split('-').map(Number);
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`;
};

const buildDraft = (statement) => ({
  note: statement.note || '',
  amounts: Object.fromEntries(statement.chapters.map((chapter) => [chapter.courseId, String(chapter.final)])),
});

const hasActivity = (statement) => (
  statement.calculatedTotal > 0 || statement.finalTotal > 0 || statement.hasEdits
  || statement.status === 'finalized' || statement.hasPublishedVersion || statement.heldTotal > 0
);

const statementBadge = (statement) => {
  if (statement.calculationChanged) return <Badge tone="red">Needs review</Badge>;
  if (statement.status === 'finalized') return <Badge tone="green">Finalized</Badge>;
  if (statement.hasPublishedVersion) return <Badge tone="amber">Reopened</Badge>;
  return <Badge tone="gray">Not finalized</Badge>;
};

function AdminFinanceStatements() {
  const { showSuccess, showError } = useUIStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const period = searchParams.get('period') || previousPeriod();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ statements: [], periodEnded: false, periodLabel: '' });
  const [openId, setOpenId] = useState(searchParams.get('creator'));
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [members, setMembers] = useState(null);

  const setPeriod = (next) => {
    setOpenId(null);
    setSearchParams({ period: next });
  };

  const load = useCallback(async () => {
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
    [instructorId]: { ...current[instructorId], amounts: { ...current[instructorId].amounts, [courseId]: value } },
  }));
  const setNote = (instructorId, value) => setDrafts((current) => ({
    ...current,
    [instructorId]: { ...current[instructorId], note: value },
  }));

  const draftPayload = (statement) => ({
    note: drafts[statement.instructorId].note,
    chapters: statement.chapters.map((chapter) => ({
      courseId: chapter.courseId,
      final: drafts[statement.instructorId].amounts[chapter.courseId],
    })),
  });
  const draftTotal = (statement) => Math.round(statement.chapters.reduce(
    (sum, chapter) => sum + (Number(drafts[statement.instructorId]?.amounts[chapter.courseId]) || 0),
    0,
  ) * 100) / 100;
  const shownTotal = (statement) => (statement.status === 'finalized' ? statement.finalTotal : draftTotal(statement));
  const isDirty = (statement) => {
    const draft = drafts[statement.instructorId];
    return Boolean(draft) && statement.status !== 'finalized' && (
      draft.note !== (statement.note || '')
      || statement.chapters.some((chapter) => Number(draft.amounts[chapter.courseId]) !== chapter.final)
    );
  };

  const run = async (action, successMessage) => {
    setBusy(true);
    try {
      const { data: updated } = await action();
      applyUpdated(updated);
      showSuccess(successMessage);
      setDialog(null);
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
  // Save the on-screen edits first so what the admin sees is exactly what gets finalized;
  // the confirmed total is sent along and the server refuses to finalize anything else.
  const finalize = (statement) => run(async () => {
    await financeAPI.saveStatement(statement.instructorId, period, draftPayload(statement));
    return financeAPI.finalizeStatement(statement.instructorId, period, draftTotal(statement));
  }, 'Statement finalized. The creator has been notified.');
  const reopen = (statement) => run(
    () => financeAPI.reopenStatement(statement.instructorId, period),
    'Statement reopened. The creator still sees the previous version.',
  );

  const active = data.statements.filter(hasActivity);
  const empty = data.statements.filter((s) => !hasActivity(s));
  const visible = showEmpty ? data.statements : active;
  const bulkCandidates = active.filter((s) => s.status !== 'finalized' && (shownTotal(s) > 0 || s.calculatedTotal > 0 || s.hasEdits));
  const bulkTotal = Math.round(bulkCandidates.reduce((sum, s) => sum + s.finalTotal, 0) * 100) / 100;
  const unsaved = bulkCandidates.filter(isDirty);
  const finalizedCount = active.filter((s) => s.status === 'finalized').length;

  const finalizeAll = async () => {
    setBusy(true);
    try {
      const { data: result } = await financeAPI.finalizeAllStatements(period, bulkTotal);
      if (result.failed.length > 0) {
        showError(`${result.finalized} finalized, ${result.failed.length} failed: ${result.failed.map((f) => f.name).join(', ')}`);
      } else {
        showSuccess(`${result.finalized} statement(s) finalized. Creators have been notified.`);
      }
      setDialog(null);
      await load();
    } catch (error) {
      showError(error.response?.data?.error || 'Could not finalize the month');
    } finally {
      setBusy(false);
    }
  };

  const openMembers = async (statement, chapter) => {
    setMembers({ title: `${chapter.title} · ${statement.name}`, rows: null });
    try {
      const { data: rows } = await financeAPI.getStatementChapterMembers(statement.instructorId, period, chapter.courseId);
      setMembers({ title: `${chapter.title} · ${statement.name}`, rows });
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load members');
      setMembers(null);
    }
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-5">
      <FinanceHeader
        title="Creator statements"
        description="Step 1 of 3. Check what each creator earned in a month, adjust if needed, then finalize. Creators see nothing until you finalize."
      >
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setPeriod(shiftPeriod(period, -1))} className="btn-secondary px-3 text-sm" aria-label="Previous month">←</button>
          <input type="month" value={period} onChange={(e) => e.target.value && setPeriod(e.target.value)} className="rounded-lg border px-2 py-1.5 text-sm" />
          <button type="button" onClick={() => setPeriod(shiftPeriod(period, 1))} className="btn-secondary px-3 text-sm" aria-label="Next month">→</button>
        </div>
      </FinanceHeader>

      {loading ? <LoadingSpinner /> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              ['Creators with revenue', active.length],
              ['Calculated', sar(active.reduce((sum, s) => sum + s.calculatedTotal, 0))],
              ['Final (after your edits)', sar(active.reduce((sum, s) => sum + shownTotal(s), 0))],
              ['Finalized', `${finalizedCount} of ${active.length}`],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-gray-100 bg-white p-4">
                <p className="text-xs text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{value}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            {data.periodEnded ? (
              <p className="text-sm text-gray-500">
                {bulkCandidates.length > 0
                  ? `${bulkCandidates.length} statement(s) for ${data.periodLabel} are waiting to be finalized.`
                  : active.length > 0 ? `Everything for ${data.periodLabel} is finalized.` : `No creator earned revenue in ${data.periodLabel}.`}
              </p>
            ) : (
              <Notice>{data.periodLabel} has not ended yet. Figures can still change and nothing can be finalized until it ends.</Notice>
            )}
            {data.periodEnded && bulkCandidates.length > 0 && (
              <button type="button" onClick={() => setDialog({ type: 'finalize-all' })} className="btn-primary text-sm">
                Finalize all {bulkCandidates.length} for {data.periodLabel}
              </button>
            )}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left">Creator</th>
                  <th className="px-4 py-2 text-right">Calculated</th>
                  <th className="px-4 py-2 text-right">Final</th>
                  <th className="px-4 py-2 text-left">Statement</th>
                  <th className="px-4 py-2 text-left">Payout</th>
                  <th className="px-4 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <EmptyRow colSpan={6}>No creator earned revenue in {data.periodLabel}. Revenue appears when a member completes 80% of a chapter.</EmptyRow>
                ) : visible.map((statement) => {
                  const isOpen = openId === statement.instructorId;
                  const finalized = statement.status === 'finalized';
                  const draft = drafts[statement.instructorId];
                  const capped = statement.chapters.reduce((sum, chapter) => sum + chapter.capped, 0);
                  const payoutMismatch = finalized && statement.payment.state !== 'nothing_due' && statement.payment.due !== statement.finalTotal;
                  return (
                    <Fragment key={statement.instructorId}>
                      <tr className={`border-t ${isOpen ? 'bg-gray-50/60' : ''}`}>
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">{statement.name}</p>
                          <p className="text-xs text-gray-400">{statement.email}</p>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{sar(statement.calculatedTotal)}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {sar(shownTotal(statement))}
                          {shownTotal(statement) !== statement.calculatedTotal && <span className="block text-xs font-normal text-amber-700">edited</span>}
                        </td>
                        <td className="px-4 py-3">{statementBadge(statement)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge map={PAYMENT_STATE} status={statement.payment.state} />
                          {statement.payment.paidAt && <span className="block text-xs text-gray-400">{shortDate(statement.payment.paidAt)}</span>}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button type="button" onClick={() => setOpenId(isOpen ? null : statement.instructorId)} className={`${finalized || isOpen ? 'btn-secondary' : 'btn-primary'} text-xs`}>
                            {isOpen ? 'Close' : finalized ? 'View' : 'Review'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && draft && (
                        <tr className="border-t bg-gray-50/60">
                          <td colSpan={6} className="space-y-3 px-4 py-4">
                            {statement.calculationChanged && (
                              <Notice tone="red">
                                A refund, chargeback or hold changed this month after you finalized it: the calculation is
                                now {sar(statement.currentCalculatedTotal)} instead of {sar(statement.calculatedTotal)}. The creator still
                                sees {sar(statement.finalTotal)}. Reopen the statement if you want to correct it.
                              </Notice>
                            )}
                            {statement.heldTotal > 0 && (
                              <Notice>{sar(statement.heldTotal)} of this month is on hold in Earnings and is not included here.</Notice>
                            )}
                            {capped > 0 && (
                              <Notice>
                                {sar(capped)} could not be covered: a member finished a chapter after their payment&apos;s 30% share was
                                already used by another chapter. Add it to the final amount if you want to pay it anyway.
                              </Notice>
                            )}
                            {payoutMismatch && (
                              <Notice tone="red">
                                This statement says {sar(statement.finalTotal)} but the earnings behind it add up to {sar(statement.payment.due)}.
                                Payouts are created from earnings, so check the amount before paying.
                              </Notice>
                            )}

                            <div className="overflow-x-auto rounded-xl border border-gray-100 bg-white">
                              <table className="w-full text-sm">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="px-3 py-2 text-left">Chapter</th>
                                    <th className="px-3 py-2 text-right">Enrolled</th>
                                    <th className="px-3 py-2 text-right">Reached 80%</th>
                                    <th className="px-3 py-2 text-right">Not yet</th>
                                    <th className="px-3 py-2 text-right">Earned this month from</th>
                                    <th className="px-3 py-2 text-right">Calculated</th>
                                    <th className="px-3 py-2 text-right">Final amount (SAR)</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {statement.chapters.length === 0 ? (
                                    <EmptyRow colSpan={7}>This creator has no chapters.</EmptyRow>
                                  ) : statement.chapters.map((chapter) => (
                                    <tr key={chapter.courseId} className="border-t">
                                      <td className="px-3 py-2 text-gray-900">{chapter.title}</td>
                                      <td className="px-3 py-2 text-right">{chapter.enrolled}</td>
                                      <td className="px-3 py-2 text-right">{chapter.reached}</td>
                                      <td className="px-3 py-2 text-right">{chapter.notYet}</td>
                                      <td className="px-3 py-2 text-right">
                                        {chapter.wins > 0 ? (
                                          <button type="button" onClick={() => openMembers(statement, chapter)} className="text-primary-600 underline-offset-2 hover:underline">
                                            {chapter.wins} {chapter.wins === 1 ? 'member' : 'members'}
                                          </button>
                                        ) : <span className="text-gray-400">no one</span>}
                                      </td>
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
                                            className="w-32 rounded-lg border px-2 py-1 text-right text-sm"
                                          />
                                        )}
                                      </td>
                                    </tr>
                                  ))}
                                  <tr className="border-t bg-gray-50 font-semibold">
                                    <td className="px-3 py-2" colSpan={5}>Total</td>
                                    <td className="px-3 py-2 text-right text-gray-500">{sar(statement.calculatedTotal)}</td>
                                    <td className="px-3 py-2 text-right">{sar(shownTotal(statement))}</td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>

                            <label className="block text-xs text-gray-500">Note the creator will see (optional)
                              <textarea
                                value={draft.note}
                                onChange={(e) => setNote(statement.instructorId, e.target.value)}
                                disabled={finalized}
                                rows={2}
                                maxLength={2000}
                                placeholder={finalized ? '' : 'For example: includes a bonus for the launch campaign.'}
                                className="mt-1 block w-full rounded-lg border px-2 py-1 text-sm disabled:bg-gray-100"
                              />
                            </label>

                            <div className="flex flex-wrap items-center gap-2">
                              {finalized ? (
                                <>
                                  <span className="text-xs text-gray-500">
                                    Finalized on {shortDate(statement.finalizedAt)}{statement.revision > 1 ? ` (corrected ${statement.revision - 1} time${statement.revision > 2 ? 's' : ''})` : ''}.
                                  </span>
                                  <button type="button" onClick={() => setDialog({ type: 'reopen', statement })} disabled={busy} className="btn-secondary text-xs">Reopen to correct</button>
                                  {['pending', 'approved'].includes(statement.payment.state) && (
                                    <Link to={`/admin/finance/earnings?period=${period}&creator=${statement.instructorId}`} className="btn-primary text-xs">
                                      Next: approve earnings →
                                    </Link>
                                  )}
                                </>
                              ) : (
                                <>
                                  <button type="button" onClick={() => setDialog({ type: 'finalize', statement })} disabled={busy || !statement.canFinalize} className="btn-primary text-xs disabled:opacity-50">
                                    Finalize and notify creator
                                  </button>
                                  <button type="button" onClick={() => save(statement)} disabled={busy || !isDirty(statement)} className="btn-secondary text-xs disabled:opacity-50">Save draft</button>
                                  {isDirty(statement) && <span className="text-xs text-amber-700">Unsaved changes</span>}
                                  {statement.hasPublishedVersion && <span className="text-xs text-gray-500">The creator still sees the previously finalized version.</span>}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {empty.length > 0 && (
            <button type="button" onClick={() => setShowEmpty((value) => !value)} className="text-sm text-gray-500 hover:text-gray-800">
              {showEmpty ? 'Hide' : 'Show'} {empty.length} creator{empty.length === 1 ? '' : 's'} with no revenue this month
            </button>
          )}
        </>
      )}

      {dialog?.type === 'finalize' && (
        <Dialog
          title={`Finalize ${data.periodLabel} for ${dialog.statement.name}?`}
          onClose={() => setDialog(null)}
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" onClick={() => finalize(dialog.statement)} disabled={busy} className="btn-primary text-sm disabled:opacity-60">
                {busy ? 'Finalizing…' : `Finalize at ${sar(draftTotal(dialog.statement))}`}
              </button>
            </>
          )}
        >
          <p className="text-2xl font-semibold text-gray-900">{sar(draftTotal(dialog.statement))}</p>
          <ul className="mt-3 list-disc space-y-1 pl-5">
            <li>The creator will see this statement on their dashboard.</li>
            <li>They get a notification in the app and an email{dialog.statement.hasPublishedVersion ? ' saying it was updated' : ''}.</li>
            <li>You can still reopen and correct it later.</li>
          </ul>
        </Dialog>
      )}

      {dialog?.type === 'reopen' && (
        <Dialog
          title={`Reopen ${data.periodLabel} for ${dialog.statement.name}?`}
          onClose={() => setDialog(null)}
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" onClick={() => reopen(dialog.statement)} disabled={busy} className="btn-primary text-sm disabled:opacity-60">Reopen</button>
            </>
          )}
        >
          <p>The statement becomes editable again. The creator keeps seeing the current version until you finalize again, and is then told it was updated.</p>
        </Dialog>
      )}

      {dialog?.type === 'finalize-all' && (
        <Dialog
          title={`Finalize ${data.periodLabel} for ${bulkCandidates.length} creator${bulkCandidates.length === 1 ? '' : 's'}?`}
          onClose={() => setDialog(null)}
          footer={(
            <>
              <button type="button" onClick={() => setDialog(null)} className="btn-secondary text-sm">Cancel</button>
              <button type="button" onClick={finalizeAll} disabled={busy || unsaved.length > 0} className="btn-primary text-sm disabled:opacity-60">
                {busy ? 'Finalizing…' : `Finalize all at ${sar(bulkTotal)}`}
              </button>
            </>
          )}
        >
          {unsaved.length > 0 && (
            <div className="mb-3">
              <Notice tone="red">Save or finalize your unsaved edits first: {unsaved.map((s) => s.name).join(', ')}.</Notice>
            </div>
          )}
          <table className="w-full text-sm">
            <tbody>
              {bulkCandidates.map((statement) => (
                <tr key={statement.instructorId} className="border-b last:border-0">
                  <td className="py-1.5">{statement.name}</td>
                  <td className="py-1.5 text-right font-medium">
                    {sar(statement.finalTotal)}{statement.finalTotal !== statement.calculatedTotal ? ' (edited)' : ''}
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className="pt-2">Total</td>
                <td className="pt-2 text-right">{sar(bulkTotal)}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            Each creator is notified in the app and by email. Creators with no revenue this month are skipped.
          </p>
        </Dialog>
      )}

      {members && (
        <Dialog title={members.title} onClose={() => setMembers(null)} wide footer={<button type="button" onClick={() => setMembers(null)} className="btn-secondary text-sm">Close</button>}>
          <p className="mb-3 text-xs text-gray-500">
            Members who completed 80% of this chapter in {data.periodLabel}. Each one pays the creator once: 30% of their
            latest payment, divided by the chapters they were enrolled in. Only admins can see this list.
          </p>
          {!members.rows ? <LoadingSpinner /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-gray-500">
                  <tr>
                    <th className="py-1.5 text-left">Member</th>
                    <th className="py-1.5 text-left">Reached 80%</th>
                    <th className="py-1.5 text-right">Payment</th>
                    <th className="py-1.5 text-right">Enrolled in</th>
                    <th className="py-1.5 text-right">Creator gets</th>
                    <th className="py-1.5 pl-3 text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {members.rows.map((row) => (
                    <tr key={row.id} className={`border-t ${row.counted ? '' : 'text-gray-400'}`}>
                      <td className="py-1.5">
                        {row.member}
                        <span className="block text-xs text-gray-400">{row.email}</span>
                      </td>
                      <td className="py-1.5">{shortDate(row.reachedAt)}</td>
                      <td className="py-1.5 text-right">
                        {sar(row.paymentAmount)}
                        {row.paymentRefunded > 0 && <span className="block text-xs text-rose-600">{sar(row.paymentRefunded)} refunded</span>}
                      </td>
                      <td className="py-1.5 text-right">{row.enrolledChapters} chapter{row.enrolledChapters === 1 ? '' : 's'}</td>
                      <td className="py-1.5 text-right font-medium">
                        {sar(row.amount)}
                        {row.counted && row.amount < row.share && <span className="block text-xs font-normal text-amber-700">of {sar(row.share)}, payment share used up</span>}
                      </td>
                      <td className="py-1.5 pl-3"><StatusBadge map={EARNING_STATUS} status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Dialog>
      )}
    </motion.div>
  );
}

export default AdminFinanceStatements;
