import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

function Home() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen bg-white">
      <section className="relative overflow-hidden min-h-[90vh] flex items-center">
        <div className="absolute inset-0 mesh-gradient" />
        
        <div className="absolute inset-0 overflow-hidden">
          <div className="floating-orb w-[600px] h-[600px] bg-primary-100/40 top-[-200px] left-[-100px] animate-float" />
          <div className="floating-orb w-[500px] h-[500px] bg-cyan-100/40 bottom-[-150px] right-[-100px] animate-float-slow" />
          <div className="floating-orb w-[300px] h-[300px] bg-blue-100/30 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-glow-pulse" />
          <div className="floating-orb w-[200px] h-[200px] bg-orange-100/30 top-[20%] right-[15%] animate-float" />
        </div>

        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(rgba(0,0,0,0.03) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }} />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-8"
            >
              <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">Premium Learning Platform</span>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="mb-8"
            >
              <img src="/logo.png" alt="Aiqda" className="h-24 sm:h-32 w-auto mx-auto" />
            </motion.div>

            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold mb-8 tracking-tight">
              <span className="gradient-text text-glow">Elevate</span>
              <br />
              <span className="text-gray-900">Your Learning</span>
              <br />
              <span className="text-gray-400">Experience</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl mx-auto mb-12 leading-relaxed">
              Aiqda is a premium education platform designed for those who seek
              excellence in learning. Discover courses that inspire and transform.
            </p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center gap-4"
            >
              {user ? (
                <Link to="/dashboard" className="btn-primary text-lg px-10 py-4">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary text-lg px-10 py-4">
                    Start Learning
                    <span className="ml-2">→</span>
                  </Link>
                  <Link to="/courses" className="btn-secondary text-lg px-10 py-4">
                    Browse Courses
                  </Link>
                </>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.8 }}
              className="mt-20 flex items-center justify-center gap-12 text-center"
            >
              {stats.map((stat, index) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.9 + index * 0.1 }}
                >
                  <p className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">{stat.value}</p>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent" />
      </section>

      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50/50 to-white" />
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-20"
          >
            <span className="text-primary-500 text-sm font-medium tracking-widest uppercase mb-4 block">
              Why Choose Us
            </span>
            <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
              Designed for
              <span className="gradient-text"> Excellence</span>
            </h2>
            <p className="text-gray-500 max-w-xl mx-auto text-lg">
              Experience learning like never before with our curated courses and expert instructors.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.15, duration: 0.6 }}
                className="card-hover text-center group"
              >
                <div className={`icon-box ${feature.iconClass} mx-auto mb-6 transition-transform duration-500 group-hover:scale-110`}>
                  <span className="relative z-10">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-3 group-hover:text-primary-500 transition-colors">
                  {feature.title}
                </h3>
                <p className="text-gray-500 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden rounded-3xl"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary-500 via-primary-600 to-brand-teal" />
            <div className="absolute inset-0 mesh-gradient opacity-30" />
            
            <div className="relative py-20 px-8 text-center">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/20 mb-8"
              >
                <span className="text-2xl">✨</span>
                <span className="text-sm text-white/90">Join Our Community</span>
              </motion.div>

              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
                Ready to Begin Your
                <span className="block text-white/90">Transformation?</span>
              </h2>
              <p className="text-white/70 max-w-xl mx-auto mb-10 text-lg">
                Join thousands of learners who have transformed their careers with Aiqda.
              </p>
              <Link 
                to="/register" 
                className="inline-flex items-center gap-2 bg-white text-primary-600 font-semibold text-lg px-10 py-4 rounded-xl hover:bg-gray-50 transition-all duration-300 hover:scale-[1.02] shadow-2xl shadow-black/10"
              >
                Get Started Today
                <span>→</span>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-gray-50/50 to-white" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
            >
              <span className="text-brand-teal text-sm font-medium tracking-widest uppercase mb-4 block">
                For Instructors
              </span>
              <h2 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">
                Share Your
                <span className="gradient-text"> Expertise</span>
              </h2>
              <p className="text-gray-500 text-lg mb-6 leading-relaxed">
                Are you a skilled animator or creative professional? Join Aiqda as an instructor 
                and inspire the next generation of artists. We're looking for passionate educators 
                in 2D, 3D, Storyboarding, Stop Motion, and more.
              </p>
              <ul className="space-y-3 mb-8">
                {[
                  'Reach students worldwide',
                  'Flexible teaching schedule',
                  'Professional platform & support',
                  'Share your unique creative vision'
                ].map((item, i) => (
                  <motion.li
                    key={item}
                    initial={{ opacity: 0, x: -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.1 }}
                    className="flex items-center gap-3 text-gray-600"
                  >
                    <span className="w-6 h-6 rounded-full bg-brand-teal/10 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-brand-teal" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    {item}
                  </motion.li>
                ))}
              </ul>
              <Link 
                to="/apply-instructor" 
                className="btn-primary inline-flex items-center gap-2 text-lg px-8 py-4"
              >
                Apply as Instructor
                <span>→</span>
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 30 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative"
            >
              <div className="relative bg-gradient-to-br from-brand-teal/5 to-primary-50 rounded-3xl p-8 border border-gray-100">
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-brand-teal/10 rounded-full blur-2xl" />
                <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-primary-100/40 rounded-full blur-2xl" />
                <div className="relative space-y-6">
                  {[
                    { icon: '🎬', title: 'Animation Experts', desc: '2D, 3D, Stop Motion & more' },
                    { icon: '🎨', title: 'Creative Professionals', desc: 'Storyboarding & visual arts' },
                    { icon: '📐', title: 'Technical Artists', desc: 'Software & pipeline specialists' },
                    { icon: '🌟', title: 'Industry Veterans', desc: 'Studio & production experience' }
                  ].map((item, i) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.3 + i * 0.1 }}
                      className="flex items-start gap-4 p-4 rounded-2xl bg-white/80 backdrop-blur-sm border border-gray-100 shadow-sm"
                    >
                      <span className="text-3xl">{item.icon}</span>
                      <div>
                        <h4 className="font-semibold text-gray-900">{item.title}</h4>
                        <p className="text-sm text-gray-500">{item.desc}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-gray-200 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.png" alt="Aiqda" className="h-14 w-auto" />
            </div>
            <div className="flex items-center gap-8">
              <Link to="/courses" className="nav-link text-sm">Courses</Link>
              <Link to="/login" className="nav-link text-sm">Login</Link>
              <Link to="/register" className="nav-link text-sm">Register</Link>
            </div>
            <p className="text-gray-400 text-sm">
              &copy; {new Date().getFullYear()} Aiqda. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const stats = [
  { value: '10K+', label: 'Students' },
  { value: '200+', label: 'Courses' },
  { value: '50+', label: 'Instructors' }
];

const features = [
  {
    icon: '🎯',
    iconClass: 'icon-box-primary',
    title: 'Expert Instructors',
    description: 'Learn from industry professionals with years of experience in their fields.'
  },
  {
    icon: '📚',
    iconClass: 'icon-box-success',
    title: 'Quality Content',
    description: 'Carefully curated courses with video lessons, quizzes, and resources.'
  },
  {
    icon: '📊',
    iconClass: 'icon-box-accent',
    title: 'Track Progress',
    description: 'Monitor your learning journey with detailed analytics and insights.'
  }
];

export default Home;
