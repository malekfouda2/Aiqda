import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import LoadingSpinner from './LoadingSpinner';

function ProtectedRoute({ children, roles = [] }) {
  const { user, isHydrating, hasHydrated } = useAuthStore();
  const location = useLocation();

  if (!hasHydrated || isHydrating) {
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
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export default ProtectedRoute;
