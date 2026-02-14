import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { subscriptionsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

const emptyForm = {
  name: '',
  price: '',
  scheduleDuration: '',
  durationDays: 30,
  learningMode: '',
  focus: '',
  coursesActivities: '',
  softwareExposure: '',
  outcome: ''
};

function AdminSubscriptions() {
  const { showSuccess, showError } = useUIStore();
  const [subscriptions, setSubscriptions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageForm, setPackageForm] = useState({ ...emptyForm });

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

  const handleCreateOrUpdatePackage = async (e) => {
    e.preventDefault();
    try {
      const data = {
        name: packageForm.name,
        price: parseFloat(packageForm.price),
        scheduleDuration: packageForm.scheduleDuration,
        durationDays: parseInt(packageForm.durationDays) || 30,
        learningMode: packageForm.learningMode,
        focus: packageForm.focus,
        coursesActivities: packageForm.coursesActivities.split('\n').filter(f => f.trim()),
        softwareExposure: packageForm.softwareExposure.split('\n').filter(f => f.trim()),
        outcome: packageForm.outcome
      };

      if (editingPackage) {
        await subscriptionsAPI.updatePackage(editingPackage._id, data);
        showSuccess('Package updated successfully');
      } else {
        await subscriptionsAPI.createPackage(data);
        showSuccess('Package created successfully');
      }
      setPackageForm({ ...emptyForm });
      setEditingPackage(null);
      setShowPackageForm(false);
      fetchData();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to save package');
    }
  };

  const handleEditPackage = (pkg) => {
    setPackageForm({
      name: pkg.name || '',
      price: pkg.price?.toString() || '',
      scheduleDuration: pkg.scheduleDuration || '',
      durationDays: pkg.durationDays || 30,
      learningMode: pkg.learningMode || '',
      focus: pkg.focus || '',
      coursesActivities: (pkg.coursesActivities || []).join('\n'),
      softwareExposure: (pkg.softwareExposure || []).join('\n'),
      outcome: pkg.outcome || ''
    });
    setEditingPackage(pkg);
    setShowPackageForm(true);
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
              onClick={() => {
                if (showPackageForm) {
                  setShowPackageForm(false);
                  setEditingPackage(null);
                  setPackageForm({ ...emptyForm });
                } else {
                  setShowPackageForm(true);
                }
              }}
              className="btn-primary"
            >
              {showPackageForm ? 'Cancel' : 'Create Package'}
            </button>
          </div>

          {showPackageForm && (
            <div className="card mb-8">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                {editingPackage ? 'Edit Package' : 'New Package'}
              </h2>
              <form onSubmit={handleCreateOrUpdatePackage} className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Name *</label>
                    <input
                      type="text"
                      value={packageForm.name}
                      onChange={(e) => setPackageForm(f => ({ ...f, name: e.target.value }))}
                      className="input-field"
                      placeholder="e.g. Starter, Pro, Premium"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Price (SAR) *</label>
                    <input
                      type="number"
                      value={packageForm.price}
                      onChange={(e) => setPackageForm(f => ({ ...f, price: e.target.value }))}
                      className="input-field"
                      placeholder="e.g. 500"
                      required
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Schedule / Duration *</label>
                    <input
                      type="text"
                      value={packageForm.scheduleDuration}
                      onChange={(e) => setPackageForm(f => ({ ...f, scheduleDuration: e.target.value }))}
                      className="input-field"
                      placeholder="e.g. 3 months, 1 semester, 8 weeks"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Duration in Days (for subscription tracking)</label>
                    <input
                      type="number"
                      value={packageForm.durationDays}
                      onChange={(e) => setPackageForm(f => ({ ...f, durationDays: parseInt(e.target.value) || 30 }))}
                      className="input-field"
                      placeholder="e.g. 90"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Learning Mode *</label>
                    <input
                      type="text"
                      value={packageForm.learningMode}
                      onChange={(e) => setPackageForm(f => ({ ...f, learningMode: e.target.value }))}
                      className="input-field"
                      placeholder="e.g. Online, In-Person, Hybrid"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Focus *</label>
                    <input
                      type="text"
                      value={packageForm.focus}
                      onChange={(e) => setPackageForm(f => ({ ...f, focus: e.target.value }))}
                      className="input-field"
                      placeholder="e.g. 2D Animation, 3D Modeling, Motion Graphics"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Courses / Activities Included * (one per line)</label>
                  <textarea
                    value={packageForm.coursesActivities}
                    onChange={(e) => setPackageForm(f => ({ ...f, coursesActivities: e.target.value }))}
                    className="input-field"
                    rows={3}
                    placeholder={"Introduction to Animation\nCharacter Design Basics\nStoryboarding Workshop"}
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Software Exposure (one per line)</label>
                  <textarea
                    value={packageForm.softwareExposure}
                    onChange={(e) => setPackageForm(f => ({ ...f, softwareExposure: e.target.value }))}
                    className="input-field"
                    rows={3}
                    placeholder={"Adobe After Effects\nBlender\nAdobe Premiere Pro"}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Outcome *</label>
                  <textarea
                    value={packageForm.outcome}
                    onChange={(e) => setPackageForm(f => ({ ...f, outcome: e.target.value }))}
                    className="input-field"
                    rows={2}
                    placeholder="e.g. Students will be able to create short animated clips and have a portfolio-ready project"
                    required
                  />
                </div>

                <div className="flex gap-3">
                  <button type="submit" className="btn-primary">
                    {editingPackage ? 'Update Package' : 'Create Package'}
                  </button>
                  {editingPackage && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingPackage(null);
                        setPackageForm({ ...emptyForm });
                      }}
                      className="btn-secondary"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>
          )}

          <div className="card mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Packages</h2>
            {packages.length === 0 ? (
              <p className="text-gray-500">No packages created yet</p>
            ) : (
              <div className="space-y-4">
                {packages.map((pkg) => (
                  <div key={pkg._id} className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{pkg.name}</h3>
                        <p className="text-primary-500 font-bold text-xl">{pkg.price} SAR</p>
                      </div>
                      <button
                        onClick={() => handleEditPackage(pkg)}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium px-3 py-1 rounded-lg hover:bg-primary-50 transition-colors"
                      >
                        Edit
                      </button>
                    </div>
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      <div>
                        <span className="text-gray-400">Schedule:</span>{' '}
                        <span className="text-gray-700">{pkg.scheduleDuration || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Mode:</span>{' '}
                        <span className="text-gray-700">{pkg.learningMode || '—'}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Focus:</span>{' '}
                        <span className="text-gray-700">{pkg.focus || '—'}</span>
                      </div>
                      <div className="md:col-span-2 lg:col-span-3">
                        <span className="text-gray-400">Outcome:</span>{' '}
                        <span className="text-gray-700">{pkg.outcome || '—'}</span>
                      </div>
                    </div>
                    {pkg.coursesActivities?.length > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-400">Courses:</span>{' '}
                        <span className="text-gray-700">{pkg.coursesActivities.join(', ')}</span>
                      </div>
                    )}
                    {pkg.softwareExposure?.length > 0 && (
                      <div className="mt-1 text-sm">
                        <span className="text-gray-400">Software:</span>{' '}
                        <span className="text-gray-700">{pkg.softwareExposure.join(', ')}</span>
                      </div>
                    )}
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
