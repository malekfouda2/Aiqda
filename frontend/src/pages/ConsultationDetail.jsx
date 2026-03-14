import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { consultationsAPI, consultationBookingsAPI } from '../services/api';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, cardVariants, staggerContainer } from '../utils/animations';

function ConsultationDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { showSuccess, showError } = useUIStore();
  
  const [consultation, setConsultation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    fetchConsultation();
  }, [id]);

  const fetchConsultation = async () => {
    try {
      const response = await consultationsAPI.getById(id);
      setConsultation(response.data);
    } catch (error) {
      console.error('Failed to fetch consultation:', error);
      showError('Failed to load consultation details');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitBooking = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login', { state: { from: { pathname: `/consultations/${id}` } } });
      return;
    }

    if (consultation.priceType === 'fixed' && !paymentReference) {
      showError('Payment reference is required');
      return;
    }

    setSubmitting(true);
    try {
      await consultationBookingsAPI.submit({
        consultationId: id,
        paymentReference: consultation.priceType === 'fixed' ? paymentReference : undefined
      });
      setIsSubmitted(true);
      showSuccess('Your booking has been submitted successfully!');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to submit booking');
    } finally {
      setSubmitting(false);
    }
  };

  const copyToClipboard = (text, label) => {
    navigator.clipboard.writeText(text);
    showSuccess(`${label} copied to clipboard!`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading consultation..." />
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Consultation not found</h2>
          <Link to="/consultations" className="btn-primary">Browse Consultations</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient opacity-30" />
      
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="floating-orb w-[400px] h-[400px] bg-cyan-100/40 top-[-100px] right-[-100px] animate-float-slow" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-100/40 bottom-[-100px] left-[-50px] animate-float" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          variants={pageVariants}
          initial="hidden"
          animate="visible"
        >
          <Link to="/consultations" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-8 group transition-colors">
            <svg className="w-5 h-5 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Consultations
          </Link>

          <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Column: Details */}
            <div className="lg:w-3/5">
              <motion.div variants={fadeInUp} className="card p-8">
                <div className="flex items-center gap-3 mb-6">
                  <span className={`tag ${consultation.mode === '1 to 1' ? 'tag-beginner' : 'tag-intermediate'}`}>
                    {consultation.mode}
                  </span>
                  <span className="text-gray-400 font-medium">{consultation.duration}</span>
                </div>
                
                <h1 className="text-4xl font-bold text-gray-900 mb-6">{consultation.title}</h1>
                <p className="text-gray-600 text-lg leading-relaxed mb-8">
                  {consultation.description}
                </p>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <span className="text-primary-500">🎯</span> Focus Points
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-3">
                      {consultation.focusPoints?.map((point, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                          <span className="text-primary-500 font-bold">✓</span>
                          <span className="text-gray-700 text-sm">{point}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>

            {/* Right Column: Booking Form */}
            <div className="lg:w-2/5">
              <motion.div variants={fadeInUp} className="sticky top-8">
                {isSubmitted ? (
                  <div className="card p-8 text-center border-emerald-100 bg-emerald-50/30">
                    <div className="w-20 h-20 mx-auto mb-6 rounded-3xl bg-emerald-100 flex items-center justify-center text-4xl">
                      🎉
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-4">Booking Submitted!</h2>
                    <p className="text-gray-600 mb-8 leading-relaxed">
                      Your booking has been submitted. Admin will review and confirm your Zoom session.
                    </p>
                    <Link to="/dashboard/consultations" className="btn-primary w-full justify-center">
                      View My Bookings
                    </Link>
                  </div>
                ) : (
                  <div className="card p-8">
                    {!user ? (
                      <div className="text-center py-6">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary-50 flex items-center justify-center text-3xl">
                          🔒
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-2">Login to Book</h3>
                        <p className="text-gray-500 mb-6">You need to be logged in to book a consultation.</p>
                        <Link 
                          to="/login" 
                          state={{ from: { pathname: `/consultations/${id}` } }}
                          className="btn-primary w-full justify-center"
                        >
                          Login Now
                        </Link>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitBooking}>
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">
                          {consultation.priceType === 'fixed' ? 'Book Session' : 'Submit Inquiry'}
                        </h2>

                        {consultation.priceType === 'fixed' ? (
                          <div className="space-y-6">
                            <div className="p-4 rounded-2xl bg-primary-50 border border-primary-100">
                              <p className="text-sm text-primary-700 font-medium mb-1">Price to Transfer</p>
                              <p className="text-3xl font-bold text-primary-900">
                                {consultation.price} <span className="text-lg">{consultation.currency}</span>
                              </p>
                            </div>

                            <div className="space-y-4">
                              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">How to Book</h3>
                              
                              <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">1</div>
                                <p className="text-sm text-gray-600 pt-1">Transfer <b>{consultation.price} SAR</b> to Bank Albilad</p>
                              </div>

                              <div className="ml-12 p-4 rounded-xl bg-gray-50 border border-gray-200 space-y-3">
                                <div>
                                  <p className="text-[10px] text-gray-400 uppercase font-bold">Bank Name</p>
                                  <p className="text-sm font-semibold text-gray-800">Bank Albilad</p>
                                </div>
                                <div className="group cursor-pointer" onClick={() => copyToClipboard('SA5915000452146048350009', 'IBAN')}>
                                  <div className="flex justify-between items-center">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold">IBAN</p>
                                    <span className="text-[10px] text-primary-500 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Copy</span>
                                  </div>
                                  <p className="text-sm font-mono font-semibold text-gray-800">SA5915000452146048350009</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-400 uppercase font-bold">Account Number</p>
                                  <p className="text-sm font-semibold text-gray-800">452146049350009</p>
                                </div>
                                <div>
                                  <p className="text-[10px] text-gray-400 uppercase font-bold">CR Number</p>
                                  <p className="text-sm font-semibold text-gray-800">7049447043</p>
                                </div>
                              </div>

                              <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">2</div>
                                <div className="flex-1 pt-1">
                                  <p className="text-sm text-gray-600 mb-3">Enter your payment reference number below</p>
                                  <input
                                    type="text"
                                    required
                                    placeholder="Reference Number"
                                    className="input-field"
                                    value={paymentReference}
                                    onChange={(e) => setPaymentReference(e.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="flex gap-4">
                                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center font-bold text-sm">3</div>
                                <p className="text-sm text-gray-600 pt-1">Click "Submit Booking"</p>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-6">
                            <div className="p-4 rounded-2xl bg-cyan-50 border border-cyan-100">
                              <p className="text-sm text-cyan-700 font-medium">Contract Based</p>
                              <p className="text-sm text-cyan-600 mt-2 italic">
                                Our team will contact you to discuss pricing and collaboration scope.
                              </p>
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={submitting}
                          className="btn-primary w-full justify-center mt-8 py-4 text-lg"
                        >
                          {submitting ? 'Submitting...' : consultation.priceType === 'fixed' ? 'Submit Booking' : 'Submit Inquiry'}
                        </button>
                      </form>
                    )}
                  </div>
                )}
              </motion.div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default ConsultationDetail;
