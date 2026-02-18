import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { paymentsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function AdminPayments() {
  const { showSuccess, showError } = useUIStore();
  const [payments, setPayments] = useState([]);
  const [filter, setFilter] = useState('submitted');
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

  const handleApprove = async (paymentId) => {
    setProcessing(paymentId);
    try {
      await paymentsAPI.approve(paymentId);
      showSuccess('Payment approved and subscription activated!');
      fetchPayments();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to approve payment');
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (paymentId) => {
    const reason = prompt('Enter rejection reason:');
    if (!reason) return;

    setProcessing(paymentId);
    try {
      await paymentsAPI.reject(paymentId, reason);
      showSuccess('Payment rejected');
      fetchPayments();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to reject payment');
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Management</h1>
          <p className="text-gray-500 mb-8">Review and approve payment submissions</p>

          <div className="flex gap-3 mb-6">
            {['submitted', 'approved', 'rejected', 'all'].map((status) => (
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
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : payments.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No payments found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment._id} className="card">
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
                          <p className="text-gray-500 text-sm">Payment Reference</p>
                          <p className="text-gray-900 font-mono">{payment.paymentReference}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Amount</p>
                          <p className="text-gray-900 font-semibold">{payment.amount} SAR</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Bank</p>
                          <p className="text-gray-900">{payment.bankName}</p>
                        </div>
                      </div>
                      {payment.rejectionReason && (
                        <p className="mt-2 text-red-600 text-sm">
                          Rejection reason: {payment.rejectionReason}
                        </p>
                      )}
                    </div>

                    {payment.status === 'submitted' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(payment._id)}
                          disabled={processing === payment._id}
                          className="btn-primary"
                        >
                          {processing === payment._id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(payment._id)}
                          disabled={processing === payment._id}
                          className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-lg transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
    </motion.div>
  );
}

export default AdminPayments;
