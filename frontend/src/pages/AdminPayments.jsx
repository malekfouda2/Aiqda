import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { paymentsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, fadeIn } from '../utils/animations';
import { downloadCsv, formatCsvDate } from '../utils/csv';

const getStatusColor = (status) => {
  switch (status) {
    case 'captured':
    case 'approved':
      return 'bg-green-50 text-green-600';
    case 'failed':
    case 'cancelled':
    case 'rejected':
      return 'bg-red-50 text-red-600';
    default:
      return 'bg-yellow-50 text-yellow-600';
  }
};

const getRefundStatusColor = (refundStatus) => {
  switch (refundStatus) {
    case 'refunded':
      return 'bg-sky-50 text-sky-700';
    case 'failed':
      return 'bg-rose-50 text-rose-600';
    case 'pending':
      return 'bg-amber-50 text-amber-700';
    default:
      return 'bg-gray-100 text-gray-500';
  }
};

const getPaymentTypeLabel = (payment) => {
  switch (payment.paymentType) {
    case 'renewal':
      return 'Automatic renewal';
    case 'recovery':
      return 'Recovery checkout';
    case 'consultation':
      return 'Consultation';
    case 'billing_profile_setup':
      return 'Payment method setup';
    default:
      return 'Initial checkout';
  }
};

const getPaymentContextLabel = (payment) => {
  if (payment.consultationBooking?.consultation?.title) {
    return payment.consultationBooking.consultation.title;
  }

  if (payment.subscription?.package?.name) {
    return payment.subscription.billingTerm
      ? `${payment.subscription.package.name} (${payment.subscription.billingTerm.replace(/_/g, ' ')})`
      : payment.subscription.package.name;
  }

  if (payment.paymentType === 'billing_profile_setup') {
    return 'Saved payment method';
  }

  return '—';
};

