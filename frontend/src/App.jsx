import { Suspense, lazy, useEffect } from 'react';
import { Navigate, Routes, Route, useLocation, useParams } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import DashboardLayout from './layouts/DashboardLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingSpinner from './components/LoadingSpinner';
import ScrollToTop from './components/ScrollToTop';
import { useLocale } from './i18n/useLocale';
import useAuthStore from './store/authStore';
import { ADMIN_PANEL_ROLES, INSTRUCTOR_PANEL_ROLES, MEMBER_DASHBOARD_ROLES, isApplicationsAdminRole } from './utils/roles';

const Home = lazy(() => import('./pages/Home'));
const About = lazy(() => import('./pages/About'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsAndConditions = lazy(() => import('./pages/TermsAndConditions'));
const TermsAndConditionsForUsers = lazy(() => import('./pages/TermsAndConditionsForUsers'));
const RefundPolicy = lazy(() => import('./pages/RefundPolicy'));
const UserContentAccessPolicy = lazy(() => import('./pages/UserContentAccessPolicy'));
const StudioContentSubmissionFramework = lazy(() => import('./pages/StudioContentSubmissionFramework'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const SocialAuthCallback = lazy(() => import('./pages/SocialAuthCallback'));
const InstructorSetup = lazy(() => import('./pages/InstructorSetup'));
const Courses = lazy(() => import('./pages/Courses'));
const CourseDetail = lazy(() => import('./pages/CourseDetail'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Subscription = lazy(() => import('./pages/Subscription'));
const Payments = lazy(() => import('./pages/Payments'));
const LessonView = lazy(() => import('./pages/LessonView'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminContactMessages = lazy(() => import('./pages/AdminContactMessages'));
const AdminWhatsAppSettings = lazy(() => import('./pages/AdminWhatsAppSettings'));
const AdminTeamMembers = lazy(() => import('./pages/AdminTeamMembers'));
const AdminPartners = lazy(() => import('./pages/AdminPartners'));
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
  const { t } = useLocale();

  return (
    <div className="flex items-center justify-center py-20 min-h-[50vh]">
      <LoadingSpinner size="lg" text={t('loading.page')} />
    </div>
  );
}

const renderLazyPage = (PageComponent) => (
  <Suspense fallback={<RouteLoadingFallback />}>
    <PageComponent />
  </Suspense>
);

function LegacyPathRedirect({ to }) {
  const location = useLocation();

  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}

function LegacyEntityRedirect({ basePath }) {
  const location = useLocation();
  const { id } = useParams();

  return <Navigate to={`${basePath}/${id}${location.search}${location.hash}`} replace />;
}

function AdminIndexRoute() {
  const role = useAuthStore((state) => state.user?.role);

  if (isApplicationsAdminRole(role)) {
    return <Navigate to="creator-applications" replace />;
  }

  return renderLazyPage(AdminDashboard);
}

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const refreshProfile = useAuthStore((state) => state.refreshProfile);
  const userId = useAuthStore((state) => state.user?._id);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    if (!userId) {
      return undefined;
    }

    const syncSessionProfile = () => {
      if (typeof document === 'undefined' || document.visibilityState === 'visible') {
        refreshProfile();
      }
    };

    window.addEventListener('focus', syncSessionProfile);
    document.addEventListener('visibilitychange', syncSessionProfile);

    return () => {
      window.removeEventListener('focus', syncSessionProfile);
      document.removeEventListener('visibilitychange', syncSessionProfile);
    };
  }, [refreshProfile, userId]);

  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<MainLayout />}>
          <Route path="/" element={renderLazyPage(Home)} />
          <Route path="/about" element={renderLazyPage(About)} />
          <Route path="/contact-us" element={renderLazyPage(ContactUs)} />
          <Route path="/privacy-policy" element={renderLazyPage(PrivacyPolicy)} />
          <Route path="/terms-and-conditions" element={renderLazyPage(TermsAndConditionsForUsers)} />
          <Route path="/terms-and-conditions-for-creators" element={renderLazyPage(TermsAndConditions)} />
          <Route path="/terms-and-conditions-for-users" element={renderLazyPage(TermsAndConditionsForUsers)} />
          <Route path="/refund-policy" element={renderLazyPage(RefundPolicy)} />
          <Route path="/user-content-access-policy" element={renderLazyPage(UserContentAccessPolicy)} />
          <Route
            path="/studio-content-submission-framework"
            element={renderLazyPage(StudioContentSubmissionFramework)}
          />
          <Route path="/login" element={renderLazyPage(Login)} />
          <Route path="/register" element={renderLazyPage(Register)} />
          <Route path="/auth/social/callback" element={renderLazyPage(SocialAuthCallback)} />
          <Route path="/instructor-setup" element={<LegacyPathRedirect to="/creator-setup" />} />
          <Route path="/apply-instructor" element={<LegacyPathRedirect to="/apply-creator" />} />
          <Route path="/courses" element={<LegacyPathRedirect to="/chapters" />} />
          <Route path="/courses/:id" element={<LegacyEntityRedirect basePath="/chapters" />} />
          <Route path="/learn/:id" element={<LegacyEntityRedirect basePath="/development" />} />
          <Route path="/instructor/courses" element={<LegacyPathRedirect to="/creator/chapters" />} />
          <Route path="/instructor" element={<LegacyPathRedirect to="/creator" />} />
          <Route path="/admin/courses" element={<LegacyPathRedirect to="/admin/chapters" />} />
          <Route path="/admin/instructors" element={<LegacyPathRedirect to="/admin/creators" />} />
          <Route path="/admin/instructor-applications" element={<LegacyPathRedirect to="/admin/creator-applications" />} />
          <Route path="/creator-setup" element={renderLazyPage(InstructorSetup)} />
          <Route path="/apply-creator" element={renderLazyPage(InstructorApplication)} />
          <Route path="/apply-studio" element={renderLazyPage(StudioApplication)} />
          <Route path="/consultations" element={renderLazyPage(Consultations)} />
          <Route path="/consultations/:id" element={renderLazyPage(ConsultationDetail)} />
          <Route path="/chapters" element={renderLazyPage(Courses)} />
          <Route path="/chapters/:id" element={renderLazyPage(CourseDetail)} />
          <Route path="/development/:id" element={
            <ProtectedRoute>
              {renderLazyPage(LessonView)}
            </ProtectedRoute>
          } />

          <Route path="/dashboard" element={
            <ProtectedRoute roles={MEMBER_DASHBOARD_ROLES}>
              <DashboardLayout type="student" />
            </ProtectedRoute>
          }>
            <Route index element={renderLazyPage(Dashboard)} />
            <Route path="consultations" element={renderLazyPage(MyConsultations)} />
            <Route path="subscription" element={renderLazyPage(Subscription)} />
            <Route path="payments" element={renderLazyPage(Payments)} />
          </Route>

          <Route path="/admin" element={
            <ProtectedRoute roles={ADMIN_PANEL_ROLES}>
              <DashboardLayout type="admin" />
            </ProtectedRoute>
          }>
            <Route index element={<AdminIndexRoute />} />
            <Route path="contact-messages" element={renderLazyPage(AdminContactMessages)} />
            <Route path="whatsapp-settings" element={renderLazyPage(AdminWhatsAppSettings)} />
            <Route path="team-members" element={renderLazyPage(AdminTeamMembers)} />
            <Route path="partners" element={renderLazyPage(AdminPartners)} />
            <Route path="payments" element={renderLazyPage(AdminPayments)} />
            <Route path="users" element={renderLazyPage(AdminUsers)} />
            <Route path="chapters" element={renderLazyPage(AdminCourses)} />
            <Route path="subscriptions" element={renderLazyPage(AdminSubscriptions)} />
            <Route path="creators" element={renderLazyPage(AdminInstructors)} />
            <Route path="creator-applications" element={renderLazyPage(AdminInstructorApplications)} />
            <Route path="studio-applications" element={renderLazyPage(AdminStudioApplications)} />
            <Route path="consultations" element={renderLazyPage(AdminConsultations)} />
            <Route path="consultation-bookings" element={renderLazyPage(AdminConsultationBookings)} />
          </Route>

          <Route path="/creator" element={
            <ProtectedRoute roles={INSTRUCTOR_PANEL_ROLES}>
              <DashboardLayout type="instructor" />
            </ProtectedRoute>
          }>
            <Route index element={renderLazyPage(InstructorDashboard)} />
            <Route path="chapters" element={renderLazyPage(InstructorCourses)} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;
