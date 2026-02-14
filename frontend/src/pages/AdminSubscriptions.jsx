import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { subscriptionsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function AdminSubscriptions() {
  const { showSuccess, showError } = useUIStore();
  const [subscriptions, setSubscriptions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [packageForm, setPackageForm] = useState({
    name: '',
    description: '',
    price: '',
    durationDays: 30,
    features: ''
  });

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsRes, pkgsRes] = await Promise.all([
        subscriptionsAPI.getAll(filter === 'all' ? undefined : filter),
        subscriptionsAPI.getPackages(false)
      ]);
      setSubscriptions(subsRes.data);
      setPackages(pkgsRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...packageForm,
        price: parseFloat(packageForm.price),
        features: packageForm.features.split('\n').filter(f => f.trim())
      };
      await subscriptionsAPI.createPackage(data);
      showSuccess('Package created successfully');
      setPackageForm({ name: '', description: '', price: '', durationDays: 30, features: '' });
      setShowPackageForm(false);
      fetchData();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to create package');
    }
  };

  const handleApprove = async (subscriptionId) => {
    try {
      await subscriptionsAPI.approve(subscriptionId);
      showSuccess('Subscription approved');
      fetchData();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to approve subscription');
    }
  };

  const handleCancel = async (subscriptionId) => {
    try {
      await subscriptionsAPI.cancel(subscriptionId);
      showSuccess('Subscription cancelled');
      fetchData();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to cancel subscription');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-50 text-green-600';
      case 'expired': return 'bg-red-50 text-red-600';
      case 'cancelled': return 'bg-gray-100 text-gray-500';
      default: return 'bg-yellow-50 text-yellow-600';
    }
  };

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Subscription Management</h1>
              <p className="text-gray-500">Manage subscriptions and packages</p>
            </div>
            <button
              onClick={() => setShowPackageForm(!showPackageForm)}
              className="btn-primary"
            >
              {showPackageForm ? 'Cancel' : 'Create Package'}
            </button>
          </div>

          {showPackageForm && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">New Package</h2>
              <form onSubmit={handleCreatePackage} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Name</label>
                    <input
                      type="text"
                      value={packageForm.name}
                      onChange={(e) => setPackageForm(f => ({ ...f, name: e.target.value }))}
                      className="input-field"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Price (SAR)</label>
                    <input
                      type="number"
                      value={packageForm.price}
                      onChange={(e) => setPackageForm(f => ({ ...f, price: e.target.value }))}
                      className="input-field"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Description</label>
                  <input
                    type="text"
                    value={packageForm.description}
                    onChange={(e) => setPackageForm(f => ({ ...f, description: e.target.value }))}
                    className="input-field"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Duration (days)</label>
                  <input
                    type="number"
                    value={packageForm.durationDays}
                    onChange={(e) => setPackageForm(f => ({ ...f, durationDays: parseInt(e.target.value) }))}
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Features (one per line)</label>
                  <textarea
                    value={packageForm.features}
                    onChange={(e) => setPackageForm(f => ({ ...f, features: e.target.value }))}
                    className="input-field"
                    rows={3}
                    placeholder="Full access to all courses&#10;Priority support&#10;Certificate of completion"
                  />
                </div>
                <button type="submit" className="btn-primary">Create Package</button>
              </form>
            </div>
          )}

          <div className="card mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Packages</h2>
            {packages.length === 0 ? (
              <p className="text-gray-500">No packages created yet</p>
            ) : (
              <div className="grid md:grid-cols-3 gap-4">
                {packages.map((pkg) => (
                  <div key={pkg._id} className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-medium text-gray-900">{pkg.name}</h3>
                    <p className="text-primary-500 font-semibold">{pkg.price} SAR</p>
                    <p className="text-gray-400 text-sm">{pkg.durationDays} days</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 mb-6">
            {['pending', 'active', 'expired', 'cancelled', 'all'].map((status) => (
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
          ) : subscriptions.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No subscriptions found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {subscriptions.map((sub) => (
                <div key={sub._id} className="card">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`px-3 py-1 rounded-lg text-sm font-medium capitalize ${getStatusColor(sub.status)}`}>
                          {sub.status}
                        </span>
                      </div>
                      <p className="text-gray-900 font-medium">{sub.user?.name}</p>
                      <p className="text-gray-500 text-sm">{sub.user?.email}</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Package: {sub.package?.name} ({sub.package?.price} SAR)
                      </p>
                      {sub.startDate && (
                        <p className="text-gray-400 text-sm">
                          {new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}
                        </p>
                      )}
                    </div>

                    {sub.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleApprove(sub._id)}
                          className="btn-primary"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleCancel(sub._id)}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
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

export default AdminSubscriptions;
