export const APPLICATIONS_ADMIN_ROLE = 'applications_admin';

export const ADMIN_PANEL_ROLES = ['admin', APPLICATIONS_ADMIN_ROLE];
export const INSTRUCTOR_PANEL_ROLES = ['instructor', 'admin'];
export const MEMBER_DASHBOARD_ROLES = ['student', 'instructor', 'admin'];

export const isAdminRole = (role) => role === 'admin';
export const isApplicationsAdminRole = (role) => role === APPLICATIONS_ADMIN_ROLE;

export const canAccessAdminPanel = (role) => ADMIN_PANEL_ROLES.includes(role);
export const canAccessInstructorPanel = (role) => INSTRUCTOR_PANEL_ROLES.includes(role);
export const canAccessMemberDashboard = (role) => MEMBER_DASHBOARD_ROLES.includes(role);

export const getDefaultRouteForRole = (role) => {
  if (isApplicationsAdminRole(role)) {
    return '/admin/creator-applications';
  }

  if (isAdminRole(role)) {
    return '/admin';
  }

  if (role === 'instructor') {
    return '/creator';
  }

  return '/dashboard';
};
