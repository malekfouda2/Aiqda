import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';

function Home() {
  const { user } = useAuthStore();

  return (
    <div className="min-h-screen">
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="absolute inset-0 bg-gradient-to-b from-primary-950/20 to-dark-950" />
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center"
          >
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold mb-6">
              <span className="gradient-text">Elevate</span> Your Learning
              <br />
              <span className="text-white">Experience</span>
            </h1>
            <p className="text-lg sm:text-xl text-dark-300 max-w-2xl mx-auto mb-10">
              Aiqda is a premium education platform designed for those who seek
              excellence in learning. Discover courses that inspire and transform.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              {user ? (
                <Link to="/dashboard" className="btn-primary text-lg px-8 py-3">
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link to="/register" className="btn-primary text-lg px-8 py-3">
                    Start Learning
                  </Link>
                  <Link to="/courses" className="btn-secondary text-lg px-8 py-3">
                    Browse Courses
                  </Link>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-dark-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Why Choose Aiqda?
            </h2>
            <p className="text-dark-400 max-w-xl mx-auto">
              Experience learning like never before with our curated courses and expert instructors.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="card-hover text-center"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-primary-500/20 to-indigo-500/20 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl">{feature.icon}</span>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">{feature.title}</h3>
                <p className="text-dark-400">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="card bg-gradient-to-r from-primary-900/30 to-indigo-900/30 py-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Ready to Begin Your Journey?
            </h2>
            <p className="text-dark-300 max-w-xl mx-auto mb-8">
              Join thousands of learners who have transformed their careers with Aiqda.
            </p>
            <Link to="/register" className="btn-primary text-lg px-10 py-3">
              Get Started Today
            </Link>
          </motion.div>
        </div>
      </section>

      <footer className="py-8 border-t border-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-indigo-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">A</span>
              </div>
              <span className="font-semibold text-white">Aiqda</span>
            </div>
            <p className="text-dark-500 text-sm">
              &copy; {new Date().getFullYear()} Aiqda. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

const features = [
  {
    icon: '🎯',
    title: 'Expert Instructors',
    description: 'Learn from industry professionals with years of experience in their fields.'
  },
  {
    icon: '📚',
    title: 'Quality Content',
    description: 'Carefully curated courses with video lessons, quizzes, and resources.'
  },
  {
    icon: '📊',
    title: 'Track Progress',
    description: 'Monitor your learning journey with detailed analytics and insights.'
  }
];

export default Home;
