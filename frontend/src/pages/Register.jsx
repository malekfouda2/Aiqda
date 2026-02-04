import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [localError, setLocalError] = useState('');
  const { register, isLoading, error } = useAuthStore();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (password !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setLocalError('Password must be at least 6 characters');
      return;
    }

    const result = await register(name, email, password, role);
    if (result.success) {
      navigate('/dashboard');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden">
      <div className="absolute inset-0 mesh-gradient" />
      
      <div className="absolute inset-0 overflow-hidden">
        <div className="floating-orb w-[400px] h-[400px] bg-indigo-500/15 top-[-100px] left-[-100px] animate-float" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-500/10 bottom-[-50px] right-[-50px] animate-float-slow" />
        <div className="floating-orb w-[200px] h-[200px] bg-cyan-500/10 top-1/2 right-1/4 animate-glow-pulse" />
      </div>

      <div className="absolute inset-0" style={{
        backgroundImage: `radial-gradient(rgba(255,255,255,0.02) 1px, transparent 1px)`,
        backgroundSize: '40px 40px'
      }} />

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-md"
      >
        <div className="text-center mb-10">
          <Link to="/" className="inline-flex items-center gap-3 mb-8 group">
            <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-2xl flex items-center justify-center shadow-xl shadow-primary-500/20 group-hover:shadow-primary-500/40 transition-shadow duration-300">
              <span className="text-white font-bold text-xl">A</span>
            </div>
            <span className="text-2xl font-bold gradient-text">Aiqda</span>
          </Link>
          <h1 className="text-4xl font-bold text-white mb-3">Create Account</h1>
          <p className="text-dark-400 text-lg">Join Aiqda and start learning today</p>
        </div>

        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {(error || localError) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-3 rounded-xl text-sm backdrop-blur-sm"
              >
                {error || localError}
              </motion.div>
            )}

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field"
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-3">
                I want to
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setRole('student')}
                  className={`relative py-4 rounded-xl text-center font-medium transition-all duration-300 ${
                    role === 'student'
                      ? 'bg-primary-500/20 border-2 border-primary-500/50 text-primary-400'
                      : 'bg-dark-800/50 border-2 border-dark-700/50 text-dark-400 hover:border-dark-600'
                  }`}
                >
                  <span className="text-2xl block mb-1">📚</span>
                  Learn
                </button>
                <button
                  type="button"
                  onClick={() => setRole('instructor')}
                  className={`relative py-4 rounded-xl text-center font-medium transition-all duration-300 ${
                    role === 'instructor'
                      ? 'bg-primary-500/20 border-2 border-primary-500/50 text-primary-400'
                      : 'bg-dark-800/50 border-2 border-dark-700/50 text-dark-400 hover:border-dark-600'
                  }`}
                >
                  <span className="text-2xl block mb-1">🎓</span>
                  Teach
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="Min 6 characters"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-dark-300 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-field"
                placeholder="Repeat your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn-primary w-full py-4 text-base"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating account...
                </span>
              ) : 'Create Account'}
            </button>
          </form>

          <div className="divider my-8" />

          <div className="text-center">
            <p className="text-dark-400">
              Already have an account?{' '}
              <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export default Register;
