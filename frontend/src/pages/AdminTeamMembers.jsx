import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import LoadingSpinner from '../components/LoadingSpinner';
import useUIStore from '../store/uiStore';
import { teamMembersAPI } from '../services/api';
import { buildUploadUrl } from '../utils/uploads';
import { pageVariants, fadeInUp, cardVariants } from '../utils/animations';

const buildInitialFormState = () => ({
  _id: null,
  name: '',
  title: '',
  achievements: [''],
  order: 0,
  isActive: true,
  removeImage: false,
  image: null,
  existingImage: null,
});

function AdminTeamMembers() {
  const { showSuccess, showError } = useUIStore();
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [formData, setFormData] = useState(buildInitialFormState());
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);

  useEffect(() => {
    fetchTeamMembers();
  }, []);

  const fetchTeamMembers = async () => {
    setLoading(true);
    try {
      const response = await teamMembersAPI.getAll();
      setTeamMembers(response.data);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  const filteredTeamMembers = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) {
      return teamMembers;
    }

    return teamMembers.filter((member) => (
      [member.name, member.title, ...(member.achievements || [])]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(needle)
    ));
  }, [searchTerm, teamMembers]);

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
      order: teamMembers.length + 1,
    });
    setModalOpen(true);
  };

  const openEditModal = (member) => {
    setFormData({
      _id: member._id,
      name: member.name,
      title: member.title,
      achievements: member.achievements?.length ? member.achievements : [''],
      order: member.order ?? 0,
      isActive: member.isActive,
      removeImage: false,
      image: null,
      existingImage: member.image || null,
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

  const updateAchievement = (index, value) => {
    setFormData((current) => {
      const nextAchievements = [...current.achievements];
      nextAchievements[index] = value;
      return {
        ...current,
        achievements: nextAchievements,
      };
    });
  };

  const addAchievement = () => {
    setFormData((current) => ({
      ...current,
      achievements: [...current.achievements, ''],
    }));
  };

  const removeAchievement = (index) => {
    setFormData((current) => {
      const nextAchievements = current.achievements.filter((_, itemIndex) => itemIndex !== index);
      return {
        ...current,
        achievements: nextAchievements.length ? nextAchievements : [''],
      };
    });
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
      payload.append('title', formData.title);
      payload.append('order', String(formData.order));
      payload.append('isActive', String(formData.isActive));
      payload.append('removeImage', String(formData.removeImage));
      payload.append(
        'achievements',
        JSON.stringify(formData.achievements.map((item) => item.trim()).filter(Boolean))
      );

      if (formData.image) {
        payload.append('image', formData.image);
      }

      if (formData._id) {
        await teamMembersAPI.update(formData._id, payload);
        showSuccess('Team member updated successfully');
      } else {
        await teamMembersAPI.create(payload);
        showSuccess('Team member created successfully');
      }

      closeModal();
      await fetchTeamMembers();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to save team member');
    } finally {
      setProcessing(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this team member?')) {
      return;
    }

    try {
      await teamMembersAPI.remove(id);
      showSuccess('Team member deleted successfully');
      await fetchTeamMembers();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete team member');
    }
  };

  const activeCount = teamMembers.filter((member) => member.isActive).length;
  const inactiveCount = teamMembers.length - activeCount;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage Team Members</h1>
          <p className="text-gray-500">Control the Meet Our Team section on the About page, including profile photos.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search by name, title, or achievement..."
              className="input-field pl-10 w-full sm:w-80"
            />
            <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <button onClick={openCreateModal} className="btn-primary whitespace-nowrap">
            <span className="mr-2">+</span>Add Team Member
          </button>
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
          <p className="text-xs uppercase tracking-widest text-primary-600 font-semibold mb-2">Total</p>
          <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
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
          <LoadingSpinner size="lg" text="Loading team members..." />
        </div>
      ) : filteredTeamMembers.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">🧑‍🎨</div>
          <p className="text-gray-500 text-lg">No team members found</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchTerm ? `No results for "${searchTerm}"` : 'Add your first team member to populate the About page.'}
          </p>
        </div>
      ) : (
        <div className="grid xl:grid-cols-2 gap-5">
          {filteredTeamMembers.map((member, index) => {
            const imageUrl = buildUploadUrl(member.image);

            return (
              <motion.div
                key={member._id}
                variants={cardVariants}
                initial="hidden"
                animate="visible"
                transition={{ delay: index * 0.04 }}
                className="card hover:border-primary-200 transition-all duration-300"
              >
                <div className="flex flex-col sm:flex-row gap-4 justify-between">
                  <div className="flex gap-4 min-w-0">
                    {imageUrl ? (
                      <img src={imageUrl} alt={member.name} className="w-20 h-20 rounded-2xl object-cover border border-gray-200 shadow-sm shrink-0" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary-100 to-cyan-100 border border-primary-200 flex items-center justify-center text-primary-600 shrink-0">
                        <svg className="w-9 h-9" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M16 14a4 4 0 10-8 0m8 0a4 4 0 01-8 0m8 0v1a3 3 0 01-3 3H11a3 3 0 01-3-3v-1m8 0H8" />
                        </svg>
                      </div>
                    )}

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${member.isActive ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                          {member.isActive ? 'Active' : 'Inactive'}
                        </span>
                        <span className="text-xs text-gray-400">Order {member.order ?? 0}</span>
                      </div>
                      <h2 className="text-xl font-semibold text-gray-900 truncate">{member.name}</h2>
                      <p className="text-sm text-gray-500">{member.title}</p>
                      <p className="text-sm text-gray-400 mt-3">
                        {member.achievements?.length || 0} achievement{member.achievements?.length === 1 ? '' : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => openEditModal(member)} className="btn-secondary text-sm">
                      Edit
                    </button>
                    <button onClick={() => handleDelete(member._id)} className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm">
                      Delete
                    </button>
                  </div>
                </div>

                {member.achievements?.length > 0 && (
                  <ul className="mt-5 space-y-2">
                    {member.achievements.slice(0, 3).map((achievement, itemIndex) => (
                      <li key={`${member._id}-achievement-${itemIndex}`} className="flex items-start gap-3 text-sm text-gray-600">
                        <span className="mt-1.5 w-5 h-5 rounded-full bg-primary-50 border border-primary-100 flex items-center justify-center shrink-0">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary-500" />
                        </span>
                        <span>{achievement}</span>
                      </li>
                    ))}
                    {member.achievements.length > 3 && (
                      <li className="text-xs text-gray-400 pl-8">
                        +{member.achievements.length - 3} more achievements
                      </li>
                    )}
                  </ul>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={closeModal} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {formData._id ? 'Edit Team Member' : 'Add Team Member'}
                </h2>
                <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-xl transition-colors">
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-6 flex-1">
                <div className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6">
                  <div className="space-y-6">
                    <div className="grid sm:grid-cols-2 gap-6">
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                        <input
                          type="text"
                          value={formData.name}
                          onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                          required
                          className="input-field"
                          placeholder="e.g. Abdulwahed Alabdlee"
                        />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                        <input
                          type="text"
                          value={formData.title}
                          onChange={(event) => setFormData((current) => ({ ...current, title: event.target.value }))}
                          required
                          className="input-field"
                          placeholder="e.g. Managing Partner & Trainer Consultant"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Display Order</label>
                        <input
                          type="number"
                          value={formData.order}
                          onChange={(event) => setFormData((current) => ({ ...current, order: Number(event.target.value) }))}
                          className="input-field"
                        />
                      </div>
                      <div className="flex items-center gap-2 pt-8">
                        <input
                          id="team-member-active"
                          type="checkbox"
                          checked={formData.isActive}
                          onChange={(event) => setFormData((current) => ({ ...current, isActive: event.target.checked }))}
                          className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                        />
                        <label htmlFor="team-member-active" className="text-sm font-medium text-gray-700 cursor-pointer">
                          Show on About page
                        </label>
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700">Achievements</label>
                        <button type="button" onClick={addAchievement} className="text-sm font-medium text-primary-600 hover:text-primary-700">
                          + Add achievement
                        </button>
                      </div>
                      <div className="space-y-3">
                        {formData.achievements.map((achievement, index) => (
                          <div key={`achievement-${index}`} className="flex gap-2">
                            <textarea
                              value={achievement}
                              onChange={(event) => updateAchievement(index, event.target.value)}
                              rows={2}
                              className="input-field min-h-[88px] resize-none"
                              placeholder="Add a short achievement or credential..."
                            />
                            <button
                              type="button"
                              onClick={() => removeAchievement(index)}
                              className="p-2.5 text-red-500 hover:bg-red-50 rounded-xl transition-colors border border-gray-200 self-start"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-5">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Profile Image</label>
                      <label className="flex flex-col items-center justify-center gap-3 border border-dashed border-gray-300 rounded-2xl px-5 py-8 text-center cursor-pointer hover:border-primary-300 hover:bg-primary-50/40 transition-colors">
                        <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-primary-50 text-primary-600">
                          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 15a4 4 0 004 4h10a4 4 0 004-4m-4-6l-5-5m0 0L7 9m5-5v12" />
                          </svg>
                        </span>
                        <div>
                          <p className="text-sm font-medium text-gray-700">Click to upload a photo</p>
                          <p className="text-xs text-gray-400 mt-1">JPEG, PNG, GIF, or WebP up to 5 MB</p>
                        </div>
                        <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" onChange={handleImageChange} className="hidden" />
                      </label>
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">Preview</p>
                      {imagePreviewUrl ? (
                        <img src={imagePreviewUrl} alt="Preview" className="w-full aspect-[4/5] rounded-2xl object-cover border border-gray-200" />
                      ) : (
                        <div className="w-full aspect-[4/5] rounded-2xl bg-white border border-dashed border-gray-200 flex items-center justify-center text-gray-400">
                          No image selected
                        </div>
                      )}

                      {formData.existingImage && !formData.image && (
                        <button
                          type="button"
                          onClick={() => setFormData((current) => ({ ...current, removeImage: !current.removeImage }))}
                          className={`mt-3 text-sm font-medium ${formData.removeImage ? 'text-red-600' : 'text-gray-600 hover:text-red-600'}`}
                        >
                          {formData.removeImage ? 'Image will be removed on save' : 'Remove current image'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-4 border-t border-gray-100">
                  <button type="button" onClick={closeModal} className="btn-secondary flex-1">
                    Cancel
                  </button>
                  <button type="submit" disabled={processing} className="btn-primary flex-1">
                    {processing ? 'Saving...' : (formData._id ? 'Update Team Member' : 'Create Team Member')}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AdminTeamMembers;
