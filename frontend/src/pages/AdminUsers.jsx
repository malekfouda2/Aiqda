import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { usersAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, staggerContainer, cardVariants, tableRowVariants, fadeIn } from '../utils/animations';
import { useLocale } from '../i18n/useLocale';

function AdminUsers() {
  const { isRTL } = useLocale();
  const { showSuccess, showError } = useUIStore();
  const [users, setUsers] = useState([]);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const params = filter !== 'all' ? { role: filter } : {};
      const response = await usersAPI.getAll(params);
      setUsers(response.data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (userId) => {
    try {
      await usersAPI.toggleStatus(userId);
      showSuccess(isRTL ? 'تم تحديث حالة المستخدم' : 'User status updated');
      fetchUsers();
    } catch (error) {
      showError(isRTL ? 'تعذر تحديث حالة المستخدم' : 'Failed to update user status');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await usersAPI.updateRole(userId, newRole);
      showSuccess(isRTL ? 'تم تحديث دور المستخدم' : 'User role updated');
      fetchUsers();
    } catch (error) {
      showError(isRTL ? 'تعذر تحديث دور المستخدم' : 'Failed to update user role');
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={fadeInUp}>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{isRTL ? 'إدارة المستخدمين' : 'User Management'}</h1>
        <p className="text-gray-500 mb-8">{isRTL ? 'إدارة مستخدمي المنصة' : 'Manage platform users'}</p>
      </motion.div>

      <motion.div variants={fadeInUp} className="flex gap-3 mb-6">
        {['all', 'student', 'instructor', 'admin'].map((role) => (
          <button
            key={role}
            onClick={() => setFilter(role)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              filter === role
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-100'
            }`}
          >
            {{ all: isRTL ? 'الكل' : 'All', student: isRTL ? 'الأعضاء' : 'Members', instructor: isRTL ? 'صنّاع المحتوى' : 'Creators', admin: isRTL ? 'المسؤولون' : 'Admins' }[role]}
          </button>
        ))}
      </motion.div>

      {loading ? (
        <motion.div variants={fadeIn} className="flex justify-center py-12">
          <LoadingSpinner />
        </motion.div>
      ) : users.length === 0 ? (
        <motion.div variants={fadeInUp} className="card text-center py-12">
          <p className="text-gray-500">{isRTL ? 'لا يوجد مستخدمون' : 'No users found'}</p>
        </motion.div>
      ) : (
        <motion.div variants={cardVariants} className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 text-gray-500 font-medium">{isRTL ? 'المستخدم' : 'User'}</th>
                  <th className="text-left py-4 px-4 text-gray-500 font-medium">{isRTL ? 'البريد الإلكتروني' : 'Email'}</th>
                  <th className="text-left py-4 px-4 text-gray-500 font-medium">{isRTL ? 'الدور' : 'Role'}</th>
                  <th className="text-left py-4 px-4 text-gray-500 font-medium">{isRTL ? 'الحالة' : 'Status'}</th>
                  <th className="text-left py-4 px-4 text-gray-500 font-medium">{isRTL ? 'الإجراءات' : 'Actions'}</th>
                </tr>
              </thead>
              <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
                {users.map((user) => (
                  <motion.tr key={user._id} variants={tableRowVariants} className="border-b border-gray-100">
                    <td className="py-4 px-4">
                      <p className="font-medium text-gray-900">{user.name}</p>
                    </td>
                    <td className="py-4 px-4 text-gray-600">{user.email}</td>
                    <td className="py-4 px-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user._id, e.target.value)}
                        className="bg-white border border-gray-200 rounded-lg px-3 py-1 text-gray-900 text-sm"
                      >
                        <option value="student">{isRTL ? 'عضو' : 'Member'}</option>
                        <option value="instructor">{isRTL ? 'صانع محتوى' : 'Creator'}</option>
                        <option value="admin">{isRTL ? 'مسؤول' : 'Admin'}</option>
                      </select>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        user.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                      }`}>
                        {user.isActive ? (isRTL ? 'نشط' : 'Active') : (isRTL ? 'غير نشط' : 'Inactive')}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => handleToggleStatus(user._id)}
                        className="text-sm text-primary-500 hover:text-primary-600"
                      >
                        {user.isActive ? (isRTL ? 'تعطيل' : 'Deactivate') : (isRTL ? 'تفعيل' : 'Activate')}
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default AdminUsers;
