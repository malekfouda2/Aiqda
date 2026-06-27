import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { searchAPI } from '../services/api';
import { useLocale } from '../i18n/useLocale';

function GlobalSearch() {
  const navigate = useNavigate();
  const { isRTL } = useLocale();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setGroups([]);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const { data } = await searchAPI.search(trimmed);
        setGroups(data.groups || []);
      } catch {
        setGroups([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const handleSelect = (link) => {
    setOpen(false);
    setQuery('');
    setGroups([]);
    if (link) {
      navigate(link);
    }
  };

  const showDropdown = open && query.trim().length >= 2;
  const hasResults = groups.some((g) => g.items.length > 0);

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <span className={`absolute inset-y-0 flex items-center text-gray-400 ${isRTL ? 'right-3' : 'left-3'}`}>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
          </svg>
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          dir={isRTL ? 'rtl' : 'ltr'}
          placeholder={isRTL ? 'بحث...' : 'Search...'}
          className={`w-full rounded-full border border-gray-200 bg-gray-50 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-100 transition-all ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'}`}
        />
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            dir={isRTL ? 'rtl' : 'ltr'}
            className={`absolute mt-2 w-80 sm:w-96 max-h-[28rem] overflow-y-auto rounded-2xl border border-gray-200 bg-white shadow-xl z-50 ${isRTL ? 'left-0' : 'right-0'}`}
          >
            {loading && !hasResults ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">{isRTL ? 'جارٍ البحث...' : 'Searching...'}</p>
            ) : !hasResults ? (
              <p className="px-4 py-8 text-center text-sm text-gray-400">{isRTL ? 'لا توجد نتائج' : 'No results found'}</p>
            ) : (
              groups.filter((g) => g.items.length > 0).map((g) => (
                <div key={g.type}>
                  <p className="px-4 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                    {(isRTL && g.labelAr) || g.label}
                  </p>
                  {g.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleSelect(item.link)}
                      className={`block w-full px-4 py-2 hover:bg-gray-50 transition-colors ${isRTL ? 'text-right' : 'text-left'}`}
                    >
                      <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                      {item.subtitle && (
                        <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>
                      )}
                    </button>
                  ))}
                </div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GlobalSearch;
