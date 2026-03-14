import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { consultationBookingsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants } from '../utils/animations';

function AdminConsultationBookings() {
  const { showSuccess, showError } = useUIStore();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [processing, setProcessing] = useState(null);
  const [rejectModalId, setRejectModalId] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await consultationBookingsAPI.getAll(filter !== 'all' ? filter : undefined);
      setBookings(response.data);
    } catch (error) {
      showError('Failed to fetch bookings');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (id) => {
    setProcessing(id);
    try {
      await consultationBookingsAPI.confirm(id);
      showSuccess('Booking confirmed and Zoom link shared');
      fetchBookings();
    } catch (error) {
      showError('Failed to confirm booking');
    } finally {
      setProcessing(null);
    }
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason.trim()) return;
    setProcessing(rejectModalId);
    try {
      await consultationBookingsAPI.reject(rejectModalId, rejectReason);
      showSuccess('Booking rejected');
      setRejectModalId(null);
      setRejectReason('');
      fetchBookings();
    } catch (error) {
      showError('Failed to reject booking');
    } finally {
      setProcessing(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-50 text-green-600';
      case 'rejected': return 'bg-red-50 text-red-600';
      case 'cancelled': return 'bg-gray-50 text-gray-600';
      default: return 'bg-yellow-50 text-yellow-600';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-400';
      case 'rejected': return 'bg-red-400';
      case 'cancelled': return 'bg-gray-400';
      default: return 'bg-yellow-400';
    }
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Consultation Bookings</h1>
        <p className="text-gray-500">Review and manage consultation session requests</p>
      </motion.div>

      <div className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {['all', 'pending', 'confirmed', 'rejected', 'cancelled'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              filter === status ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" text="Loading bookings..." />
        </div>
      ) : bookings.length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gray-50 flex items-center justify-center">
            <span className="text-2xl">📅</span>
          </div>
          <p className="text-gray-700 font-medium mb-1">No bookings found</p>
          <p className="text-gray-400 text-sm">
            {filter === 'all' ? 'No consultation bookings have been submitted yet.' : `No ${filter} bookings.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking) => (
            <motion.div
              key={booking._id}
              variants={cardVariants}
              className="card group hover:border-primary-200 hover:shadow-md transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center text-primary-600 font-bold">
                      {booking.user?.name?.charAt(0)}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{booking.user?.name}</p>
                      <p className="text-sm text-gray-500">{booking.user?.email}</p>
                    </div>
                    <div className="ml-auto lg:ml-8">
                      <p className="text-sm font-semibold text-gray-900">{booking.consultation?.title}</p>
                      <p className="text-xs text-gray-400 uppercase tracking-wider">{booking.consultation?.mode} • {booking.consultation?.duration}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(booking.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(booking.status)}`}></span>
                      {booking.status}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-700 text-sm font-medium">
                      {booking.priceType === 'fixed' ? `${booking.amount} SAR` : 'Contract'}
                    </span>
                    {booking.paymentReference && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-500 text-sm font-mono">Ref: {booking.paymentReference}</span>
                      </>
                    )}
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-400 text-xs">
                      {new Date(booking.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {booking.status === 'rejected' && booking.rejectionReason && (
                    <p className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
                      <span className="font-semibold">Rejection Reason:</span> {booking.rejectionReason}
                    </p>
                  )}
                </div>

                {booking.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleConfirm(booking._id)}
                      disabled={processing === booking._id}
                      className="btn-primary py-2 px-4 text-sm"
                    >
                      {processing === booking._id ? 'Confirming...' : 'Confirm'}
                    </button>
                    <button
                      onClick={() => { setRejectModalId(booking._id); setRejectReason(''); }}
                      disabled={processing === booking._id}
                      className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-4 rounded-xl transition-all text-sm"
                    >
                      Reject
                    </button>
                  </div>
                )}

                {booking.status === 'confirmed' && booking.zoomLink && (
                  <div className="text-right">
                    <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">
                      Zoom link shared
                    </span>
                    <p className="text-[10px] text-gray-400 mt-1 truncate max-w-[150px]">{booking.zoomLink}</p>
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {rejectModalId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setRejectModalId(null)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Reject Booking</h3>
              <p className="text-gray-500 text-sm mb-4">Provide a reason for rejecting this consultation booking.</p>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Enter rejection reason..."
                className="input-field min-h-[100px] resize-none mb-4"
              />
              <div className="flex gap-3">
                <button onClick={() => setRejectModalId(null)} className="btn-secondary flex-1">Cancel</button>
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

export default AdminConsultationBookings;
