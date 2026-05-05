export const USER_ROLES = ['student', 'instructor', 'admin', 'applications_admin'];

export const ADMIN_ROLE = 'admin';
export const APPLICATIONS_ADMIN_ROLE = 'applications_admin';

export const APPLICATION_REVIEW_ROLES = [ADMIN_ROLE, APPLICATIONS_ADMIN_ROLE];
export const INSTRUCTOR_ACCESS_ROLES = ['instructor', ADMIN_ROLE];
export const CONTENT_ACCESS_ROLES = ['student', 'instructor', ADMIN_ROLE];

export const isAdminRole = (role) => role === ADMIN_ROLE;
export const isApplicationsAdminRole = (role) => role === APPLICATIONS_ADMIN_ROLE;
export const isBackofficeRole = (role) => APPLICATION_REVIEW_ROLES.includes(role);
