import { Outlet } from 'react-router-dom';
import { DashboardSidebar, DashboardMobileNav } from '../components/DashboardSidebar';
import WhatsAppButton from '../components/WhatsAppButton';

function DashboardLayout({ type = 'student' }) {
  return (
    <div className="relative min-h-[calc(100dvh-6rem)] overflow-hidden py-4 sm:min-h-[calc(100dvh-7rem)] sm:py-6 xl:min-h-[calc(100dvh-8rem)] xl:py-8">
      <div className="absolute inset-0 bg-gradient-to-b from-white to-gray-50" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <DashboardMobileNav type={type} />
        <div className="flex gap-4 lg:gap-8">
          <DashboardSidebar type={type} />
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
      {type === 'student' && <WhatsAppButton />}
    </div>
  );
}

export default DashboardLayout;
