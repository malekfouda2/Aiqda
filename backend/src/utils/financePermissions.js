import { isAdminRole } from './roles.js';

// Finance action vocabulary. Routes check these through canDoFinance so a real
// permission system (RBAC) can later replace the implementation in one place.
export const FINANCE_ACTIONS = {
  VIEW_DASHBOARD: 'finance.view_dashboard',
  VIEW_INSTRUCTOR_FINANCIALS: 'finance.view_instructor_financials',
  VIEW_EARNINGS: 'finance.view_earnings',
  MANAGE_EARNINGS: 'finance.manage_earnings',
  APPROVE_PAYOUTS: 'finance.approve_payouts',
  CREATE_PAYOUT_BATCHES: 'finance.create_payout_batches',
  MARK_PAYOUTS_PAID: 'finance.mark_payouts_paid',
  MANAGE_ALLOCATION_SETTINGS: 'finance.manage_allocation_settings',
  MANAGE_ADJUSTMENTS: 'finance.manage_adjustments',
  EXPORT_REPORTS: 'finance.export_reports',
  VIEW_AUDIT_LOGS: 'finance.view_audit_logs',
};

// For now every finance action is granted to full admins only (not applications_admin).
// Swap this body for a granular permission lookup to enable RBAC later.
export const canDoFinance = (user, _action) => Boolean(user) && isAdminRole(user.role);
