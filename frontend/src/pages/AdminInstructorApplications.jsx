import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import api, { instructorApplicationsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants } from '../utils/animations';
import {
  downloadCsv,
  formatCsvBoolean,
  formatCsvDate,
  formatCsvList,
  formatCsvReference,
} from '../utils/csv';
import { downloadBlobResponse } from '../utils/download';
import { getSafeExternalHref } from '../utils/url';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

function AdminInstructorApplications() {
  const { showSuccess, showError } = useUIStore();
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useBodyScrollLock(Boolean(selectedApp || rejectModalId));

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { status: filter } : {};
      const response = await api.get('/instructor-applications', { params });
      setApplications(response.data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id) => {
    setDetailLoading(true);
    try {
      const response = await api.get(`/instructor-applications/${id}`);
      setSelectedApp(response.data);
    } catch (error) {
      showError('Failed to load application details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setProcessing(`approve-${id}`);
    try {
      const response = await api.patch(`/instructor-applications/${id}/approve`);

      if (response.data?.setupLink && navigator?.clipboard) {
        try {
          await navigator.clipboard.writeText(response.data.setupLink);
          showSuccess('Application approved. The creator setup link was copied to your clipboard.');
        } catch (clipboardError) {
          console.warn('Failed to copy creator setup link:', clipboardError);
          showSuccess('Application approved successfully. The creator will also receive their setup link by email.');
        }
      } else {
        showSuccess(response.data?.message || 'Application approved successfully!');
      }

      fetchApplications();
      if (selectedApp?._id === id) {
        fetchDetail(id);
      }
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to approve application');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return;
    setProcessing(`reject-${rejectModalId}`);
    try {
      await api.patch(`/instructor-applications/${rejectModalId}/reject`, { reason: rejectReason });
      showSuccess('Application rejected');
      fetchApplications();
      if (selectedApp?._id === rejectModalId) {
        fetchDetail(rejectModalId);
      }
      setRejectModalId(null);
      setRejectReason('');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to reject application');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this creator application? This action cannot be undone.')) {
      return;
    }

    setProcessing(`delete-${id}`);
    try {
      await instructorApplicationsAPI.remove(id);
      showSuccess('Application deleted');
      if (selectedApp?._id === id) {
        setSelectedApp(null);
      }
      if (rejectModalId === id) {
        setRejectModalId(null);
        setRejectReason('');
      }
      await fetchApplications();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete application');
    } finally {
      setProcessing(null);
    }
  };

  const actionIsRunning = (action, id) => processing === `${action}-${id}`;
  const recordIsBusy = (id) => typeof processing === 'string' && processing.endsWith(`-${id}`);

  const handleExportApplications = () => {
    downloadCsv({
      filename: `creator-applications-${filter}-${new Date().toISOString().slice(0, 10)}`,
      columns: [
        { key: 'applicationId', label: 'Application ID' },
        { key: 'status', label: 'Status' },
        { key: 'fullName', label: 'Full Name' },
        { key: 'email', label: 'Email' },
        { key: 'nationality', label: 'Nationality' },
        { key: 'country', label: 'Country' },
        { key: 'city', label: 'City' },
        { key: 'phone', label: 'Phone' },
        { key: 'educationLevel', label: 'Education Level' },
        { key: 'fieldOfStudy', label: 'Field of Study' },
        { key: 'yearsOfExperience', label: 'Years of Experience' },
        { key: 'specialization', label: 'Specialization' },
        { key: 'previousTeachingExperience', label: 'Previous Teaching Experience' },
        { key: 'softwareProficiency', label: 'Software Proficiency' },
        { key: 'institutionsOrStudios', label: 'Institutions / Studios' },
        { key: 'notableWorks', label: 'Notable Works' },
        { key: 'websiteOrPortfolio', label: 'Portfolio / Website' },
        { key: 'cvUploaded', label: 'CV Uploaded' },
        { key: 'teachingStyle', label: 'Teaching Style' },
        { key: 'studentGuidance', label: 'Member Guidance' },
        { key: 'existingCourseMaterials', label: 'Existing Chapter Materials' },
        { key: 'courseMaterialsUploaded', label: 'Chapter Materials File Uploaded' },
        { key: 'preferredSchedule', label: 'Preferred Schedule' },
        { key: 'earliestStartDate', label: 'Earliest Start Date' },
        { key: 'additionalComments', label: 'Additional Comments' },
        { key: 'creatorTermsVersion', label: 'Creator Terms Version' },
        { key: 'creatorTermsAcceptedAt', label: 'Creator Terms Accepted At' },
        { key: 'reviewedBy', label: 'Reviewed By' },
        { key: 'reviewedAt', label: 'Reviewed At' },
        { key: 'rejectionReason', label: 'Rejection Reason' },
        { key: 'createdAt', label: 'Applied At' },
        { key: 'updatedAt', label: 'Updated At' },
      ],
      rows: applications.map((app) => ({
        applicationId: app._id,
        status: app.status,
        fullName: app.fullName,
        email: app.email,
        nationality: app.nationality,
        country: app.country,
        city: app.city,
        phone: [app.phoneCode, app.phoneNumber].filter(Boolean).join(' '),
        educationLevel: app.educationLevel,
        fieldOfStudy: app.fieldOfStudy,
        yearsOfExperience: app.yearsOfExperience,
        specialization: formatCsvList(app.specialization),
        previousTeachingExperience: app.previousTeachingExperience,
        softwareProficiency: app.softwareProficiency,
        institutionsOrStudios: app.institutionsOrStudios,
        notableWorks: app.notableWorks,
        websiteOrPortfolio: app.websiteOrPortfolio,
        cvUploaded: formatCsvBoolean(Boolean(app.cvFile)),
        teachingStyle: app.teachingStyle,
        studentGuidance: app.studentGuidance,
        existingCourseMaterials: app.existingCourseMaterials,
        courseMaterialsUploaded: formatCsvBoolean(Boolean(app.courseMaterialsFile)),
        preferredSchedule: app.preferredSchedule,
        earliestStartDate: formatCsvDate(app.earliestStartDate),
        additionalComments: app.additionalComments,
        creatorTermsVersion: app.creatorTermsVersion,
        creatorTermsAcceptedAt: formatCsvDate(app.creatorTermsAcceptedAt),
        reviewedBy: formatCsvReference(app.reviewedBy),
        reviewedAt: formatCsvDate(app.reviewedAt),
        rejectionReason: app.rejectionReason,
        createdAt: formatCsvDate(app.createdAt),
        updatedAt: formatCsvDate(app.updatedAt),
      })),
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-50 text-green-600';
      case 'rejected': return 'bg-red-50 text-red-600';
      default: return 'bg-yellow-50 text-yellow-600';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'approved': return 'bg-green-400';
      case 'rejected': return 'bg-red-400';
      default: return 'bg-yellow-400';
    }
  };

  const SectionTitle = ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</h3>
  );

  const InfoRow = ({ label, value }) => (
    <div className="py-2">
      <p className="text-gray-500 text-sm">{label}</p>
      <p className="text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );

  const FileLink = ({ url, label }) => {
    if (!url) return <InfoRow label={label} value="Not provided" />;

    const handleDownload = async () => {
      if (!selectedApp?._id) {
        return;
      }

      const field = label === 'CV / Resume' ? 'cvFile' : 'courseMaterialsFile';

      try {
        const response = await instructorApplicationsAPI.downloadFile(selectedApp._id, field);
        downloadBlobResponse(response, field === 'cvFile' ? 'instructor-cv' : 'course-materials');
      } catch (error) {
        showError(error.response?.data?.error || 'Failed to download file');
      }
    };

    return (
      <div className="py-2">
        <p className="text-gray-500 text-sm">{label}</p>
        <button
          type="button"
          onClick={handleDownload}
          className="inline-flex items-center gap-2 mt-1 text-primary-600 hover:text-primary-700 font-medium text-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Download
        </button>
      </div>
    );
  };

  const safePortfolioHref = getSafeExternalHref(selectedApp?.websiteOrPortfolio);

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp}>
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Creator Applications</h1>
            <p className="text-gray-500">Review and manage creator applications</p>
          </div>

          <button
            type="button"
            onClick={handleExportApplications}
            disabled={loading || applications.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
            </svg>
            Export CSV
          </button>
        </div>

        <div className="flex flex-wrap gap-3 mb-6">
          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                filter === status
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : applications.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">📋</div>
            <p className="text-gray-500 text-lg">No applications found</p>
            <p className="text-gray-400 text-sm mt-1">
              {filter !== 'all' ? `No ${filter} applications at this time` : 'No applications have been submitted yet'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {applications.map((app, index) => (
                <motion.div
                  key={app._id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="card hover:border-primary-200 hover:shadow-md transition-all duration-300 cursor-pointer"
                  onClick={() => fetchDetail(app._id)}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 font-semibold">
                          {app.fullName?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{app.fullName}</p>
                          <p className="text-gray-400 text-sm">{app.email}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(app.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(app.status)}`}></span>
                          {app.status}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-500 text-sm">
                          {app.specialization?.join(', ') || 'No specialization'}
                        </span>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-400 text-sm">
                          {new Date(app.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      {app.rejectionReason && (
                        <p className="mt-2 text-red-500 text-sm">
                          Rejection: {app.rejectionReason}
                        </p>
                      )}
                    </div>

                    {app.status === 'pending' && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleApprove(app._id)}
                          disabled={recordIsBusy(app._id)}
                          className="btn-primary text-sm"
                        >
                          {actionIsRunning('approve', app._id) ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => { setRejectModalId(app._id); setRejectReason(''); }}
                          disabled={recordIsBusy(app._id)}
                          className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleDelete(app._id)}
                          disabled={recordIsBusy(app._id)}
                          className="bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm"
                        >
                          {actionIsRunning('delete', app._id) ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                    {app.status !== 'pending' && (
                      <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(app._id)}
                          disabled={recordIsBusy(app._id)}
                          className="bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm"
                        >
                          {actionIsRunning('delete', app._id) ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
            ))}
          </div>
        )}
      </motion.div>

      <AnimatePresence>
        {selectedApp && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="app-modal-shell z-50"
            onClick={() => setSelectedApp(null)}
          >
            <div className="app-modal-backdrop" />
            <motion.div
              initial={{ opacity: 0, scale: 0.99, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="app-modal-panel max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-3rem)] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading ? (
                <div className="flex justify-center py-20">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedApp.fullName}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-medium capitalize ${getStatusColor(selectedApp.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(selectedApp.status)}`}></span>
                          {selectedApp.status}
                        </span>
                        <span className="text-gray-400 text-sm">
                          Applied {new Date(selectedApp.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedApp(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="app-modal-scroll overflow-y-auto max-h-[calc(100dvh-7rem)] sm:max-h-[calc(100dvh-8rem)] px-6 py-5 space-y-6">
                    <div>
                      <SectionTitle>Personal Information</SectionTitle>
                      <div className="grid sm:grid-cols-2 gap-x-6">
                        <InfoRow label="Full Name" value={selectedApp.fullName} />
                        <InfoRow label="Email" value={selectedApp.email} />
                        <InfoRow label="Nationality" value={selectedApp.nationality} />
                        <InfoRow label="Country" value={selectedApp.country} />
                        <InfoRow label="City" value={selectedApp.city} />
                        <InfoRow label="Phone" value={`${selectedApp.phoneCode} ${selectedApp.phoneNumber}`} />
                      </div>
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                    <div>
                      <SectionTitle>Education & Experience</SectionTitle>
                      <div className="grid sm:grid-cols-2 gap-x-6">
                        <InfoRow label="Education Level" value={selectedApp.educationLevel} />
                        <InfoRow label="Field of Study" value={selectedApp.fieldOfStudy} />
                        <InfoRow label="Years of Experience" value={selectedApp.yearsOfExperience} />
                        <InfoRow label="Specialization" value={selectedApp.specialization?.join(', ')} />
                      </div>
                      <InfoRow label="Previous Teaching Experience" value={selectedApp.previousTeachingExperience} />
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                    <div>
                      <SectionTitle>Professional Background</SectionTitle>
                      <div className="grid sm:grid-cols-2 gap-x-6">
                        <InfoRow label="Software Proficiency" value={selectedApp.softwareProficiency} />
                        <InfoRow label="Institutions / Studios" value={selectedApp.institutionsOrStudios} />
                      </div>
                      <InfoRow label="Notable Works" value={selectedApp.notableWorks} />
                      <InfoRow label="Portfolio / Website" value={
                        safePortfolioHref ? (
                          <a href={safePortfolioHref} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline">
                            {safePortfolioHref}
                          </a>
                        ) : null
                      } />
                      <FileLink url={selectedApp.cvFile} label="CV / Resume" />
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                    <div>
                      <SectionTitle>Teaching Approach</SectionTitle>
                      <InfoRow label="Teaching Style" value={selectedApp.teachingStyle} />
                      <InfoRow label="Member Guidance" value={selectedApp.studentGuidance} />
                      <InfoRow label="Existing Chapter Materials" value={selectedApp.existingCourseMaterials} />
                      <FileLink url={selectedApp.courseMaterialsFile} label="Chapter Materials File" />
                    </div>

                    <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />

                    <div>
                      <SectionTitle>Availability</SectionTitle>
                      <div className="grid sm:grid-cols-2 gap-x-6">
                        <InfoRow label="Preferred Schedule" value={selectedApp.preferredSchedule} />
                        <InfoRow label="Earliest Start Date" value={selectedApp.earliestStartDate ? new Date(selectedApp.earliestStartDate).toLocaleDateString() : null} />
                      </div>
                      <InfoRow label="Additional Comments" value={selectedApp.additionalComments} />
                    </div>

                    {selectedApp.rejectionReason && (
                      <>
                        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                          <p className="text-red-600 text-sm font-medium mb-1">Rejection Reason</p>
                          <p className="text-red-700">{selectedApp.rejectionReason}</p>
                        </div>
                      </>
                    )}

                    {selectedApp.status === 'pending' && (
                      <>
                        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        <div className="flex gap-3 pb-2">
                          <button
                            onClick={() => handleApprove(selectedApp._id)}
                            disabled={recordIsBusy(selectedApp._id)}
                            className="btn-primary flex-1"
                          >
                            {actionIsRunning('approve', selectedApp._id) ? 'Processing...' : 'Approve Application'}
                          </button>
                          <button
                            onClick={() => { setRejectModalId(selectedApp._id); setRejectReason(''); }}
                            disabled={recordIsBusy(selectedApp._id)}
                            className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all flex-1"
                          >
                            Reject Application
                          </button>
                          <button
                            onClick={() => handleDelete(selectedApp._id)}
                            disabled={recordIsBusy(selectedApp._id)}
                            className="bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-6 rounded-xl transition-all flex-1"
                          >
                            {actionIsRunning('delete', selectedApp._id) ? 'Deleting...' : 'Delete Application'}
                          </button>
                        </div>
                      </>
                    )}
                    {selectedApp.status !== 'pending' && (
                      <>
                        <div className="h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent" />
                        <div className="pb-2">
                          <button
                            onClick={() => handleDelete(selectedApp._id)}
                            disabled={recordIsBusy(selectedApp._id)}
                            className="bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-6 rounded-xl transition-all w-full"
                          >
                            {actionIsRunning('delete', selectedApp._id) ? 'Deleting...' : 'Delete Application'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {rejectModalId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="app-modal-shell z-[60]"
            onClick={() => setRejectModalId(null)}
          >
            <div className="app-modal-backdrop" />
            <motion.div
              initial={{ opacity: 0, scale: 0.99, y: 12 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.99, y: 10 }}
              transition={{ duration: 0.16, ease: 'easeOut' }}
              className="app-modal-panel max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Application</h3>
              <p className="text-gray-500 text-sm mb-4">Please provide a reason for rejecting this application.</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="input-field min-h-[100px] resize-none mb-4"
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setRejectModalId(null)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectSubmit}
                  disabled={!rejectReason.trim() || actionIsRunning('reject', rejectModalId)}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-xl transition-all flex-1"
                >
                  {actionIsRunning('reject', rejectModalId) ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AdminInstructorApplications;
