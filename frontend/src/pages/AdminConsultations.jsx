import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { consultationsAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants } from '../utils/animations';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

function AdminConsultations() {
  const { showSuccess, showError } = useUIStore();
  const [consultations, setConsultations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [processing, setProcessing] = useState(false);

  const initialFormState = {
    title: '',
    description: '',
    priceType: 'fixed',
    price: '',
    currency: 'SAR',
    duration: '',
    mode: '1 to 1',
    focusPoints: [''],
    zoomSchedulerLink: '',
    isActive: true,
    order: 0
  };

  const [formData, setFormData] = useState(initialFormState);

  useBodyScrollLock(modalOpen);

  useEffect(() => {
    fetchConsultations();
  }, []);

  const fetchConsultations = async () => {
    setLoading(true);
    try {
      // For admin we might want to see all including inactive
      const response = await consultationsAPI.getActive(); // Using getActive for now as per T001
      setConsultations(response.data);
    } catch (error) {
      showError('Failed to fetch consultations');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAdd = () => {
    setFormData(initialFormState);
    setIsEditing(false);
    setModalOpen(true);
  };

  const handleOpenEdit = (consultation) => {
    setFormData({
      ...consultation,
      price: consultation.price || ''
    });
    setIsEditing(true);
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const data = {
        ...formData,
        price: formData.priceType === 'fixed' ? Number(formData.price) : null,
        focusPoints: formData.focusPoints.filter(p => p.trim() !== '')
      };

      if (isEditing) {
        await consultationsAPI.update(formData._id, data);
        showSuccess('Consultation updated successfully');
      } else {
        await consultationsAPI.create(data);
        showSuccess('Consultation created successfully');
      }
      setModalOpen(false);
      fetchConsultations();
    } catch (error) {
      showError(error.response?.data?.error || 'Operation failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this consultation type?')) return;
    try {
      await consultationsAPI.remove(id);
      showSuccess('Consultation deleted');
      fetchConsultations();
    } catch (error) {
      showError('Failed to delete consultation');
    }
  };

  const addFocusPoint = () => {
    setFormData({ ...formData, focusPoints: [...formData.focusPoints, ''] });
  };

  const removeFocusPoint = (index) => {
    const newPoints = formData.focusPoints.filter((_, i) => i !== index);
    setFormData({ ...formData, focusPoints: newPoints });
  };

  const updateFocusPoint = (index, value) => {
    const newPoints = [...formData.focusPoints];
    newPoints[index] = value;
    setFormData({ ...formData, focusPoints: newPoints });
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <motion.div variants={fadeInUp}>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Consultations</h1>
          <p className="text-gray-500">Create and manage your expert consultation types</p>
        </motion.div>
        <motion.button
          variants={fadeInUp}
          onClick={handleOpenAdd}
          className="btn-primary"
        >
          <span className="mr-2">+</span> Add New Consultation
        </motion.button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : consultations.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-gray-500">No consultation types found. Create your first one!</p>
        </div>
      ) : (
        <div className="card overflow-hidden border-none shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Order</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Consultation</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Price</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Mode/Duration</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {consultations.map((item) => (
                  <tr key={item._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm text-gray-500">{item.order}</td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-gray-900">{item.title}</p>
                      <p className="text-xs text-gray-400 line-clamp-1">{item.description}</p>
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                      {item.priceType === 'fixed' ? `${item.price} ${item.currency}` : 'Contract'}
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 font-medium">{item.mode}</p>
                      <p className="text-xs text-gray-500">{item.duration}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${item.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {item.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-2">
                        <button onClick={() => handleOpenEdit(item)} className="p-2 hover:bg-primary-50 text-primary-600 rounded-lg transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                        <button onClick={() => handleDelete(item._id)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors">
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="app-modal-shell z-50">
            <div className="app-modal-backdrop" onClick={() => setModalOpen(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.99, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.99, y: 12 }} transition={{ duration: 0.18, ease: 'easeOut' }} className="app-modal-panel max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">{isEditing ? 'Edit' : 'Add'} Consultation</h2>
                <button onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="app-modal-scroll overflow-y-auto p-6 space-y-6 flex-1">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                    <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required className="input-field" placeholder="e.g. Creative Audit" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} className="input-field min-h-[100px] resize-none" placeholder="Enter consultation description..." />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Price Type</label>
                    <select value={formData.priceType} onChange={(e) => setFormData({ ...formData, priceType: e.target.value })} className="input-field">
                      <option value="fixed">Fixed Price</option>
                      <option value="contract">Contract Based</option>
                    </select>
                  </div>
                  {formData.priceType === 'fixed' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Price (SAR)</label>
                      <input type="number" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} required={formData.priceType === 'fixed'} className="input-field" />
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                    <input type="text" value={formData.duration} onChange={(e) => setFormData({ ...formData, duration: e.target.value })} required className="input-field" placeholder="e.g. 30 minutes" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mode</label>
                    <input type="text" value={formData.mode} onChange={(e) => setFormData({ ...formData, mode: e.target.value })} required className="input-field" placeholder="e.g. 1 to 1" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Zoom Scheduler Link</label>
                    <input type="url" value={formData.zoomSchedulerLink} onChange={(e) => setFormData({ ...formData, zoomSchedulerLink: e.target.value })} required className="input-field" placeholder="https://scheduler.zoom.us/..." />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">Focus Points</label>
                    <div className="space-y-3">
                      {formData.focusPoints.map((point, index) => (
                        <div key={index} className="flex gap-2">
                          <input type="text" value={point} onChange={(e) => updateFocusPoint(index, e.target.value)} className="input-field" placeholder="Enter a focus point..." />
                          <button type="button" onClick={() => removeFocusPoint(index)} className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-gray-200">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" /></svg>
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={addFocusPoint} className="flex items-center gap-2 text-sm text-primary-600 font-medium hover:text-primary-700">
                        <span>+ Add Point</span>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
                    <input type="number" value={formData.order} onChange={(e) => setFormData({ ...formData, order: Number(e.target.value) })} className="input-field" />
                  </div>
                  <div className="flex items-center gap-2 pt-8">
                    <input type="checkbox" id="isActive" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500" />
                    <label htmlFor="isActive" className="text-sm font-medium text-gray-700 cursor-pointer">Active</label>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" disabled={processing} className="btn-primary flex-1">{processing ? 'Processing...' : (isEditing ? 'Update' : 'Create')}</button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AdminConsultations;
