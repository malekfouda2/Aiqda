import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
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

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/subscription" element={
          <ProtectedRoute>
            <Subscription />
          </ProtectedRoute>
        } />
        <Route path="/dashboard/payments" element={
          <ProtectedRoute>
            <Payments />
          </ProtectedRoute>
        } />
        <Route path="/learn/:id" element={
          <ProtectedRoute>
            <LessonView />
          </ProtectedRoute>
        } />

        <Route path="/instructor" element={
          <ProtectedRoute roles={['instructor', 'admin']}>
            <InstructorDashboard />
          </ProtectedRoute>
        } />

        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}>
            <AdminDashboard />
          </ProtectedRoute>
        } />
        <Route path="/admin/payments" element={
          <ProtectedRoute roles={['admin']}>
            <AdminPayments />
          </ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['admin']}>
            <AdminUsers />
          </ProtectedRoute>
        } />
        <Route path="/admin/courses" element={
          <ProtectedRoute roles={['admin']}>
            <AdminCourses />
          </ProtectedRoute>
        } />
        <Route path="/admin/subscriptions" element={
          <ProtectedRoute roles={['admin']}>
            <AdminSubscriptions />
          </ProtectedRoute>
        } />
        <Route path="/admin/instructor-applications" element={
          <ProtectedRoute roles={['admin']}>
            <AdminInstructorApplications />
          </ProtectedRoute>
        } />
      </Route>
    </Routes>
  );
}

export default App;
