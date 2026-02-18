import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';

import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Courses from './pages/Courses';
import CourseDetail from './pages/CourseDetail';
import Dashboard from './pages/Dashboard';
import Subscription from './pages/Subscription';
import Payments from './pages/Payments';
import LessonView from './pages/LessonView';
import AdminDashboard from './pages/AdminDashboard';
import AdminPayments from './pages/AdminPayments';
import AdminUsers from './pages/AdminUsers';
import AdminCourses from './pages/AdminCourses';
import AdminSubscriptions from './pages/AdminSubscriptions';
import InstructorDashboard from './pages/InstructorDashboard';
import InstructorCourses from './pages/InstructorCourses';
import InstructorApplication from './pages/InstructorApplication';
import AdminInstructorApplications from './pages/AdminInstructorApplications';

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/apply-instructor" element={<InstructorApplication />} />
        <Route path="/courses" element={<Courses />} />
        <Route path="/courses/:id" element={<CourseDetail />} />
        <Route path="/learn/:id" element={
          <ProtectedRoute>
            <LessonView />
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout type="student" />
          </ProtectedRoute>
        }>
          <Route index element={<Dashboard />} />
          <Route path="subscription" element={<Subscription />} />
          <Route path="payments" element={<Payments />} />
        </Route>

        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout type="admin" />
          </ProtectedRoute>
        }>
          <Route index element={<AdminDashboard />} />
          <Route path="payments" element={<AdminPayments />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="courses" element={<AdminCourses />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="instructor-applications" element={<AdminInstructorApplications />} />
        </Route>

        <Route path="/instructor" element={
          <ProtectedRoute roles={['instructor', 'admin']}>
            <DashboardLayout type="instructor" />
          </ProtectedRoute>
        }>
          <Route index element={<InstructorDashboard />} />
          <Route path="courses" element={<InstructorCourses />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
