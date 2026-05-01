import { Outlet } from 'react-router-dom';
import { DashboardSidebar, DashboardMobileNav } from '../components/DashboardSidebar';

function DashboardLayout({ type = 'student' }) {
  return (
    <div className="min-h-screen py-8 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DashboardMobileNav type={type} />
        <div className="flex gap-8">
          <DashboardSidebar type={type} />
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;
