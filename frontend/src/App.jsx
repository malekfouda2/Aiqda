import { Suspense, lazy } from 'react';
import { Routes, Route } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const InstructorSetup = lazy(() => import('./pages/InstructorSetup'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Payments = lazy(() => import('./pages/Payments'));
const LessonView = lazy(() => import('./pages/LessonView'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminContactMessages = lazy(() => import('./pages/AdminContactMessages'));
const AdminPayments = lazy(() => import('./pages/AdminPayments'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminCourses = lazy(() => import('./pages/AdminCourses'));
const AdminSubscriptions = lazy(() => import('./pages/AdminSubscriptions'));
const InstructorDashboard = lazy(() => import('./pages/InstructorDashboard'));
const InstructorCourses = lazy(() => import('./pages/InstructorCourses'));
const InstructorApplication = lazy(() => import('./pages/InstructorApplication'));
const StudioApplication = lazy(() => import('./pages/StudioApplication'));
const AdminInstructors = lazy(() => import('./pages/AdminInstructors'));
const AdminInstructorApplications = lazy(() => import('./pages/AdminInstructorApplications'));
const AdminStudioApplications = lazy(() => import('./pages/AdminStudioApplications'));
const Consultations = lazy(() => import('./pages/Consultations'));
const ConsultationDetail = lazy(() => import('./pages/ConsultationDetail'));
const MyConsultations = lazy(() => import('./pages/MyConsultations'));
const AdminConsultations = lazy(() => import('./pages/AdminConsultations'));
const AdminConsultationBookings = lazy(() => import('./pages/AdminConsultationBookings'));

function RouteLoadingFallback() {
  return (
    <div className="flex items-center justify-center py-20 min-h-[50vh]">
      <LoadingSpinner size="lg" text="Loading page..." />
    </div>
  );
}

const renderLazyPage = (PageComponent) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <PageComponent />
  </Suspense>
);

function App() {
  return (
    <Routes>
      <Route element={<MainLayout />}>
        <Route path="/" element={renderLazyPage(Home)} />
        <Route path="/about" element={renderLazyPage(About)} />
        <Route path="/contact-us" element={renderLazyPage(ContactUs)} />
        <Route path="/login" element={renderLazyPage(Login)} />
        <Route path="/register" element={renderLazyPage(Register)} />
        <Route path="/instructor-setup" element={renderLazyPage(InstructorSetup)} />
        <Route path="/apply-instructor" element={renderLazyPage(InstructorApplication)} />
        <Route path="/apply-studio" element={renderLazyPage(StudioApplication)} />
        <Route path="/consultations" element={renderLazyPage(Consultations)} />
        <Route path="/consultations/:id" element={renderLazyPage(ConsultationDetail)} />
        <Route path="/courses" element={renderLazyPage(Courses)} />
        <Route path="/courses/:id" element={renderLazyPage(CourseDetail)} />
        <Route path="/learn/:id" element={
          <ProtectedRoute>
            {renderLazyPage(LessonView)}
          </ProtectedRoute>
        } />

        <Route path="/dashboard" element={
          <ProtectedRoute>
            <DashboardLayout type="student" />
          </ProtectedRoute>
        }>
          <Route index element={renderLazyPage(Dashboard)} />
          <Route path="consultations" element={renderLazyPage(MyConsultations)} />
          <Route path="subscription" element={renderLazyPage(Subscription)} />
          <Route path="payments" element={renderLazyPage(Payments)} />
        </Route>

        <Route path="/admin" element={
          <ProtectedRoute roles={['admin']}>
            <DashboardLayout type="admin" />
          </ProtectedRoute>
        }>
          <Route index element={renderLazyPage(AdminDashboard)} />
          <Route path="contact-messages" element={renderLazyPage(AdminContactMessages)} />
          <Route path="payments" element={renderLazyPage(AdminPayments)} />
          <Route path="users" element={renderLazyPage(AdminUsers)} />
          <Route path="courses" element={renderLazyPage(AdminCourses)} />
          <Route path="subscriptions" element={renderLazyPage(AdminSubscriptions)} />
          <Route path="instructors" element={renderLazyPage(AdminInstructors)} />
          <Route path="instructor-applications" element={renderLazyPage(AdminInstructorApplications)} />
          <Route path="studio-applications" element={renderLazyPage(AdminStudioApplications)} />
          <Route path="consultations" element={renderLazyPage(AdminConsultations)} />
          <Route path="consultation-bookings" element={renderLazyPage(AdminConsultationBookings)} />
        </Route>

        <Route path="/instructor" element={
          <ProtectedRoute roles={['instructor', 'admin']}>
            <DashboardLayout type="instructor" />
          </ProtectedRoute>
        }>
          <Route index element={renderLazyPage(InstructorDashboard)} />
          <Route path="courses" element={renderLazyPage(InstructorCourses)} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