const getCheckoutMethodLabel = (checkoutMethod) => {
  switch (checkoutMethod) {
    case 'apple_pay':
      return 'Apple Pay';
    case 'saved_card':
      return 'Saved payment method';
    case 'tabby':
      return 'Tabby';
    case 'tamara':
      return 'Tamara';
    default:
      return 'Card';
  }
};

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
      showError(error.response?.data?.error || 'Failed to fetch payments');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this payment record? This action cannot be undone.')) {
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

  const handleRefund = async (payment) => {
    const reason = window.prompt('Refund reason');
    if (reason === null) {
      return;
    }

    setProcessing(`refund-${payment._id}`);
    try {
      await paymentsAPI.refund(payment._id, { reason: reason.trim() || undefined });
      showSuccess('Refund processed');
      await fetchPayments();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to refund payment');
    } finally {
      setProcessing(null);
    }
  };

  const handleExport = () => {
    downloadCsv({
      filename: 'payments',
      columns: [
        { key: 'createdAt', label: 'Created At' },
        { key: 'status', label: 'Status' },
        { key: 'refundStatus', label: 'Refund Status' },
        { key: 'userName', label: 'User Name' },
        { key: 'userEmail', label: 'User Email' },
        { key: 'context', label: 'Context' },
        { key: 'paymentType', label: 'Payment Type' },
        { key: 'amount', label: 'Amount' },
        { key: 'currency', label: 'Currency' },
        { key: 'refundAmount', label: 'Refund Amount' },
        { key: 'refundCurrency', label: 'Refund Currency' },
        { key: 'reference', label: 'Reference' },
        { key: 'provider', label: 'Provider' },
        { key: 'checkoutMethod', label: 'Checkout Method' },
        { key: 'failureReason', label: 'Failure Reason' },
        { key: 'refundReason', label: 'Refund Reason' },
        { key: 'refundedAt', label: 'Refunded At' },
      ],
      rows: payments.map((payment) => ({
        createdAt: formatCsvDate(payment.createdAt),
        status: payment.status || '',
        refundStatus: payment.refundStatus || '',
        userName: payment.user?.name || '',
        userEmail: payment.user?.email || '',
        context: getPaymentContextLabel(payment),
        paymentType: getPaymentTypeLabel(payment),
        amount: payment.amount ?? '',
        currency: payment.currency || '',
        refundAmount: payment.refundAmount ?? '',
        refundCurrency: payment.refundCurrency || '',
        reference: payment.paymentReference || payment.tapChargeId || '',
        provider: payment.provider || '',
        checkoutMethod: payment.checkoutMethod || '',
        failureReason: payment.rejectionReason || payment.failureReason || '',
        refundReason: payment.refundReason || '',
        refundedAt: formatCsvDate(payment.refundedAt),
      })),
    });
  };

  const actionIsRunning = (action, id) => processing === `${action}-${id}`;
  const recordIsBusy = (id) => typeof processing === 'string' && processing.endsWith(`-${id}`);

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp} className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Payment Management</h1>
          <p className="text-gray-500 mb-8">Monitor subscription, consultation, saved-card, and refund records</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={loading || payments.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
        >
          Export CSV
        </button>
      </motion.div>

      <motion.div variants={fadeInUp} className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {['initiated', 'captured', 'approved', 'failed', 'cancelled', 'all'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
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
            {payments.map((payment) => {
              const currency = payment.currency || 'SAR';
              const canRefund = (
                (payment.status === 'captured' || payment.status === 'approved')
                && payment.refundStatus !== 'refunded'
                && payment.paymentType !== 'billing_profile_setup'
              );

              return (
                <motion.div
                  key={payment._id}
                  variants={cardVariants}
                  layout
                  className="card"
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(payment.status)}`}>
                          {payment.status}
                        </span>
                        {payment.refundStatus && payment.refundStatus !== 'not_refunded' && (
                          <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${getRefundStatusColor(payment.refundStatus)}`}>
                            {payment.refundStatus}
                          </span>
                        )}
                        <span className="text-gray-400 text-sm">
                          {new Date(payment.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                        <div>
                          <p className="text-gray-500 text-sm">User</p>
                          <p className="text-gray-900">{payment.user?.name}</p>
                          <p className="text-gray-400 text-sm">{payment.user?.email}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Context</p>
                          <p className="text-gray-900">{getPaymentContextLabel(payment)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Reference</p>
                          <p className="text-gray-900 font-mono">{payment.paymentReference || payment.tapChargeId || '—'}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Amount</p>
                          <p className="text-gray-900 font-semibold">{payment.amount} {currency}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Type</p>
                          <p className="text-gray-900">{getPaymentTypeLabel(payment)}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 text-sm">Provider</p>
                          <p className="text-gray-900 uppercase">{payment.provider || 'tap'}</p>
                        </div>
                      </div>

                      {payment.checkoutMethod && (
                        <p className="mt-2 text-sm text-gray-500">
                          Method: {getCheckoutMethodLabel(payment.checkoutMethod)}
                        </p>
                      )}

                      {(payment.rejectionReason || payment.failureReason) && (
                        <p className="mt-2 text-red-600 text-sm">
                          Failure reason: {payment.rejectionReason || payment.failureReason}
                        </p>
                      )}

                      {payment.refundReason && (
                        <p className="mt-2 text-sky-700 text-sm">
                          Refund reason: {payment.refundReason}
                        </p>
                      )}

                      {payment.refundStatus === 'refunded' && (
                        <p className="mt-2 text-sky-700 text-sm">
                          Refunded: {payment.refundAmount} {payment.refundCurrency || currency}
                          {payment.refundedAt ? ` • ${new Date(payment.refundedAt).toLocaleString()}` : ''}
                        </p>
                      )}

                      {payment.tapChargeId && (
                        <p className="mt-2 text-xs text-gray-400">Tap charge: {payment.tapChargeId}</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {canRefund && (
                        <button
                          onClick={() => handleRefund(payment)}
                          disabled={recordIsBusy(payment._id)}
                          className="btn-secondary"
                        >
                          {actionIsRunning('refund', payment._id) ? 'Refunding...' : 'Refund'}
                        </button>
                      )}
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
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdminPayments;
