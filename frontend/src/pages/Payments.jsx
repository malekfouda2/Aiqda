import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { paymentsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';

function Payments() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const response = await paymentsAPI.getUserPayments();
      setPayments(response.data);
    } catch (error) {
      console.error('Failed to fetch payments:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-50 text-green-600';
      case 'rejected':
        return 'bg-red-50 text-red-600';
      default:
        return 'bg-yellow-50 text-yellow-600';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading payments..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment History</h1>
          <p className="text-gray-500 mb-8">View all your payment submissions</p>

          {payments.length === 0 ? (
            <div className="card text-center py-12">
              <div className="text-5xl mb-4">💳</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No payments yet</h3>
              <p className="text-gray-500">Your payment history will appear here</p>
            </div>
          ) : (
            <div className="space-y-4">
              {payments.map((payment) => (
                <div key={payment._id} className="card">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                        <span className="text-gray-400 text-sm">
                          {new Date(payment.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium">
                        Reference: {payment.paymentReference}
                      </p>
                      <p className="text-gray-500 text-sm">
                        Amount: {payment.amount} SAR
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-gray-900">
                        {payment.amount} SAR
                      </p>
                      {payment.status === 'rejected' && payment.rejectionReason && (
                        <p className="text-red-600 text-sm mt-1">
                          Reason: {payment.rejectionReason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default Payments;
