import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { paymentsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, fadeIn } from '../utils/animations';

function AdminPayments() {
  const { showSuccess, showError } = useUIStore();
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('initiated');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    fetchPayments();
  }, [filter]);

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const response = await paymentsAPI.getAll(filter === 'all' ? undefined : filter);
      setPayments(response.data);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this payment submission? This action cannot be undone.')) {
      return;
    }

    setProcessing(`delete-${paymentId}`);
    try {
      await paymentsAPI.remove(paymentId);
      showSuccess('Payment deleted');
      await fetchPayments();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete payment');
    } finally {
      setProcessing(null);
    }
  };

  const actionIsRunning = (action, id) => processing === `${action}-${id}`;
  const recordIsBusy = (id) => typeof processing === 'string' && processing.endsWith(`-${id}`);

  const getStatusColor = (status) => {
    switch (status) {
      case 'captured': return 'bg-green-50 text-green-600';
      case 'approved': return 'bg-green-50 text-green-600';
      case 'failed':
      case 'cancelled': return 'bg-red-50 text-red-600';
      case 'rejected': return 'bg-red-50 text-red-600';
      default: return 'bg-yellow-50 text-yellow-600';
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp}>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Management</h1>
        <p className="text-gray-500 mb-8">Monitor Tap checkout attempts and successful subscription payments</p>
      </motion.div>

      <motion.div variants={fadeInUp} className="flex gap-3 mb-6">
        {['initiated', 'captured', 'failed', 'cancelled', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </motion.div>

      {loading ? (
        <motion.div variants={fadeIn} className="flex justify-center py-12">
          <LoadingSpinner />
        </motion.div>
      ) : payments.length === 0 ? (
        <motion.div variants={fadeInUp} className="card text-center py-12">
          <p className="text-gray-500">No payments found</p>
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
          <AnimatePresence mode="popLayout">
            {payments.map((payment) => (
              <motion.div
                key={payment._id}
                variants={cardVariants}
                layout
                className="card"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                      <span className="text-gray-400 text-sm">
                        {new Date(payment.createdAt).toLocaleString()}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-gray-500 text-sm">User</p>
                        <p className="text-gray-900">{payment.user?.name}</p>
                        <p className="text-gray-400 text-sm">{payment.user?.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm">Reference</p>
                        <p className="text-gray-900 font-mono">{payment.paymentReference || payment.tapChargeId || '—'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm">Amount</p>
                        <p className="text-gray-900 font-semibold">{payment.amount} {payment.currency || 'SAR'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm">Provider</p>
                        <p className="text-gray-900 uppercase">{payment.provider || 'tap'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-sm">Type</p>
                        <p className="text-gray-900">
                          {payment.paymentType === 'renewal'
                            ? 'Automatic renewal'
                            : payment.paymentType === 'recovery'
                              ? 'Recovery checkout'
                              : 'Initial checkout'}
                        </p>
                      </div>
                    </div>
                    {(payment.rejectionReason || payment.failureReason) && (
                      <p className="mt-2 text-red-600 text-sm">
                        Failure reason: {payment.rejectionReason || payment.failureReason}
                      </p>
                    )}
                    {payment.tapChargeId && (
                      <p className="mt-2 text-xs text-gray-400">Tap charge: {payment.tapChargeId}</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(payment._id)}
                      disabled={recordIsBusy(payment._id)}
                      className="bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-5 rounded-lg transition-all"
                    >
                      {actionIsRunning('delete', payment._id) ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdminPayments;
