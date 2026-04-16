import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { contactMessagesAPI } from '../services/api';
import useUIStore from '../store/uiStore';
import LoadingSpinner from '../components/LoadingSpinner';
import { pageVariants, fadeInUp, cardVariants } from '../utils/animations';
import useBodyScrollLock from '../hooks/useBodyScrollLock';

function AdminContactMessages() {
  const { showSuccess, showError } = useUIStore();
  const [messages, setMessages] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState('');
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useBodyScrollLock(Boolean(selectedMessage));

  useEffect(() => {
    fetchMessages();
  }, [filter]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const response = await contactMessagesAPI.getAll(filter !== 'all' ? filter : undefined);
      setMessages(response.data);
    } catch (error) {
      showError('Failed to load contact messages');
    } finally {
      setLoading(false);
    }
  };

  const fetchMessageDetail = async (id) => {
    setDetailLoading(true);
    try {
      const response = await contactMessagesAPI.getById(id);
      setSelectedMessage(response.data);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to load message');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshSelectedMessage = async (id) => {
    if (selectedMessage?._id === id) {
      await fetchMessageDetail(id);
    }
  };

  const handleMarkRead = async (id) => {
    setProcessing(`read-${id}`);
    try {
      await contactMessagesAPI.markRead(id);
      showSuccess('Message marked as read');
      await fetchMessages();
      await refreshSelectedMessage(id);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to mark message as read');
    } finally {
      setProcessing('');
    }
  };

  const handleMarkUnread = async (id) => {
    setProcessing(`unread-${id}`);
    try {
      await contactMessagesAPI.markUnread(id);
      showSuccess('Message marked as unread');
      await fetchMessages();
      await refreshSelectedMessage(id);
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to mark message as unread');
    } finally {
      setProcessing('');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this contact message? This action cannot be undone.')) {
      return;
    }

    setProcessing(`delete-${id}`);
    try {
      await contactMessagesAPI.remove(id);
      showSuccess('Message deleted');
      if (selectedMessage?._id === id) {
        setSelectedMessage(null);
      }
      await fetchMessages();
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to delete message');
    } finally {
      setProcessing('');
    }
  };

  const filteredMessages = messages.filter((message) => {
    const searchable = [
      message.fullName,
      message.email,
      message.subject,
      message.message
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return searchable.includes(searchTerm.toLowerCase());
  });

  const stats = {
    total: messages.length,
    unread: messages.filter((message) => !message.isRead).length,
    read: messages.filter((message) => message.isRead).length,
  };

  const actionIsRunning = (action, id) => processing === `${action}-${id}`;

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="visible">
      <motion.div variants={fadeInUp} className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Contact Inbox</h1>
          <p className="text-gray-500">Review and manage inbound contact form submissions.</p>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Search by name, email, or subject..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="input-field pl-10 w-full lg:w-80"
          />
          <svg className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
          <p className="text-xs uppercase tracking-widest text-primary-600 font-semibold mb-2">Total</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4">
          <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-2">Unread</p>
          <p className="text-2xl font-bold text-gray-900">{stats.unread}</p>
        </div>
        <div className="rounded-2xl border border-green-100 bg-green-50 p-4">
          <p className="text-xs uppercase tracking-widest text-green-600 font-semibold mb-2">Read</p>
          <p className="text-2xl font-bold text-gray-900">{stats.read}</p>
        </div>
      </motion.div>

      <motion.div variants={fadeInUp} className="flex gap-3 mb-6 overflow-x-auto pb-2">
        {['all', 'unread', 'read'].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              filter === status
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </motion.div>

      {loading ? (
        <div className="flex justify-center py-16">
          <LoadingSpinner size="lg" text="Loading messages..." />
        </div>
      ) : filteredMessages.length === 0 ? (
        <div className="card text-center py-16">
          <div className="text-5xl mb-4">✉️</div>
          <p className="text-gray-500 text-lg">No contact messages found</p>
          <p className="text-gray-400 text-sm mt-1">
            {searchTerm ? `No results for "${searchTerm}"` : 'The inbox is clear for this filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredMessages.map((message, index) => (
            <motion.div
              key={message._id}
              variants={cardVariants}
              initial="hidden"
              animate="visible"
              transition={{ delay: index * 0.04 }}
              className={`card hover:border-primary-200 hover:shadow-md transition-all duration-300 cursor-pointer ${
                !message.isRead ? 'border-amber-200 bg-amber-50/30' : ''
              }`}
              onClick={() => fetchMessageDetail(message._id)}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-3 mb-3">
                    <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold ${
                      message.isRead ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      <span className={`w-2 h-2 rounded-full ${message.isRead ? 'bg-green-500' : 'bg-amber-500'}`} />
                      {message.isRead ? 'Read' : 'Unread'}
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-start gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary-100 to-cyan-100 border border-primary-200 flex items-center justify-center text-primary-700 font-bold shrink-0">
                      {message.fullName?.charAt(0)?.toUpperCase() || '?'}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900">{message.subject}</h2>
                      <p className="text-sm text-gray-500">
                        {message.fullName} · {message.email}
                      </p>
                      <p className="text-sm text-gray-500 mt-2 line-clamp-2">{message.message}</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2" onClick={(event) => event.stopPropagation()}>
                  {!message.isRead ? (
                    <button
                      onClick={() => handleMarkRead(message._id)}
                      disabled={actionIsRunning('read', message._id)}
                      className="btn-primary text-sm"
                    >
                      {actionIsRunning('read', message._id) ? 'Saving...' : 'Mark as Read'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMarkUnread(message._id)}
                      disabled={actionIsRunning('unread', message._id)}
                      className="btn-secondary text-sm"
                    >
                      {actionIsRunning('unread', message._id) ? 'Saving...' : 'Mark Unread'}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(message._id)}
                    disabled={actionIsRunning('delete', message._id)}
                    className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-xl transition-all text-sm disabled:opacity-70"
                  >
                    {actionIsRunning('delete', message._id) ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {selectedMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="app-modal-shell z-50"
            onClick={() => setSelectedMessage(null)}
          >
            <div className="app-modal-backdrop" />
            <motion.div
              initial={{ opacity: 0, scale: 0.99, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.99, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="app-modal-panel max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-[2rem]"
              onClick={(event) => event.stopPropagation()}
            >
              {detailLoading ? (
                <div className="p-12 flex justify-center">
                  <LoadingSpinner size="lg" text="Loading message..." />
                </div>
              ) : (
                <>
                  <div className="px-6 py-5 border-b border-gray-100 flex items-start justify-between gap-4">
                    <div>
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-3 ${
                        selectedMessage.isRead ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                      }`}>
                        <span className={`w-2 h-2 rounded-full ${selectedMessage.isRead ? 'bg-green-500' : 'bg-amber-500'}`} />
                        {selectedMessage.isRead ? 'Read' : 'Unread'}
                      </div>
                      <h2 className="text-2xl font-bold text-gray-900">{selectedMessage.subject}</h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Received {new Date(selectedMessage.createdAt).toLocaleString()}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedMessage(null)}
                      className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
                    >
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="app-modal-scroll p-6 overflow-y-auto space-y-6">
                    <div className="grid md:grid-cols-2 gap-4">
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">From</p>
                        <p className="font-semibold text-gray-900">{selectedMessage.fullName}</p>
                        <a href={`mailto:${selectedMessage.email}`} className="text-sm text-primary-600 hover:text-primary-700 break-all">
                          {selectedMessage.email}
                        </a>
                      </div>
                      <div className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-4">
                        <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-2">Phone</p>
                        <p className="font-semibold text-gray-900">{selectedMessage.phone || 'Not provided'}</p>
                        {selectedMessage.readBy && (
                          <p className="text-sm text-gray-500 mt-2">
                            Last marked read by {selectedMessage.readBy.name}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] border border-gray-100 bg-white px-5 py-5 shadow-sm">
                      <p className="text-xs uppercase tracking-widest text-gray-400 font-semibold mb-3">Message</p>
                      <p className="text-gray-700 whitespace-pre-wrap leading-relaxed">{selectedMessage.message}</p>
                    </div>
                  </div>

                  <div className="px-6 py-5 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <a
                      href={`mailto:${selectedMessage.email}?subject=${encodeURIComponent(`Re: ${selectedMessage.subject}`)}`}
                      className="btn-secondary justify-center"
                    >
                      Reply by Email
                    </a>
                    <div className="flex flex-wrap gap-2">
                      {!selectedMessage.isRead ? (
                        <button
                          onClick={() => handleMarkRead(selectedMessage._id)}
                          disabled={actionIsRunning('read', selectedMessage._id)}
                          className="btn-primary"
                        >
                          {actionIsRunning('read', selectedMessage._id) ? 'Saving...' : 'Mark as Read'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleMarkUnread(selectedMessage._id)}
                          disabled={actionIsRunning('unread', selectedMessage._id)}
                          className="btn-secondary"
                        >
                          {actionIsRunning('unread', selectedMessage._id) ? 'Saving...' : 'Mark Unread'}
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(selectedMessage._id)}
                        disabled={actionIsRunning('delete', selectedMessage._id)}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2.5 px-5 rounded-xl transition-all disabled:opacity-70"
                      >
                        {actionIsRunning('delete', selectedMessage._id) ? 'Deleting...' : 'Delete'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default AdminContactMessages;
