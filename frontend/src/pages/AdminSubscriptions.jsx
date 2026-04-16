import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscriptionsAPI, coursesAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, fadeIn, fadeInScale, expandVariants } from '../utils/animations';
import { formatMoney, getPackageAccessNames } from '../utils/subscriptions';

const emptyForm = {
  name: '',
  scheduleDuration: '',
  purchaseMode: 'self_serve',
  monthlyPrice: '',
  monthlyDurationDays: 30,
  annualPrice: '',
  annualDurationDays: 365,
  learningMode: '',
  focus: '',
  selectedCourses: [],
  includedPackages: [],
  softwareExposure: '',
  outcome: ''
};

function AdminSubscriptions() {
  const { showSuccess, showError } = useUIStore();
  const [subscriptions, setSubscriptions] = useState([]);
  const [packages, setPackages] = useState([]);
  const [allCourses, setAllCourses] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [showPackageForm, setShowPackageForm] = useState(false);
  const [editingPackage, setEditingPackage] = useState(null);
  const [packageForm, setPackageForm] = useState({ ...emptyForm });
  const [courseSearch, setCourseSearch] = useState('');

  useEffect(() => {
    fetchData();
  }, [filter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [subsRes, pkgsRes, coursesRes] = await Promise.all([
        subscriptionsAPI.getAll(filter === 'all' ? undefined : filter),
        subscriptionsAPI.getPackages(false),
        coursesAPI.getAll()
      ]);
      setSubscriptions(subsRes.data);
      setPackages(pkgsRes.data);
      setAllCourses(coursesRes.data?.courses || coursesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdatePackage = async (e) => {
    e.preventDefault();
    try {
      const billingOptions = [
        packageForm.monthlyPrice
          ? {
              term: 'monthly',
              label: 'Monthly',
              price: parseFloat(packageForm.monthlyPrice),
              durationDays: parseInt(packageForm.monthlyDurationDays) || 30,
            }
          : null,
        packageForm.annualPrice
          ? {
              term: 'annual',
              label: 'Annual',
              price: parseFloat(packageForm.annualPrice),
              durationDays: parseInt(packageForm.annualDurationDays) || 365,
            }
          : null,
      ].filter(Boolean);

      const data = {
        name: packageForm.name,
        scheduleDuration: packageForm.scheduleDuration,
        purchaseMode: packageForm.purchaseMode,
        billingOptions: packageForm.purchaseMode === 'contact_only' ? [] : billingOptions,
        learningMode: packageForm.learningMode,
        focus: packageForm.focus,
        courses: packageForm.selectedCourses,
        includedPackages: packageForm.includedPackages,
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
    const monthlyOption = pkg.billingOptions?.find((option) => option.term === 'monthly');
    const annualOption = pkg.billingOptions?.find((option) => option.term === 'annual');
    setPackageForm({
      name: pkg.name || '',
      scheduleDuration: pkg.scheduleDuration || '',
      purchaseMode: pkg.purchaseMode || 'self_serve',
      monthlyPrice: monthlyOption?.price?.toString() || '',
      monthlyDurationDays: monthlyOption?.durationDays || 30,
      annualPrice: annualOption?.price?.toString() || '',
      annualDurationDays: annualOption?.durationDays || 365,
      learningMode: pkg.learningMode || '',
      focus: pkg.focus || '',
      selectedCourses: (pkg.courses || []).map(c => typeof c === 'object' ? c._id : c),
      includedPackages: (pkg.includedPackages || []).map(pkgEntry => typeof pkgEntry === 'object' ? pkgEntry._id : pkgEntry),
      softwareExposure: (pkg.softwareExposure || []).join('\n'),
      outcome: pkg.outcome || ''
    });
    setEditingPackage(pkg);
    setShowPackageForm(true);
  };

  const toggleCourse = (courseId) => {
    setPackageForm(f => ({
      ...f,
      selectedCourses: f.selectedCourses.includes(courseId)
        ? f.selectedCourses.filter(id => id !== courseId)
        : [...f.selectedCourses, courseId]
    }));
  };

  const toggleIncludedPackage = (packageId) => {
    setPackageForm((current) => ({
      ...current,
      includedPackages: current.includedPackages.includes(packageId)
        ? current.includedPackages.filter((id) => id !== packageId)
        : [...current.includedPackages, packageId],
    }));
  };

  const filteredCourses = allCourses.filter(c =>
    c.title?.toLowerCase().includes(courseSearch.toLowerCase()) ||
    c.category?.toLowerCase().includes(courseSearch.toLowerCase())
  );

  const availableIncludedPackages = packages.filter((pkg) => pkg._id !== editingPackage?._id);

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
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp} className="flex items-center justify-between mb-8">
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
                  setCourseSearch('');
                } else {
                  setShowPackageForm(true);
                }
              }}
              className="btn-primary"
            >
              {showPackageForm ? 'Cancel' : 'Create Package'}
            </button>
          </motion.div>

          <AnimatePresence>
            {showPackageForm && (
              <motion.div
                variants={expandVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                className="overflow-hidden"
              >
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
                    <label className="block text-sm font-medium text-gray-600 mb-2">Package Type *</label>
                    <select
                      value={packageForm.purchaseMode}
                      onChange={(e) => setPackageForm(f => ({ ...f, purchaseMode: e.target.value }))}
                      className="input-field"
                      required
                    >
                      <option value="self_serve">Self-Serve Subscription</option>
                      <option value="contact_only">Contact / Appointment Only</option>
                    </select>
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
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 h-full">
                      <p className="text-sm font-medium text-gray-700 mb-1">Billing Setup</p>
                      <p className="text-sm text-gray-500 leading-6">
                        Configure monthly and annual pricing here. Contact-only packages can leave both terms empty.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Billing</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Monthly Price (SAR)</label>
                        <input
                          type="number"
                          value={packageForm.monthlyPrice}
                          onChange={(e) => setPackageForm(f => ({ ...f, monthlyPrice: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. 299"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Monthly Duration in Days</label>
                        <input
                          type="number"
                          value={packageForm.monthlyDurationDays}
                          onChange={(e) => setPackageForm(f => ({ ...f, monthlyDurationDays: parseInt(e.target.value) || 30 }))}
                          className="input-field"
                          placeholder="30"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Annual Billing</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Annual Price (SAR)</label>
                        <input
                          type="number"
                          value={packageForm.annualPrice}
                          onChange={(e) => setPackageForm(f => ({ ...f, annualPrice: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. 2990"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Annual Duration in Days</label>
                        <input
                          type="number"
                          value={packageForm.annualDurationDays}
                          onChange={(e) => setPackageForm(f => ({ ...f, annualDurationDays: parseInt(e.target.value) || 365 }))}
                          className="input-field"
                          placeholder="365"
                          min="1"
                        />
                      </div>
                    </div>

                    {packageForm.monthlyPrice && packageForm.annualPrice && (() => {
                      const savings = (Number(packageForm.monthlyPrice) * 12) - Number(packageForm.annualPrice);
                      return Number.isFinite(savings) && savings > 0 ? (
                        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          Annual savings preview: {formatMoney(savings)} SAR compared to paying monthly for 12 months.
                        </div>
                      ) : null;
                    })()}
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
                  <label className="block text-sm font-medium text-gray-600 mb-2">Chapters / Activities Included</label>
                  
                  {packageForm.selectedCourses.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {packageForm.selectedCourses.map(courseId => {
                        const course = allCourses.find(c => c._id === courseId);
                        return (
                          <span
                            key={courseId}
                            className="inline-flex items-center gap-1.5 bg-primary-50 text-primary-700 px-3 py-1.5 rounded-lg text-sm font-medium"
                          >
                            {course?.title || courseId}
                            <button
                              type="button"
                              onClick={() => toggleCourse(courseId)}
                              className="text-primary-400 hover:text-primary-600 ml-1"
                            >
                              x
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <input
                    type="text"
                    value={courseSearch}
                    onChange={(e) => setCourseSearch(e.target.value)}
                    className="input-field mb-2"
                    placeholder="Search chapters to add..."
                  />

                  <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {filteredCourses.length === 0 ? (
                      <p className="text-gray-400 text-sm p-3 text-center">
                        {allCourses.length === 0 ? 'No chapters created yet' : 'No matching chapters'}
                      </p>
                    ) : (
                      filteredCourses.map(course => {
                        const isSelected = packageForm.selectedCourses.includes(course._id);
                        return (
                          <button
                            key={course._id}
                            type="button"
                            onClick={() => toggleCourse(course._id)}
                            className={`w-full text-left px-4 py-2.5 flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors ${
                              isSelected
                                ? 'bg-primary-50 text-primary-700'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div>
                              <span className="text-sm font-medium">{course.title}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                {course.category} - {course.level}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="text-primary-500 text-sm font-medium">Selected</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Included Package Access</label>
                  {packageForm.includedPackages.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {packageForm.includedPackages.map((packageId) => {
                        const packageEntry = availableIncludedPackages.find((pkg) => pkg._id === packageId);
                        return (
                          <span
                            key={packageId}
                            className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg text-sm font-medium"
                          >
                            {packageEntry?.name || packageId}
                            <button
                              type="button"
                              onClick={() => toggleIncludedPackage(packageId)}
                              className="text-emerald-500 hover:text-emerald-700 ml-1"
                            >
                              x
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  <div className="border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {availableIncludedPackages.length === 0 ? (
                      <p className="text-gray-400 text-sm p-3 text-center">
                        Create another package first to enable included access.
                      </p>
                    ) : (
                      availableIncludedPackages.map((pkg) => {
                        const isSelected = packageForm.includedPackages.includes(pkg._id);
                        return (
                          <button
                            key={pkg._id}
                            type="button"
                            onClick={() => toggleIncludedPackage(pkg._id)}
                            className={`w-full text-left px-4 py-2.5 flex items-center justify-between border-b border-gray-100 last:border-0 transition-colors ${
                              isSelected
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'hover:bg-gray-50 text-gray-700'
                            }`}
                          >
                            <div>
                              <span className="text-sm font-medium">{pkg.name}</span>
                              <span className="text-xs text-gray-400 ml-2">
                                {pkg.purchaseMode === 'contact_only' ? 'Contact-only' : 'Self-serve'}
                              </span>
                            </div>
                            {isSelected && (
                              <span className="text-emerald-600 text-sm font-medium">Included</span>
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
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
                    placeholder="e.g. Members will be able to create short animated clips and have a portfolio-ready project"
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
                        setCourseSearch('');
                      }}
                      className="btn-secondary"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </form>
            </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div variants={fadeInUp} className="card mb-8">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Packages</h2>
            {packages.length === 0 ? (
              <p className="text-gray-500">No packages created yet</p>
            ) : (
              <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
                {packages.map((pkg) => (
                  <motion.div key={pkg._id} variants={cardVariants} className="bg-gray-50 rounded-lg p-5 border border-gray-100">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">{pkg.name}</h3>
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {(pkg.billingOptions || []).length > 0 ? (
                            (pkg.billingOptions || []).map((option) => (
                              <span key={option.term} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-primary-700 border border-primary-100">
                                {option.term === 'annual' ? 'Annual' : 'Monthly'}: {formatMoney(option.price)} SAR
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-white px-3 py-1 text-sm font-medium text-gray-600 border border-gray-200">
                              Contact / Appointment Only
                            </span>
                          )}
                        </div>
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
                        <span className="text-gray-400">Type:</span>{' '}
                        <span className="text-gray-700">{pkg.purchaseMode === 'contact_only' ? 'Contact-only' : 'Self-serve'}</span>
                      </div>
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
                    {getPackageAccessNames(pkg).length > 1 && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-400">Included access:</span>{' '}
                        <span className="text-gray-700">
                          {getPackageAccessNames(pkg).slice(1).join(', ')}
                        </span>
                      </div>
                    )}
                    {pkg.courses?.length > 0 && (
                      <div className="mt-2 text-sm">
                        <span className="text-gray-400">Chapters:</span>{' '}
                        <span className="text-gray-700">
                          {pkg.courses.map(c => typeof c === 'object' ? c.title : c).join(', ')}
                        </span>
                      </div>
                    )}
                    {pkg.softwareExposure?.length > 0 && (
                      <div className="mt-1 text-sm">
                        <span className="text-gray-400">Software:</span>{' '}
                        <span className="text-gray-700">{pkg.softwareExposure.join(', ')}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </motion.div>

          <motion.div variants={fadeInUp} className="flex gap-3 mb-6">
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
          </motion.div>

          {loading ? (
            <motion.div variants={fadeIn} className="flex justify-center py-12">
              <LoadingSpinner />
            </motion.div>
          ) : subscriptions.length === 0 ? (
            <motion.div variants={fadeInUp} className="card text-center py-12">
              <p className="text-gray-500">No subscriptions found</p>
            </motion.div>
          ) : (
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-4">
              {subscriptions.map((sub) => (
                <motion.div key={sub._id} variants={cardVariants} className="card">
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
                        Package: {sub.package?.name}
                        {sub.billingTerm ? ` (${sub.billingTerm === 'annual' ? 'Annual' : 'Monthly'})` : ''}
                        {sub.priceAtPurchase ? ` - ${formatMoney(sub.priceAtPurchase)} SAR` : ''}
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
                          onClick={() => handleCancel(sub._id)}
                          className="btn-secondary"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                  {sub.status === 'pending' && (
                    <p className="text-sm text-gray-400 mt-3">
                      Pending subscriptions are activated from Payment Management after payment review.
                    </p>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
    </motion.div>
  );
}

export default AdminSubscriptions;
