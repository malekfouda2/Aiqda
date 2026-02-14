import { Outlet } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Notification from '../components/Notification';

function MainLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Notification />
      <main className="pt-20">
        <Outlet />
      </main>
    </div>
  );
}

export default MainLayout;
