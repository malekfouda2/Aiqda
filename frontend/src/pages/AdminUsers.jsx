import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { usersAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';

function AdminUsers() {
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
      showSuccess('User status updated');
      fetchUsers();
    } catch (error) {
      showError('Failed to update user status');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await usersAPI.updateRole(userId, newRole);
      showSuccess('User role updated');
      fetchUsers();
    } catch (error) {
      showError('Failed to update user role');
    }
  };

  return (
    <div className="min-h-screen py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-3xl font-bold text-gray-900 mb-2">User Management</h1>
          <p className="text-gray-500 mb-8">Manage platform users</p>

          <div className="flex gap-3 mb-6">
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
                {role.charAt(0).toUpperCase() + role.slice(1)}s
              </button>
            ))}
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner />
            </div>
          ) : users.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-500">No users found</p>
            </div>
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-4 px-4 text-gray-500 font-medium">User</th>
                      <th className="text-left py-4 px-4 text-gray-500 font-medium">Email</th>
                      <th className="text-left py-4 px-4 text-gray-500 font-medium">Role</th>
                      <th className="text-left py-4 px-4 text-gray-500 font-medium">Status</th>
                      <th className="text-left py-4 px-4 text-gray-500 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user._id} className="border-b border-gray-100">
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
                            <option value="student">Student</option>
                            <option value="instructor">Instructor</option>
                            <option value="admin">Admin</option>
                          </select>
                        </td>
                        <td className="py-4 px-4">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            user.isActive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
                          }`}>
                            {user.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-4 px-4">
                          <button
                            onClick={() => handleToggleStatus(user._id)}
                            className="text-sm text-primary-500 hover:text-primary-600"
                          >
                            {user.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default AdminUsers;
