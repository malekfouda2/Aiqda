import { Outlet } from 'react-router-dom';
import { DashboardSidebar, DashboardMobileNav } from '../components/DashboardSidebar';

function DashboardLayout({ type = 'student' }) {
  return (
    <div className="min-h-screen py-8 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[500px] h-[500px] bg-primary-100/30 top-[-200px] right-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-cyan-100/30 bottom-[-100px] left-[-50px] animate-float" />
      </div>

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
