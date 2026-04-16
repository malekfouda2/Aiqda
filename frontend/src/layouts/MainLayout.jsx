import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Notification from '../components/Notification';
import Footer from '../components/Footer';
import PlatformNoticeGate from '../components/PlatformNoticeGate';

function MainLayout() {
  const location = useLocation();
  const hideFooter = ['/dashboard', '/admin', '/instructor', '/learn'].some((prefix) =>
    location.pathname.startsWith(prefix)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Notification />
      <PlatformNoticeGate />
      <main className="pt-20">
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
    </div>
  );
}

export default MainLayout;
