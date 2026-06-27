import FinanceAudit from './financeAudit.model.js';

// Append-only audit writer. Never throws into the calling business flow.
export const recordFinanceAudit = async ({
  actorType = 'system',
  actorId = null,
  action,
  targetType,
  targetId = null,
  oldState = null,
  newState = null,
  reason = '',
  relatedRef = '',
}) => {
  try {
    return await FinanceAudit.create({
      actorType, actorId, action, targetType, targetId, oldState, newState, reason, relatedRef,
    });
  } catch (error) {
    console.error('Finance audit write failed:', error?.message || error);
    return null;
  }
};

export const getAuditLog = async (filters = {}) => {
  const query = {};
  if (filters.targetType) query.targetType = filters.targetType;
  if (filters.targetId) query.targetId = filters.targetId;
  if (filters.action) query.action = filters.action;
  return FinanceAudit.find(query)
    .populate('actorId', 'name email')
    .sort({ createdAt: -1 })
    .limit(Number(filters.limit) || 200)
    .lean();
};
