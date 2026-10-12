import InstructorEarning from '../modules/finance/instructorEarning.model.js';
import ChapterEntitlement from '../modules/finance/chapterEntitlement.model.js';

// Earnings used to be pre-created at payment time, one `pending_completion` row per chapter of
// the tier. They are now created only when a member completes a chapter, so the old placeholders
// carry no money and would collide with real earnings on the same payment. Idempotent.
export const removeLegacyPendingEarnings = async () => {
  const pending = await InstructorEarning.find({ status: 'pending_completion' })
    .select('_id chapterEntitlement')
    .lean();
  if (pending.length === 0) return { removedEarnings: 0 };

  await InstructorEarning.deleteMany({ _id: { $in: pending.map((earning) => earning._id) } });
  const entitlementIds = pending.map((earning) => earning.chapterEntitlement).filter(Boolean);
  const stillUsed = await InstructorEarning.distinct('chapterEntitlement', { chapterEntitlement: { $in: entitlementIds } });
  await ChapterEntitlement.deleteMany({
    _id: { $in: entitlementIds, $nin: stillUsed },
  });
  return { removedEarnings: pending.length };
};
