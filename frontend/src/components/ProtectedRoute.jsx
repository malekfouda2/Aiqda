import { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import LoadingSpinner from './LoadingSpinner';
import { getDefaultRouteForRole } from '../utils/roles';

function ProtectedRoute({ children, roles = [] }) {
  const { user, isHydrating, hasHydrated, refreshProfile } = useAuthStore();
  const location = useLocation();
  const [isRefreshingAccess, setIsRefreshingAccess] = useState(false);
  const refreshAttemptKeyRef = useRef('');
  const hasRoleAccess = Boolean(
    user
    && (roles.length === 0 || roles.includes(user.role))
  );

  const needsRoleRefresh = Boolean(
    hasHydrated
    && !isHydrating
    && user
    && roles.length > 0
    && !roles.includes(user.role)
  );

  useEffect(() => {
    if (!needsRoleRefresh) {
      return undefined;
    }

    const refreshKey = `${user._id}:${location.pathname}:${location.search}:${roles.join(',')}`;
    if (refreshAttemptKeyRef.current === refreshKey) {
      return undefined;
    }

    refreshAttemptKeyRef.current = refreshKey;
    let active = true;
    setIsRefreshingAccess(true);

    refreshProfile()
      .catch(() => {})
      .finally(() => {
        if (active) {
          setIsRefreshingAccess(false);
        }
      });

    return () => {
      active = false;
    };
  }, [location.pathname, location.search, needsRoleRefresh, refreshProfile, roles, user]);

  if (hasRoleAccess && !isRefreshingAccess) {
    return children;
  }

  if ((!hasHydrated && !user) || (isHydrating && !user) || isRefreshingAccess) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles.length > 0 && !roles.includes(user?.role)) {
    return <Navigate to={getDefaultRouteForRole(user?.role)} replace />;
  }

  return children;
}

export default ProtectedRoute;
