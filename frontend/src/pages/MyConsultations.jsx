import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { consultationBookingsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants } from '../utils/animations';

function MyConsultations() {
  const { showError } = useUIStore();
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const response = await consultationBookingsAPI.getMy();
      setBookings(response.data);
    } catch (error) {
      console.error('Failed to fetch bookings:', error);
      showError('Failed to load your consultation bookings');
    } finally {
      setLoading(false);
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-50 text-green-600';
      case 'rejected': return 'bg-red-50 text-red-600';
      case 'cancelled': return 'bg-gray-50 text-gray-600';
      case 'pending':
      default: return 'bg-yellow-50 text-yellow-600';
    }
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'confirmed': return 'bg-green-400';
      case 'rejected': return 'bg-red-400';
      case 'cancelled': return 'bg-gray-400';
      case 'pending':
      default: return 'bg-yellow-400';
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <LoadingSpinner size="lg" text="Loading your bookings..." />
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp} className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">My Consultations</h1>
        <p className="text-gray-500 text-lg">Manage your expert sessions and view Zoom links</p>
      </motion.div>

      {bookings.length === 0 ? (
        <motion.div variants={fadeInUp} className="card text-center py-16">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary-50 to-cyan-50 flex items-center justify-center">
            <span className="text-4xl">🎯</span>
          </div>
          <p className="text-gray-500 text-lg mb-6">No consultation bookings yet</p>
          <Link to="/consultations" className="btn-primary">
            Browse Consultations
          </Link>
        </motion.div>
      ) : (
        <motion.div 
          variants={staggerContainer}
          className="space-y-4"
        >
          {bookings.map((booking) => (
            <motion.div
              key={booking._id}
              variants={cardVariants}
              className="card group hover:border-primary-200 hover:shadow-md transition-all duration-300"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-50 flex items-center justify-center text-primary-600 text-xl font-bold">
                      {booking.consultation?.title?.charAt(0)}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{booking.consultation?.title}</h3>
                      <p className="text-sm text-gray-400">
                        Submitted on {new Date(booking.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4">
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(booking.status)}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${getStatusDot(booking.status)}`}></span>
                      {booking.status}
                    </span>
                    <span className="text-gray-300">•</span>
                    <span className="text-gray-600 font-medium">
                      {booking.priceType === 'fixed' ? `${booking.amount} SAR` : 'Contract Based'}
                    </span>
                    {booking.paymentReference && (
                      <>
                        <span className="text-gray-300">•</span>
                        <span className="text-gray-500 text-sm">Ref: {booking.paymentReference}</span>
                      </>
                    )}
                  </div>

                  {booking.status === 'rejected' && booking.rejectionReason && (
                    <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-100 text-red-700 text-sm">
                      <span className="font-semibold">Reason:</span> {booking.rejectionReason}
                    </div>
                  )}

                  {booking.status === 'confirmed' && booking.zoomLink && (
                    <div className="mt-4 flex flex-col sm:flex-row gap-3">
                      <a
                        href={booking.zoomLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary inline-flex items-center justify-center gap-2 py-2 px-4 text-sm"
                      >
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5v-9l6 4.5-6 4.5z" />
                        </svg>
                        Join Zoom Session
                      </a>
                      <div className="flex items-center text-xs text-emerald-600 font-medium">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full mr-2 animate-pulse" />
                        Meeting link is ready
                      </div>
                    </div>
                  )}
                </div>

                <div className="lg:text-right">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Duration</p>
                  <p className="font-semibold text-gray-900">{booking.consultation?.duration}</p>
                  <p className="text-xs text-gray-400 mt-2 uppercase tracking-wider mb-1">Mode</p>
                  <p className="text-sm font-medium text-primary-600">{booking.consultation?.mode}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}
    </motion.div>
  );
}

export default MyConsultations;
