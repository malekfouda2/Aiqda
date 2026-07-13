import { useState } from 'react';

// Small "(i)" indicator that reveals an explanation on hover, focus, or tap.
// Used across the creator dashboard to explain what each control does.
function InfoTooltip({ text, className = '', side = 'top' }) {
  const [open, setOpen] = useState(false);

  const positionClasses = side === 'bottom'
    ? 'top-full mt-2'
    : 'bottom-full mb-2';

  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label="More information"
        className="flex h-4 w-4 items-center justify-center rounded-full border border-gray-300 bg-white text-[10px] font-bold leading-none text-gray-400 hover:border-primary-300 hover:text-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); setOpen((o) => !o); }}
      >
        i
      </button>
      {open && (
        <span
          role="tooltip"
          className={`absolute left-1/2 z-50 w-56 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-normal leading-snug text-white shadow-lg ${positionClasses}`}
        >
          {text}
        </span>
      )}
    </span>
  );
}

export default InfoTooltip;
