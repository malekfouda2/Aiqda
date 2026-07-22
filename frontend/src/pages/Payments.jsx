import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { paymentsAPI } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants } from '../utils/animations';
import { useLocale } from '../i18n/useLocale';

const getFriendlyPaymentReason = (message, isRTL) => {
  const normalizedMessage = String(message || '').trim();
  if (!normalizedMessage) {
    return '';
  }

  if (/no saved tap card|no saved tap billing agreement/i.test(normalizedMessage)) {
    return isRTL
      ? 'يلزم حفظ وسيلة دفع صالحة قبل تفعيل التجديد التلقائي.'
      : 'A valid payment method must be saved before automatic renewal can be enabled.';
  }

  if (/tap checkout is not configured|tap is not configured/i.test(normalizedMessage)) {
    return isRTL
      ? 'الدفع الإلكتروني غير متاح حاليًا.'
      : 'Electronic checkout is not available right now.';
  }

  return normalizedMessage
    .replace(/\bTap\b/gi, isRTL ? 'وسيلة الدفع' : 'payment method')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

const getPaymentTypeLabel = (payment, isRTL) => {
  switch (payment.paymentType) {
    case 'renewal':
      return isRTL ? 'تجديد تلقائي' : 'Automatic renewal';
    case 'recovery':
      return isRTL ? 'استعادة الاشتراك' : 'Recovery checkout';
    case 'consultation':
      return isRTL ? 'استشارة' : 'Consultation';
    case 'billing_profile_setup':
      return isRTL ? 'إعداد وسيلة الدفع' : 'Payment method setup';
    default:
      return isRTL ? 'دفع أولي' : 'Initial checkout';
  }
};

const getPaymentContextLabel = (payment, isRTL) => {
  if (payment.consultationBooking?.consultation?.title) {
    return payment.consultationBooking.consultation.title;
  }

  if (payment.subscription?.package?.name) {
    const billingTerm = payment.subscription.billingTerm;
    return billingTerm
      ? `${payment.subscription.package.name} (${billingTerm.replace(/_/g, ' ')})`
      : payment.subscription.package.name;
  }

  if (payment.paymentType === 'billing_profile_setup') {
    return isRTL ? 'حفظ وسيلة الدفع' : 'Saved payment method';
  }

  return '—';
};

const getCheckoutMethodLabel = (checkoutMethod, isRTL) => {
  switch (checkoutMethod) {
    case 'apple_pay':
      return 'Apple Pay';
    case 'saved_card':
      return isRTL ? 'البطاقة المحفوظة' : 'Saved payment method';
    case 'tabby':
      return 'Tabby';
    case 'tamara':
      return 'Tamara';
    default:
      return isRTL ? 'البطاقة' : 'Card';
  }
};

function Payments() {
  const { formatDate, isRTL } = useLocale();
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingSpinner size="lg" text={isRTL ? 'جارٍ تحميل المدفوعات...' : 'Loading payments...'} />
      </div>
    );
  }

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp}>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{isRTL ? 'سجل المدفوعات' : 'Payment History'}</h1>
        <p className="text-gray-500 mb-8">{isRTL ? 'اطلع على جميع عمليات الدفع والاسترداد الخاصة بحسابك' : 'View all payment attempts, confirmations, and refunds on your account'}</p>
      </motion.div>

      {payments.length === 0 ? (
        <motion.div variants={fadeInUp} className="card text-center py-12">
          <div className="text-5xl mb-4">💳</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">{isRTL ? 'لا توجد مدفوعات بعد' : 'No payments yet'}</h3>
          <p className="text-gray-500">{isRTL ? 'سيظهر سجل مدفوعاتك هنا' : 'Your payment history will appear here'}</p>
        </motion.div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
          {payments.map((payment) => {
            const currency = payment.currency || 'SAR';
            const refundCurrency = payment.refundCurrency || currency;

            return (
              <motion.div key={payment._id} variants={cardVariants} className="card">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                      {payment.refundStatus && payment.refundStatus !== 'not_refunded' && (
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${
                          payment.refundStatus === 'refunded'
                            ? 'bg-sky-50 text-sky-700'
                            : payment.refundStatus === 'failed'
                              ? 'bg-rose-50 text-rose-600'
                              : 'bg-amber-50 text-amber-700'
                        }`}>
                          {payment.refundStatus === 'refunded'
                            ? (isRTL ? 'تم الاسترداد' : 'Refunded')
                            : payment.refundStatus === 'pending'
                              ? (isRTL ? 'استرداد قيد المعالجة' : 'Refund pending')
                              : (isRTL ? 'فشل الاسترداد' : 'Refund failed')}
                        </span>
                      )}
                      <span className="text-gray-400 text-sm">
                        {formatDate(payment.createdAt)}
                      </span>
                    </div>

                    <p className="text-gray-900 font-medium">
                      {isRTL ? 'السياق:' : 'Context:'} {getPaymentContextLabel(payment, isRTL)}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {isRTL ? 'المرجع:' : 'Reference:'} {payment.paymentReference || payment.tapChargeId || '—'}
                    </p>
                    <p className="text-gray-500 text-sm">
                      {isRTL ? 'نوع العملية:' : 'Type:'} {getPaymentTypeLabel(payment, isRTL)}
                    </p>
                    {payment.checkoutMethod && (
                      <p className="text-gray-400 text-sm">
                        {isRTL ? 'وسيلة الدفع:' : 'Method:'} {getCheckoutMethodLabel(payment.checkoutMethod, isRTL)}
                      </p>
                    )}
                    {(payment.status === 'rejected' || payment.status === 'failed' || payment.status === 'cancelled') && (payment.rejectionReason || payment.failureReason) && (
                      <p className="text-red-600 text-sm">
                        {isRTL ? 'السبب:' : 'Reason:'} {getFriendlyPaymentReason(payment.rejectionReason || payment.failureReason, isRTL)}
                      </p>
                    )}
                    {payment.refundReason && (
                      <p className="text-sky-700 text-sm">
                        {isRTL ? 'سبب الاسترداد:' : 'Refund reason:'} {payment.refundReason}
                      </p>
                    )}
                  </div>

                  <div className="lg:text-right">
                    <p className="text-lg font-semibold text-gray-900">
                      {payment.amount} {currency}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {isRTL ? 'شامل ضريبة القيمة المضافة' : 'Includes VAT'}
                    </p>
                    {payment.refundStatus === 'refunded' && (
                      <p className="text-sm text-sky-700 mt-1">
                        {isRTL ? 'المسترد:' : 'Refunded:'} {payment.refundAmount} {refundCurrency}
                      </p>
                    )}
                    {payment.refundedAt && (
                      <p className="text-xs text-gray-400 mt-1">
                        {isRTL ? 'تاريخ الاسترداد:' : 'Refunded on:'} {formatDate(payment.refundedAt)}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}

export default Payments;
