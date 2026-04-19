import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import LoadingSpinner from '../components/LoadingSpinner';
import useUIStore from '../store/uiStore';
import { partnersAPI } from '../services/api';
import { buildUploadUrl } from '../utils/uploads';
import { pageVariants, fadeInUp, cardVariants } from '../utils/animations';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

const buildInitialFormState = () => ({
  _id: null,
  name: '',
  website: '',
  order: 0,
  isActive: true,
  removeImage: false,
  image: null,
  existingImage: null,
});

function AdminPartners() {
  const { showSuccess, showError } = useUIStore();
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(buildInitialFormState());
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  useBodyScrollLock(modalOpen);

  useEffect(() => {
    fetchPartners();
  }, []);

  const fetchPartners = async () => {
    setLoading(true);
    try {
      const response = await partnersAPI.getAll();
      setPartners(response.data);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load partners');
    } finally {
      setLoading(false);
    }
  };

  const filteredPartners = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return partners;
    }

    return partners.filter((partner) => (
      [partner.name, partner.website]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    ));
  }, [partners, searchTerm]);

  useEffect(() => {
    if (formData.image) {
      const objectUrl = URL.createObjectURL(formData.image);
      setImagePreviewUrl(objectUrl);

      return () => {
        URL.revokeObjectURL(objectUrl);
      };
    }

    if (!formData.removeImage && formData.existingImage) {
      setImagePreviewUrl(buildUploadUrl(formData.existingImage));
      return undefined;
    }

    setImagePreviewUrl(null);
    return undefined;
  }, [formData.image, formData.existingImage, formData.removeImage]);

  const openCreateModal = () => {
    setFormData({
      ...buildInitialFormState(),
      order: partners.length + 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (partner) => {
    setFormData({
      _id: partner._id,
      name: partner.name,
      website: partner.website || '',
      order: partner.order ?? 0,
      isActive: partner.isActive,
      removeImage: false,
      image: null,
      existingImage: partner.image || null,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (processing) {
      return;
    }

    setModalOpen(false);
    setFormData(buildInitialFormState());
  };

  const handleImageChange = (event) => {
    const [file] = event.target.files || [];
    setFormData((current) => ({
      ...current,
      image: file || null,
      removeImage: false,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setProcessing(true);

    try {
      const payload = new FormData();
      payload.append('name', formData.name);
      payload.append('website', formData.website);
      payload.append('order', String(formData.order));
      payload.append('isActive', String(formData.isActive));
      payload.append('removeImage', String(formData.removeImage));

      if (formData.image) {
        payload.append('image', formData.image);
      }

      if (formData._id) {
        await partnersAPI.update(formData._id, payload);
        showSuccess('Partner updated successfully');
      } else {
        await partnersAPI.create(payload);
        showSuccess('Partner created successfully');
      }

      closeModal();
      await fetchPartners();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to save partner');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this partner?')) {
      return;
    }

    try {
      await partnersAPI.remove(id);
      showSuccess('Partner deleted successfully');
      await fetchPartners();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete partner');
    }
  };

  const activeCount = partners.filter((partner) => partner.isActive).length;
  const inactiveCount = partners.length - activeCount;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Partners</h1>
          <p className="text-gray-500">Control the Our Partners sections on the Home and About pages.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by partner name or website..."
              className="input-field pl-10 w-full sm:w-80"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button onClick={openCreateModal} className="btn-primary whitespace-nowrap">
            <span className="mr-2">+</span>Add Partner
          </button>
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
          <p className="text-xs uppercase tracking-widest text-primary-600 font-semibold mb-2">Total</p>
          <p className="text-2xl font-bold text-gray-900">{partners.length}</p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
          <p className="text-xs uppercase tracking-widest text-green-600 font-semibold mb-2">Active</p>
          <p className="text-2xl font-bold text-gray-900">{activeCount}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
          <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2">Inactive</p>
          <p className="text-2xl font-bold text-gray-900">{inactiveCount}</p>
        </div>
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" text="Loading partners..." />
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🤝</div>
          <p className="text-gray-500 text-lg">No partners found</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchTerm ? `No results for "${searchTerm}"` : 'Add your first partner to populate the public sections.'}
          </p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-5">
          {filteredPartners.map((partner, index) => {
            const imageUrl = buildUploadUrl(partner.image);

            return (
              <motion.div
                key={partner._id}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.04 }}
                className="card hover:border-primary-200 transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="flex gap-4 min-w-0">
                    {imageUrl ? (
                      <div className="w-24 h-24 rounded-2xl bg-white border border-gray-200 shadow-sm shrink-0 p-3 flex items-center justify-center">
                        <img src={imageUrl} alt={partner.name} className="max-h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-100 to-cyan-100 border border-primary-200 flex items-center justify-center text-primary-600 shrink-0">
                        <span className="text-3xl">🤝</span>
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${partner.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {partner.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-gray-400">Order {partner.order ?? 0}</span>
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 truncate">{partner.name}</h2>
                      {partner.website ? (
                        <a
                          href={partner.website}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary-500 hover:text-primary-600 break-all"
                        >
                          {partner.website}
                        </a>
                      ) : (
                        <p className="text-sm text-gray-400 mt-1">No external website linked</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openEditModal(partner)} className="btn-secondary text-sm">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(partner._id)} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm">
                      Delete
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modalOpen ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="app-modal-shell z-[70] items-start sm:items-center overflow-y-auto px-3 py-3 sm:px-4 sm:py-6"
          >
            <div className="app-modal-backdrop" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.99 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.99 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="app-modal-panel flex max-w-3xl flex-col overflow-hidden rounded-[2rem] w-full"
            >
              <div className="border-b border-gray-100 px-5 py-5 sm:px-8 sm:py-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                      {formData._id ? 'Edit Partner' : 'Add Partner'}
                    </h2>
                    <p className="text-sm text-gray-500 mt-2">
                      Update the logos shown in the Our Partners sections.
                    </p>
                  </div>
                  <button type="button" onClick={closeModal} disabled={processing} className="btn-secondary text-sm">
                    Close
                  </button>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="app-modal-scroll overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 space-y-6">
                <div className="grid lg:grid-cols-[220px,1fr] gap-6">
                  <div className="space-y-4">
                    <div className="rounded-3xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">Logo Preview</p>
                      <div className="aspect-square rounded-2xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden p-4">
                        {imagePreviewUrl ? (
                          <img src={imagePreviewUrl} alt="Partner preview" className="max-h-full w-full object-contain" />
                        ) : (
                          <span className="text-4xl">🤝</span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-sm font-medium text-gray-600">
                        Upload Logo
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                          onChange={handleImageChange}
                          className="input-field mt-2"
                        />
                      </label>

                      {formData.existingImage && (
                        <label className="inline-flex items-center gap-2 text-sm text-gray-500">
                          <input
                            type="checkbox"
                            checked={formData.removeImage}
                            onChange={(event) => setFormData((current) => ({
                              ...current,
                              removeImage: event.target.checked,
                              image: event.target.checked ? null : current.image,
                            }))}
                          />
                          Remove current image
                        </label>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Partner Name *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                        className="input-field"
                        placeholder="Enter partner name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">Website</label>
                      <input
                        type="url"
                        value={formData.website}
                        onChange={(event) => setFormData((current) => ({ ...current, website: event.target.value }))}
                        className="input-field"
                        placeholder="https://partner.example.com"
                      />
                    </div>

                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-600 mb-2">Display Order</label>
                        <input
                          type="number"
                          value={formData.order}
                          onChange={(event) => setFormData((current) => ({ ...current, order: Number(event.target.value) || 0 }))}
                          className="input-field"
                          min="0"
                        />
                      </div>

                      <div className="rounded-2xl border border-gray-200 bg-gray-50 px-4 py-4 flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-700">Visible on site</p>
                          <p className="text-xs text-gray-400 mt-1">Inactive partners stay hidden from Home and About.</p>
                        </div>
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.isActive}
                            onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
                            className="sr-only"
                          />
                          <span className={`relative inline-flex h-7 w-12 rounded-full transition-colors ${formData.isActive ? 'bg-primary-500' : 'bg-gray-300'}`}>
                            <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition mt-1 ${formData.isActive ? 'translate-x-6 ml-0' : 'translate-x-1'}`} />
                          </span>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
                  <button type="button" onClick={closeModal} disabled={processing} className="btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={processing} className="btn-primary min-w-[180px] justify-center">
                    {processing ? 'Saving...' : formData._id ? 'Save Changes' : 'Create Partner'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </motion.div>
  );
}

export default AdminPartners;
