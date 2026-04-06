import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { studioApplicationsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, cardVariants } from '../utils/animations';

function AdminStudioApplications() {
  const { showSuccess, showError } = useUIStore();
  const [applications, setApplications] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);
  const [selectedApp, setSelectedApp] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchApplications();
  }, [filter]);

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const response = await studioApplicationsAPI.getAll(filter !== 'all' ? filter : undefined);
      setApplications(response.data);
    } catch (error) {
      console.error('Failed to fetch applications:', error);
      showError('Failed to fetch applications');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (id) => {
    setDetailLoading(true);
    try {
      const response = await studioApplicationsAPI.getById(id);
      setSelectedApp(response.data);
    } catch (error) {
      showError('Failed to load application details');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleApprove = async (id) => {
    setProcessing(id);
    try {
      const response = await studioApplicationsAPI.approve(id);
      showSuccess(response.data?.message || 'Application approved successfully!');
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
    setProcessing(rejectModalId);
    try {
      await studioApplicationsAPI.reject(rejectModalId, rejectReason);
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

  const filteredApplications = applications.filter(app => 
    app.studioName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const SectionTitle = ({ children }) => (
    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</h3>
  );

  const InfoRow = ({ label, value }) => (
    <div className="py-2">
      <p className="text-gray-500 text-sm">{label}</p>
      <div className="text-gray-900 mt-0.5">{value || '—'}</div>
    </div>
  );

  const CheckboxInfo = ({ label, checked }) => (
    <div className="flex items-center gap-2 py-1">
      <div className={`w-4 h-4 rounded border flex items-center justify-center ${checked ? 'bg-primary-500 border-primary-500 text-white' : 'border-gray-300'}`}>
        {checked && (
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </div>
  );

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Studio Applications</h1>
            <p className="text-gray-500">Review and manage studio partner applications</p>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Search by studio name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full md:w-64"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
          {['all', 'pending', 'approved', 'rejected'].map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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
        ) : filteredApplications.length === 0 ? (
          <div className="card text-center py-16">
            <div className="text-5xl mb-4">🎬</div>
            <p className="text-gray-500 text-lg">No applications found</p>
            <p className="text-gray-400 text-sm mt-1">
              {searchTerm ? `No results for "${searchTerm}"` : (filter !== 'all' ? `No ${filter} applications at this time` : 'No applications have been submitted yet')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredApplications.map((app, index) => (
              <motion.div
                key={app._id}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.05 }}
                className="card hover:border-primary-200 hover:shadow-md transition-all duration-300 cursor-pointer"
                onClick={() => fetchDetail(app._id)}
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center text-primary-600 font-semibold">
                        {app.studioName?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900">{app.studioName}</p>
                        <p className="text-gray-400 text-sm">{app.studioType}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(app.status)}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(app.status)}`}></span>
                        {app.status}
                      </span>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500 text-sm">{app.countryOfRegistration}</span>
                      <span className="text-gray-300">•</span>
                      <span className="text-gray-500 text-sm">Est. {app.yearEstablished}</span>
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
                        disabled={processing === app._id}
                        className="btn-primary text-sm"
                      >
                        {processing === app._id ? 'Processing...' : 'Approve'}
                      </button>
                      <button
                        onClick={() => { setRejectModalId(app._id); setRejectReason(''); }}
                        disabled={processing === app._id}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm"
                      >
                        Reject
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
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={() => setSelectedApp(null)}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative bg-white border border-gray-200 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {detailLoading ? (
                <div className="flex justify-center py-20">
                  <LoadingSpinner />
                </div>
              ) : (
                <>
                  <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-gray-100 px-6 py-4 flex items-center justify-between z-10">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">{selectedApp.studioName}</h2>
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

                  <div className="overflow-y-auto max-h-[calc(90vh-80px)] px-6 py-5 space-y-8">
                    {/* Section 1 */}
                    <div>
                      <SectionTitle>Section 1: Studio Identity & Structure</SectionTitle>
                      <div className="grid sm:grid-cols-2 gap-x-6">
                        <InfoRow label="Legal Studio Name" value={selectedApp.studioName} />
                        <InfoRow label="Contact Email" value={
                          selectedApp.contactEmail ? (
                            <a href={`mailto:${selectedApp.contactEmail}`} className="text-primary-600 hover:text-primary-700 underline break-all">
                              {selectedApp.contactEmail}
                            </a>
                          ) : '—'
                        } />
                        <InfoRow label="Year Established" value={selectedApp.yearEstablished} />
                        <InfoRow label="Country of Registration" value={selectedApp.countryOfRegistration} />
                        <InfoRow label="Studio Type" value={selectedApp.studioType} />
                      </div>
                      <InfoRow label="Website + Portfolio Link" value={
                        <a href={selectedApp.websitePortfolio} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700 underline break-all">
                          {selectedApp.websitePortfolio}
                        </a>
                      } />
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Section 2 */}
                    <div>
                      <SectionTitle>Section 2: Format of Delivery</SectionTitle>
                      <div className="space-y-4">
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Policy Acknowledgments</p>
                          <div className="grid sm:grid-cols-2 gap-2">
                            <CheckboxInfo label="1920 x 1080 (Full HD)" checked={selectedApp.videoResolutionAck} />
                            <CheckboxInfo label="Stereo (2 Channels)" checked={selectedApp.audioSpecAck} />
                            <CheckboxInfo label="-12 dB to -6 dB Peak Range" checked={selectedApp.audioFrequencyAck} />
                          </div>
                        </div>
                        
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">Video File Sizes (Mandatory Policy)</p>
                          <div className="flex flex-wrap gap-x-4 gap-y-1">
                            {['1–3 min: Max 500 MB', '4–6 min: Max 1 GB', '7–9 min: Max 1.5 GB'].map(size => (
                              <CheckboxInfo key={size} label={size} checked={selectedApp.videoFileSizes?.includes(size)} />
                            ))}
                          </div>
                        </div>

                        <div className="grid sm:grid-cols-2 gap-6">
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Accepted Video Formats</p>
                            <div className="flex gap-4">
                              {['.mov', '.mp4'].map(format => (
                                <CheckboxInfo key={format} label={format} checked={selectedApp.videoFormats?.includes(format)} />
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-700 mb-2">Accepted Frame Rates</p>
                            <div className="flex gap-4">
                              {['24 fps', '30 fps'].map(rate => (
                                <CheckboxInfo key={rate} label={rate} checked={selectedApp.frameRates?.includes(rate)} />
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Section 3 */}
                    <div>
                      <SectionTitle>Section 3: Contribution Capacity</SectionTitle>
                      <p className="text-gray-500 text-sm mb-3">Our studio can contribute structured, chapter-based tutorials in:</p>
                      <div className="flex gap-6">
                        {['Animation', 'VFX'].map(domain => (
                          <CheckboxInfo key={domain} label={domain} checked={selectedApp.domains?.includes(domain)} />
                        ))}
                      </div>
                    </div>

                    <div className="h-px bg-gray-100" />

                    {/* Section 4 */}
                    <div>
                      <SectionTitle>Section 4: Studio Objectives</SectionTitle>
                      <div className="space-y-1">
                        {['Brand visibility', 'Institutional exposure and potential contracts', 'All of the above'].map(obj => (
                          <CheckboxInfo key={obj} label={obj} checked={selectedApp.objectives?.includes(obj)} />
                        ))}
                      </div>
                    </div>

                    {selectedApp.rejectionReason && (
                      <>
                        <div className="h-px bg-gray-100" />
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                          <p className="text-red-600 text-sm font-medium mb-1">Rejection Reason</p>
                          <p className="text-red-700">{selectedApp.rejectionReason}</p>
                        </div>
                      </>
                    )}

                    {selectedApp.status === 'approved' && selectedApp.contactEmail && (
                      <>
                        <div className="h-px bg-gray-100" />
                        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
                          <p className="text-green-700 text-sm font-medium mb-1">Scheduling Email Sent</p>
                          <p className="text-green-800 text-sm">
                            {selectedApp.approvalEmailSentAt
                              ? `A scheduling email was sent to ${selectedApp.contactEmail} on ${new Date(selectedApp.approvalEmailSentAt).toLocaleString()}.`
                              : `A scheduling email was sent to ${selectedApp.contactEmail}.`}
                          </p>
                        </div>
                      </>
                    )}

                    {selectedApp.status === 'pending' && (
                      <div className="sticky bottom-0 bg-white py-4 border-t border-gray-100 flex gap-3">
                        <button
                          onClick={() => handleApprove(selectedApp._id)}
                          disabled={processing === selectedApp._id}
                          className="btn-primary flex-1"
                        >
                          {processing === selectedApp._id ? 'Processing...' : 'Approve Application'}
                        </button>
                        <button
                          onClick={() => { setRejectModalId(selectedApp._id); setRejectReason(''); }}
                          disabled={processing === selectedApp._id}
                          className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-6 rounded-xl transition-all flex-1"
                        >
                          Reject Application
                        </button>
                      </div>
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
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
            onClick={() => setRejectModalId(null)}
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
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
                  disabled={!rejectReason.trim() || processing === rejectModalId}
                  className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-medium py-2.5 px-6 rounded-xl transition-all flex-1"
                >
                  {processing === rejectModalId ? 'Rejecting...' : 'Confirm Reject'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AdminStudioApplications;
