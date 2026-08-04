import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { subscriptionsAPI, coursesAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, fadeIn, fadeInScale, expandVariants } from '../utils/animations';
import { downloadCsv, formatCsvBoolean, formatCsvDate, formatCsvList } from '../utils/csv';
import {
  formatMoney,
  getActiveBillingOptions,
  getBillingTermLabel,
  getBillingSalePercentage,
  getEffectiveBillingPrice,
  getPackageAccessNames,
  getPackageSaleSummary,
  hasBillingSale,
} from '../utils/subscriptions';

const emptyForm = {
  name: '',
  nameAr: '',
  scheduleDuration: '',
  scheduleDurationAr: '',
  purchaseMode: 'self_serve',
  publicVisibility: 'visible',
  currency: 'SAR',
  monthlyPrice: '',
  monthlySalePrice: '',
  monthlyDurationDays: 30,
  sixMonthPrice: '',
  sixMonthSalePrice: '',
  sixMonthDurationDays: 180,
  annualPrice: '',
  annualSalePrice: '',
  annualDurationDays: 365,
  learningMode: '',
  learningModeAr: '',
  focus: '',
  focusAr: '',
  selectedCourses: [],
  includedPackages: [],
  softwareExposure: '',
  outcome: '',
  outcomeAr: ''
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
  const [processing, setProcessing] = useState(null);
  const currencyLabel = packageForm.currency || 'SAR';

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
              currency: packageForm.currency,
              salePrice: packageForm.monthlySalePrice ? parseFloat(packageForm.monthlySalePrice) : null,
              durationDays: parseInt(packageForm.monthlyDurationDays) || 30,
            }
          : null,
        packageForm.sixMonthPrice
          ? {
              term: 'six_months',
              label: '6 Months',
              price: parseFloat(packageForm.sixMonthPrice),
              currency: packageForm.currency,
              salePrice: packageForm.sixMonthSalePrice ? parseFloat(packageForm.sixMonthSalePrice) : null,
              durationDays: parseInt(packageForm.sixMonthDurationDays) || 180,
            }
          : null,
        packageForm.annualPrice
          ? {
              term: 'annual',
              label: 'Annual',
              price: parseFloat(packageForm.annualPrice),
              currency: packageForm.currency,
              salePrice: packageForm.annualSalePrice ? parseFloat(packageForm.annualSalePrice) : null,
              durationDays: parseInt(packageForm.annualDurationDays) || 365,
            }
          : null,
      ].filter(Boolean);

      const data = {
        name: packageForm.name,
        nameAr: packageForm.nameAr,
        scheduleDuration: packageForm.scheduleDuration,
        scheduleDurationAr: packageForm.scheduleDurationAr,
        purchaseMode: packageForm.purchaseMode,
        publicVisibility: packageForm.publicVisibility,
        currency: packageForm.currency,
        billingOptions: packageForm.purchaseMode === 'contact_only' ? [] : billingOptions,
        learningMode: packageForm.learningMode,
        learningModeAr: packageForm.learningModeAr,
        focus: packageForm.focus,
        focusAr: packageForm.focusAr,
        courses: packageForm.selectedCourses,
        includedPackages: packageForm.includedPackages,
        softwareExposure: packageForm.softwareExposure.split('\n').filter(f => f.trim()),
        outcome: packageForm.outcome,
        outcomeAr: packageForm.outcomeAr
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
    const sixMonthOption = pkg.billingOptions?.find((option) => option.term === 'six_months');
    const annualOption = pkg.billingOptions?.find((option) => option.term === 'annual');
    setPackageForm({
      name: pkg.name || '',
      nameAr: pkg.nameAr || '',
      scheduleDuration: pkg.scheduleDuration || '',
      scheduleDurationAr: pkg.scheduleDurationAr || '',
      purchaseMode: pkg.purchaseMode || 'self_serve',
      publicVisibility: pkg.publicVisibility || 'visible',
      currency: pkg.currency || monthlyOption?.currency || 'SAR',
      monthlyPrice: monthlyOption?.price?.toString() || '',
      monthlySalePrice: monthlyOption?.salePrice?.toString() || '',
      monthlyDurationDays: monthlyOption?.durationDays || 30,
      sixMonthPrice: sixMonthOption?.price?.toString() || '',
      sixMonthSalePrice: sixMonthOption?.salePrice?.toString() || '',
      sixMonthDurationDays: sixMonthOption?.durationDays || 180,
      annualPrice: annualOption?.price?.toString() || '',
      annualSalePrice: annualOption?.salePrice?.toString() || '',
      annualDurationDays: annualOption?.durationDays || 365,
      learningMode: pkg.learningMode || '',
      learningModeAr: pkg.learningModeAr || '',
      focus: pkg.focus || '',
      focusAr: pkg.focusAr || '',
      selectedCourses: (pkg.courses || []).map(c => typeof c === 'object' ? c._id : c),
      includedPackages: (pkg.includedPackages || []).map(pkgEntry => typeof pkgEntry === 'object' ? pkgEntry._id : pkgEntry),
      softwareExposure: (pkg.softwareExposure || []).join('\n'),
      outcome: pkg.outcome || '',
      outcomeAr: pkg.outcomeAr || ''
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

  const handleExportSubscriptions = () => {
    downloadCsv({
      filename: 'subscriptions',
      columns: [
        { key: 'memberName', label: 'Member Name' },
        { key: 'memberEmail', label: 'Member Email' },
        { key: 'packageName', label: 'Package' },
        { key: 'billingTerm', label: 'Billing Term' },
        { key: 'amount', label: 'Amount' },
        { key: 'currency', label: 'Currency' },
        { key: 'status', label: 'Status' },
        { key: 'startDate', label: 'Start Date' },
        { key: 'endDate', label: 'End Date' },
        { key: 'graceEndsAt', label: 'Grace Ends At' },
        { key: 'cancelEffectiveAt', label: 'Cancel Effective At' },
        { key: 'autoRenewEnabled', label: 'Auto Renew Enabled' },
        { key: 'autoRenewDisabledReason', label: 'Auto Renew Disabled Reason' },
        { key: 'renewalFailureReason', label: 'Renewal Failure Reason' },
        { key: 'createdAt', label: 'Created At' },
      ],
      rows: subscriptions.map((sub) => ({
        memberName: sub.user?.name || '',
        memberEmail: sub.user?.email || '',
        packageName: sub.package?.name || '',
        billingTerm: sub.billingTerm || '',
        amount: sub.priceAtPurchase ?? '',
        currency: sub.currency || sub.package?.currency || '',
        status: sub.status || '',
        startDate: formatCsvDate(sub.startDate),
        endDate: formatCsvDate(sub.endDate),
        graceEndsAt: formatCsvDate(sub.gracePeriodEndsAt),
        cancelEffectiveAt: formatCsvDate(sub.cancelEffectiveAt),
        autoRenewEnabled: formatCsvBoolean(sub.autoRenewEnabled),
        autoRenewDisabledReason: sub.autoRenewDisabledReason || '',
        renewalFailureReason: sub.renewalFailureReason || '',
        createdAt: formatCsvDate(sub.createdAt),
      })),
    });
  };

  const handleCancel = async (subscriptionId) => {
    setProcessing(`cancel-${subscriptionId}`);
    try {
      await subscriptionsAPI.cancel(subscriptionId);
      showSuccess('Subscription cancelled');
      await fetchData();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to cancel subscription');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (subscriptionId) => {
    if (!window.confirm('Delete this subscription record? This action cannot be undone.')) {
      return;
    }

    setProcessing(`delete-${subscriptionId}`);
    try {
      await subscriptionsAPI.remove(subscriptionId);
      showSuccess('Subscription deleted');
      await fetchData();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete subscription');
    } finally {
      setProcessing(null);
    }
  };

  const actionIsRunning = (action, id) => processing === `${action}-${id}`;
  const recordIsBusy = (id) => typeof processing === 'string' && processing.endsWith(`-${id}`);

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'bg-green-50 text-green-600';
      case 'grace_period': return 'bg-amber-50 text-amber-700';
      case 'cancel_scheduled': return 'bg-slate-100 text-slate-700';
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
                    <label className="block text-sm font-medium text-gray-600 mb-2">Name (Arabic)</label>
                    <input
                      type="text"
                      value={packageForm.nameAr}
                      onChange={(e) => setPackageForm(f => ({ ...f, nameAr: e.target.value }))}
                      className="input-field"
                      placeholder="مثال: البداية، برو، بريميوم"
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
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
                    <label className="block text-sm font-medium text-gray-600 mb-2">Homepage Visibility *</label>
                    <select
                      value={packageForm.publicVisibility}
                      onChange={(e) => setPackageForm(f => ({ ...f, publicVisibility: e.target.value }))}
                      className="input-field"
                      required
                    >
                      <option value="visible">Visible</option>
                      <option value="coming_soon">Coming Soon</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                  <div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 h-full">
                      <p className="text-sm font-medium text-gray-700 mb-1">Public Display</p>
                      <p className="text-sm text-gray-500 leading-6">
                        Visible packages show normally, Coming Soon packages stay on the homepage with a disabled CTA, and Hidden packages are removed from the public pricing sections.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Package Currency *</label>
                    <select
                      value={packageForm.currency}
                      onChange={(e) => setPackageForm((f) => ({ ...f, currency: e.target.value }))}
                      className="input-field"
                      required
                    >
                      {['SAR', 'AED', 'BHD', 'KWD', 'OMR', 'QAR', 'USD', 'EUR', 'GBP'].map((currency) => (
                        <option key={currency} value={currency}>{currency}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 h-full">
                      <p className="text-sm font-medium text-gray-700 mb-1">Currency Handling</p>
                      <p className="text-sm text-gray-500 leading-6">
                        All billing options in this package use the selected currency. Members will see and pay exactly in this currency.
                      </p>
                    </div>
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
                    <label className="block text-sm font-medium text-gray-600 mb-2">Schedule / Duration (Arabic)</label>
                    <input
                      type="text"
                      value={packageForm.scheduleDurationAr}
                      onChange={(e) => setPackageForm(f => ({ ...f, scheduleDurationAr: e.target.value }))}
                      className="input-field"
                      placeholder="مثال: 3 أشهر، فصل دراسي واحد، 8 أسابيع"
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 h-full">
                      <p className="text-sm font-medium text-gray-700 mb-1">Billing Setup</p>
                      <p className="text-sm text-gray-500 leading-6">
                        Configure monthly, 6-month, and annual pricing here. Contact-only packages can leave all terms empty.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid xl:grid-cols-3 gap-4">
                  <div className="rounded-2xl border border-gray-200 p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Monthly Billing</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">{`Monthly Price (${currencyLabel})`}</label>
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
                        <label className="block text-sm font-medium text-gray-600 mb-2">Monthly Sale Price (Optional)</label>
                        <input
                          type="number"
                          value={packageForm.monthlySalePrice}
                          onChange={(e) => setPackageForm(f => ({ ...f, monthlySalePrice: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. 249"
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
                    <h3 className="text-base font-semibold text-gray-900 mb-4">6-Month Billing</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">{`6-Month Price (${currencyLabel})`}</label>
                        <input
                          type="number"
                          value={packageForm.sixMonthPrice}
                          onChange={(e) => setPackageForm(f => ({ ...f, sixMonthPrice: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. 1599"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">6-Month Sale Price (Optional)</label>
                        <input
                          type="number"
                          value={packageForm.sixMonthSalePrice}
                          onChange={(e) => setPackageForm(f => ({ ...f, sixMonthSalePrice: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. 1299"
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">6-Month Duration in Days</label>
                        <input
                          type="number"
                          value={packageForm.sixMonthDurationDays}
                          onChange={(e) => setPackageForm(f => ({ ...f, sixMonthDurationDays: parseInt(e.target.value) || 180 }))}
                          className="input-field"
                          placeholder="180"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-gray-200 p-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-4">Annual Billing</h3>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">{`Annual Price (${currencyLabel})`}</label>
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
                        <label className="block text-sm font-medium text-gray-600 mb-2">Annual Sale Price (Optional)</label>
                        <input
                          type="number"
                          value={packageForm.annualSalePrice}
                          onChange={(e) => setPackageForm(f => ({ ...f, annualSalePrice: e.target.value }))}
                          className="input-field"
                          placeholder="e.g. 2199"
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
                      const effectiveMonthly = Number(packageForm.monthlySalePrice || packageForm.monthlyPrice);
                      const effectiveAnnual = Number(packageForm.annualSalePrice || packageForm.annualPrice);
                      const savings = (effectiveMonthly * 12) - effectiveAnnual;
                      return Number.isFinite(savings) && savings > 0 ? (
                        <div className="mt-4 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                          Annual savings preview: {formatMoney(savings)} {currencyLabel} compared to paying monthly for 12 months.
                        </div>
                      ) : null;
                    })()}
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Development Mode *</label>
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
                    <label className="block text-sm font-medium text-gray-600 mb-2">Development Mode (Arabic)</label>
                    <input
                      type="text"
                      value={packageForm.learningModeAr}
                      onChange={(e) => setPackageForm(f => ({ ...f, learningModeAr: e.target.value }))}
                      className="input-field"
                      placeholder="مثال: عبر الإنترنت، حضوري، هجين"
                      dir="rtl"
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
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
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Focus (Arabic)</label>
                    <input
                      type="text"
                      value={packageForm.focusAr}
                      onChange={(e) => setPackageForm(f => ({ ...f, focusAr: e.target.value }))}
                      className="input-field"
                      placeholder="مثال: التحريك ثنائي الأبعاد، النمذجة ثلاثية الأبعاد"
                      dir="rtl"
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
                                {course.category}
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

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">Outcome (Arabic)</label>
                  <textarea
                    value={packageForm.outcomeAr}
                    onChange={(e) => setPackageForm(f => ({ ...f, outcomeAr: e.target.value }))}
                    className="input-field"
                    rows={2}
                    placeholder="اكتب الوصف العربي الذي سيظهر على الموقع العربي"
                    dir="rtl"
                  />
                </div>

                <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4">
                  <p className="text-sm font-medium text-gray-700 mb-1">Arabic Translation</p>
                  <p className="text-sm text-gray-500 leading-6">
                    These Arabic fields are optional. When provided, the Arabic website will display them instead of the English package text.
                  </p>
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
                        {pkg.nameAr && (
                          <p className="mt-1 text-sm text-gray-500" dir="rtl">{pkg.nameAr}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold border ${
                              pkg.publicVisibility === 'hidden'
                                ? 'bg-gray-100 text-gray-600 border-gray-200'
                                : pkg.publicVisibility === 'coming_soon'
                                  ? 'bg-amber-50 text-amber-700 border-amber-100'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                            }`}
                          >
                            {pkg.publicVisibility === 'hidden'
                              ? 'Hidden'
                              : pkg.publicVisibility === 'coming_soon'
                                ? 'Coming Soon'
                                : 'Visible'}
                          </span>
                        </div>
                        {getPackageSaleSummary(pkg) && (
                          <div className="mt-2">
                            <span className="inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 border border-rose-100">
                              Sale up to {getPackageSaleSummary(pkg).bestSalePercentage}% off
                            </span>
                          </div>
                        )}
                        <div className="flex flex-wrap items-center gap-3 mt-2">
                          {getActiveBillingOptions(pkg).length > 0 ? (
                            getActiveBillingOptions(pkg).map((option) => (
                              <span key={option.term} className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-sm font-medium text-primary-700 border border-primary-100">
                                {getBillingTermLabel(option.term, 'en') || option.label || option.term}:
                                {hasBillingSale(option) ? (
                                  <>
                                    <span className="text-gray-400 line-through">{formatMoney(option.price)} {option.currency || pkg.currency || 'SAR'}</span>
                                    <span>{formatMoney(getEffectiveBillingPrice(option))} {option.currency || pkg.currency || 'SAR'}</span>
                                    <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-600 border border-rose-100">
                                      {getBillingSalePercentage(option)}% OFF
                                    </span>
                                  </>
                                ) : (
                                  <span>{formatMoney(option.price)} {option.currency || pkg.currency || 'SAR'}</span>
                                )}
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
                        <span className="text-gray-400">Homepage:</span>{' '}
                        <span className="text-gray-700">
                          {pkg.publicVisibility === 'hidden'
                            ? 'Hidden'
                            : pkg.publicVisibility === 'coming_soon'
                              ? 'Coming Soon'
                              : 'Visible'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400">Currency:</span>{' '}
                        <span className="text-gray-700">{pkg.currency || 'SAR'}</span>
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
                        {pkg.outcomeAr && (
                          <p className="mt-1 text-gray-500" dir="rtl">{pkg.outcomeAr}</p>
                        )}
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

          <motion.div variants={fadeInUp} className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex gap-3 overflow-x-auto pb-2">
              {['pending', 'active', 'grace_period', 'cancel_scheduled', 'expired', 'cancelled', 'all'].map((status) => (
                <button
                  key={status}
                  onClick={() => setFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    filter === status
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={handleExportSubscriptions}
              disabled={loading || subscriptions.length === 0}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-black disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 16V4m0 12l-4-4m4 4l4-4M4 20h16" />
              </svg>
              Export CSV
            </button>
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
                        {sub.billingTerm ? ` (${getBillingTermLabel(sub.billingTerm, 'en') || sub.billingTerm})` : ''}
                        {sub.priceAtPurchase ? ` - ${formatMoney(sub.priceAtPurchase)} ${sub.currency || sub.package?.currency || 'SAR'}` : ''}
                      </p>
                      {sub.startDate && (
                        <p className="text-gray-400 text-sm">
                          {new Date(sub.startDate).toLocaleDateString()} - {new Date(sub.endDate).toLocaleDateString()}
                        </p>
                      )}
                      <p className="text-gray-400 text-sm mt-1">
                        Auto-renew: {sub.autoRenewEnabled
                          ? 'On'
                          : sub.autoRenewDisabledReason === 'payment_failed'
                            ? 'Off after payment failure'
                            : 'Off'}
                      </p>
                    </div>

                    {sub.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCancel(sub._id)}
                          disabled={recordIsBusy(sub._id)}
                          className="btn-secondary"
                        >
                          {actionIsRunning('cancel', sub._id) ? 'Cancelling...' : 'Cancel'}
                        </button>
                        <button
                          onClick={() => handleDelete(sub._id)}
                          disabled={recordIsBusy(sub._id)}
                          className="bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-5 rounded-lg transition-all"
                        >
                          {actionIsRunning('delete', sub._id) ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                    {sub.status !== 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(sub._id)}
                          disabled={recordIsBusy(sub._id)}
                          className="bg-gray-900 hover:bg-black text-white font-medium py-2.5 px-5 rounded-lg transition-all"
                        >
                          {actionIsRunning('delete', sub._id) ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                  {sub.status === 'pending' && (
                    <p className="text-sm text-gray-400 mt-3">
                      Pending subscriptions are activated automatically after successful Tap payment capture.
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
