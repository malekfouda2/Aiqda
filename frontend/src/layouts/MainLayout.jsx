import { Outlet, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Notification from '../components/Notification';
import Footer from '../components/Footer';
import PlatformNoticeGate from '../components/PlatformNoticeGate';
import WhatsAppButton from '../components/WhatsAppButton';

function MainLayout() {
  const location = useLocation();
  const hideFooter = ['/dashboard', '/admin', '/creator', '/development'].some((prefix) =>
    location.pathname.startsWith(prefix)
  );
  const showGlobalWhatsApp = !['/dashboard', '/admin', '/creator'].some((prefix) =>
    location.pathname.startsWith(prefix)
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Notification />
      <PlatformNoticeGate />
      <main className="pt-24 sm:pt-28 xl:pt-32">
        <Outlet />
      </main>
      {!hideFooter && <Footer />}
      {showGlobalWhatsApp && <WhatsAppButton />}
    </div>
  );
}

export default MainLayout;
