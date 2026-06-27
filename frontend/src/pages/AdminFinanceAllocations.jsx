import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { financeAPI, subscriptionsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants } from '../utils/animations';

function AdminFinanceAllocations() {
  const { showSuccess, showError } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState([]);
  const [selectedPkg, setSelectedPkg] = useState('');
  const [courses, setCourses] = useState([]); // [{ id, title, percent }]
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await subscriptionsAPI.getPackages(true);
        setPackages(data || []);
      } catch (error) {
        showError(error.response?.data?.error || 'Failed to load packages');
      } finally {
        setLoading(false);
      }
    })();
  }, [showError]);

  const loadPackage = async (pkgId) => {
    setSelectedPkg(pkgId);
    setCourses([]);
    if (!pkgId) return;
    try {
      const [{ data: pkg }, { data: allocations }] = await Promise.all([
        subscriptionsAPI.getPackageById(pkgId),
        financeAPI.getAllocations(pkgId),
      ]);
      const bpsByCourse = new Map((allocations || []).map((a) => [(a.course?._id || a.course).toString(), a.percentageBps]));
      const rows = (pkg.courses || []).map((c) => {
        const courseId = (c._id || c).toString();
        return {
          id: courseId,
          title: c.title || courseId,
          percent: bpsByCourse.has(courseId) ? bpsByCourse.get(courseId) / 100 : '',
        };
      });
      setCourses(rows);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load package allocations');
    }
  };

  const total = courses.reduce((acc, c) => acc + Number(c.percent || 0), 0);

  const save = async () => {
    if (total > 100) { showError('Total allocation cannot exceed 100%.'); return; }
    setBusy(true);
    try {
      const entries = courses
        .filter((c) => Number(c.percent) > 0)
        .map((c) => ({ course: c.id, percentageBps: Math.round(Number(c.percent) * 100) }));
      await financeAPI.saveAllocations({ package: selectedPkg, entries });
      showSuccess('Allocations saved (applies to new payments only).');
      loadPackage(selectedPkg);
    } catch (error) {
      showError(error.response?.data?.error || 'Save failed');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" className="space-y-4 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900">Revenue allocation</h1>
      <p className="text-sm text-gray-500">
        Set each chapter's share of the creator pool for a tier. Leave blank for the default equal split.
        Changes apply only to future payments — historical earnings keep their snapshot.
      </p>

      <select value={selectedPkg} onChange={(e) => loadPackage(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
        <option value="">Select a subscription tier…</option>
        {packages.map((p) => <option key={p._id} value={p._id}>{p.name}</option>)}
      </select>

      {selectedPkg && (
        <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3">
          {courses.length === 0 ? (
            <p className="text-sm text-gray-400">This tier has no chapters.</p>
          ) : courses.map((c, idx) => (
            <div key={c.id} className="flex items-center justify-between gap-3">
              <span className="text-sm text-gray-800">{c.title}</span>
              <div className="flex items-center gap-1">
                <input
                  type="number" min="0" max="100" step="0.1"
                  value={c.percent}
                  placeholder="auto"
                  onChange={(e) => setCourses((rows) => rows.map((r, i) => i === idx ? { ...r, percent: e.target.value } : r))}
                  className="w-24 border rounded-lg px-2 py-1 text-sm text-right"
                />
                <span className="text-sm text-gray-400">%</span>
              </div>
            </div>
          ))}
          {courses.length > 0 && (
            <div className="flex items-center justify-between border-t pt-3">
              <span className={`text-sm font-medium ${total > 100 ? 'text-rose-600' : 'text-gray-600'}`}>Total: {total.toFixed(1)}% {total < 100 && total > 0 ? '(remainder to platform)' : ''}</span>
              <button onClick={save} disabled={busy || total > 100} className="btn-primary text-sm disabled:opacity-50">Save</button>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

export default AdminFinanceAllocations;
