import { motion } from 'framer-motion';

function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
        className={`${sizes[size]} border-2 border-gray-200 border-t-primary-500 rounded-full`}
      />
      {text && <p className="text-gray-500 text-sm">{text}</p>}
    </div>
  );
}

export default LoadingSpinner;
