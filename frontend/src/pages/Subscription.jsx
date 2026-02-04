import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { subscriptionsAPI, paymentsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function Subscription() {
  const navigate = useNavigate();
  const { showSuccess, showError } = useUIStore();
  const [packages, setPackages] = useState([]);
  const [activeSubscription, setActiveSubscription] = useState(null);
  const [pendingSubscription, setPendingSubscription] = useState(null);
  const [bankDetails, setBankDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    paymentReference: '',
    amount: ''
  });
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [packagesRes, subRes, bankRes, userSubsRes] = await Promise.all([
        subscriptionsAPI.getPackages(),
        subscriptionsAPI.getActiveSubscription(),
        paymentsAPI.getBankDetails(),
        subscriptionsAPI.getUserSubscriptions()
      ]);
      setPackages(packagesRes.data);
      setActiveSubscription(subRes.data);
      setBankDetails(bankRes.data);
      
      const pending = userSubsRes.data.find(s => s.status === 'pending');
      setPendingSubscription(pending);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestSubscription = async (packageId) => {
    setRequesting(true);
    try {
      const response = await subscriptionsAPI.requestSubscription(packageId);
      setPendingSubscription(response.data);
      setShowPaymentForm(true);
      showSuccess('Subscription requested! Please submit your payment.');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to request subscription');
    } finally {
      setRequesting(false);
    }
  };

  const handleSubmitPayment = async (e) => {
    e.preventDefault();
    if (!pendingSubscription) return;

    try {
      await paymentsAPI.submit({
        subscriptionId: pendingSubscription._id,
        amount: parseFloat(paymentForm.amount),
        paymentReference: paymentForm.paymentReference
      });
      showSuccess('Payment submitted! Awaiting admin approval.');
      navigate('/dashboard/payments');
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to submit payment');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-white mb-2">Subscription Plans</h1>
          <p className="text-dark-400 mb-10">Choose a plan that works for you</p>

          {activeSubscription && (
            <div className="card bg-green-900/20 border-green-800 mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-900/50 rounded-xl flex items-center justify-center">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-green-300">Active Subscription</h3>
                  <p className="text-green-400/80">
                    {activeSubscription.package?.name} - Expires {new Date(activeSubscription.endDate).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
          )}

          {pendingSubscription && !showPaymentForm && (
            <div className="card bg-yellow-900/20 border-yellow-800 mb-8">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-yellow-900/50 rounded-xl flex items-center justify-center">
                    <span className="text-2xl">⏳</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-yellow-300">Pending Subscription</h3>
                    <p className="text-yellow-400/80">
                      {pendingSubscription.package?.name} - Awaiting payment
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentForm(true)}
                  className="btn-primary"
                >
                  Submit Payment
                </button>
              </div>
            </div>
          )}

          {showPaymentForm && pendingSubscription && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold text-white mb-6">Submit Payment</h2>
              
              <div className="bg-dark-800 rounded-lg p-4 mb-6">
                <h3 className="font-medium text-white mb-3">Bank Details</h3>
                <div className="space-y-2 text-sm">
                  <p><span className="text-dark-400">Bank:</span> <span className="text-white">{bankDetails?.bankName}</span></p>
                  <p><span className="text-dark-400">Account:</span> <span className="text-white">{bankDetails?.accountName}</span></p>
                  <p><span className="text-dark-400">Account Number:</span> <span className="text-white">{bankDetails?.accountNumber}</span></p>
                  <p><span className="text-dark-400">IBAN:</span> <span className="text-white">{bankDetails?.iban}</span></p>
                </div>
              </div>

              <form onSubmit={handleSubmitPayment} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Payment Reference
                  </label>
                  <input
                    type="text"
                    value={paymentForm.paymentReference}
                    onChange={(e) => setPaymentForm(f => ({ ...f, paymentReference: e.target.value }))}
                    className="input-field"
                    placeholder="Enter your bank transfer reference"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-dark-300 mb-2">
                    Amount Paid (SAR)
                  </label>
                  <input
                    type="number"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm(f => ({ ...f, amount: e.target.value }))}
                    className="input-field"
                    placeholder="Enter amount"
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="btn-primary">
                    Submit Payment
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPaymentForm(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {!activeSubscription && !pendingSubscription && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {packages.map((pkg, index) => (
                <motion.div
                  key={pkg._id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="card-hover"
                >
                  <h3 className="text-xl font-semibold text-white mb-2">{pkg.name}</h3>
                  <p className="text-dark-400 text-sm mb-4">{pkg.description}</p>
                  
                  <div className="mb-6">
                    <span className="text-3xl font-bold text-white">{pkg.price}</span>
                    <span className="text-dark-400"> SAR</span>
                    <span className="text-dark-500 text-sm"> / {pkg.durationDays} days</span>
                  </div>

                  {pkg.features?.length > 0 && (
                    <ul className="space-y-2 mb-6">
                      {pkg.features.map((feature, i) => (
                        <li key={i} className="flex items-center gap-2 text-sm text-dark-300">
                          <span className="text-green-400">✓</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  )}

                  <button
                    onClick={() => handleRequestSubscription(pkg._id)}
                    disabled={requesting}
                    className="btn-primary w-full"
                  >
                    {requesting ? 'Processing...' : 'Choose Plan'}
                  </button>
                </motion.div>
              ))}

              {packages.length === 0 && (
                <div className="col-span-full text-center py-10">
                  <p className="text-dark-400">No subscription packages available yet.</p>
                </div>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default Subscription;
