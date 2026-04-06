import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import useAuthStore from '../store/authStore';
import useUIStore from '../store/uiStore';
import { contactMessagesAPI } from '../services/api';
import {
  pageVariants,
  fadeInUp,
  staggerContainer,
  cardVariants,
  slideInLeft,
  slideInRight
} from '../utils/animations';

const buildInitialFormData = (user) => ({
  fullName: user?.name || '',
  email: user?.email || '',
  phone: '',
  subject: '',
  message: ''
});

const contactHighlights = [
  {
    title: 'Response Window',
    value: 'Within 1 Business Day',
    description: 'We review every message personally and route it to the right team quickly.'
  },
  {
    title: 'Email',
    value: 'info@24center.edu.sa',
    description: 'Use the form below or contact us directly for partnerships, support, and learning questions.'
  },
  {
    title: 'Best For',
    value: 'Courses, Studios, Partnerships',
    description: 'We can help with enrollment, creator applications, studio collaborations, and platform support.'
  }
];

function ContactUs() {
  const { user } = useAuthStore();
  const { showSuccess, showError } = useUIStore();
  const [formData, setFormData] = useState(() => buildInitialFormData(user));
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setFormData((current) => ({
      ...current,
      fullName: current.fullName || user?.name || '',
      email: current.email || user?.email || '',
    }));
  }, [user]);

  const handleChange = (field) => (event) => {
    setFormData((current) => ({
      ...current,
      [field]: event.target.value
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await contactMessagesAPI.submit(formData);
      showSuccess('Your message has been sent. We will get back to you soon.');
      setFormData(buildInitialFormData(user));
    } catch (error) {
      showError(error.response?.data?.error || 'Failed to send your message');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="visible"
      className="min-h-screen bg-white"
    >
      <section className="relative overflow-hidden pt-32 pb-20">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="floating-orb w-[520px] h-[520px] bg-primary-100/40 top-[-180px] left-[-100px] animate-float" />
          <div className="floating-orb w-[400px] h-[400px] bg-cyan-100/35 bottom-[-110px] right-[-80px] animate-float-slow" />
          <div className="floating-orb w-[260px] h-[260px] bg-orange-100/25 top-1/3 right-1/4 animate-glow-pulse" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div variants={fadeInUp} className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass mb-6">
              <span className="w-2 h-2 bg-brand-teal rounded-full animate-pulse" />
              <span className="text-sm text-gray-600">Contact Us</span>
            </div>

            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight mb-6 text-gray-900">
              Let’s Start a
              {' '}
              <span className="gradient-text text-glow">Conversation</span>
            </h1>

            <p className="text-lg sm:text-xl text-gray-500 max-w-2xl leading-relaxed">
              Reach out to the Aiqda team for learning support, partnerships,
              studio collaboration, or anything else you would like to explore with us.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="grid md:grid-cols-3 gap-4 mt-12"
          >
            {contactHighlights.map((item) => (
              <motion.div
                key={item.title}
                variants={cardVariants}
                className="bg-white/85 backdrop-blur-sm rounded-3xl border border-gray-200 shadow-sm p-6"
              >
                <p className="text-xs uppercase tracking-[0.22em] text-gray-400 font-semibold mb-3">{item.title}</p>
                <h2 className="text-xl font-bold text-gray-900 mb-3">{item.value}</h2>
                <p className="text-sm text-gray-500 leading-relaxed">{item.description}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-80px' }}
            className="grid lg:grid-cols-[1.2fr_0.8fr] gap-8 items-start"
          >
            <motion.div variants={slideInLeft} className="bg-white rounded-[2rem] border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-8 pt-8 pb-6 border-b border-gray-100">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass mb-4">
                  <span className="w-2 h-2 bg-primary-400 rounded-full" />
                  <span className="text-xs text-gray-500 uppercase tracking-widest font-medium">Message Form</span>
                </div>
                <h2 className="text-3xl font-bold text-gray-900 mb-3">Send Us a Message</h2>
                <p className="text-gray-500 leading-relaxed">
                  Tell us what you need and the right team member will follow up with you.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={handleChange('fullName')}
                      className="input-field"
                      placeholder="Your full name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input
                      type="email"
                      value={formData.email}
                      onChange={handleChange('email')}
                      className="input-field"
                      placeholder="you@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={handleChange('phone')}
                      className="input-field"
                      placeholder="+966 5X XXX XXXX"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                    <input
                      type="text"
                      value={formData.subject}
                      onChange={handleChange('subject')}
                      className="input-field"
                      placeholder="How can we help?"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={handleChange('message')}
                    className="input-field min-h-[180px] resize-none"
                    placeholder="Share a little context so we can help you faster."
                    required
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <p className="text-sm text-gray-400">
                    We only use your details to respond to your inquiry.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary px-8 py-3 text-base disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Sending...' : 'Send Message'}
                  </button>
                </div>
              </form>
            </motion.div>

            <motion.div variants={slideInRight} className="space-y-6">
              <div className="bg-gradient-to-br from-primary-50 to-cyan-50 rounded-[2rem] border border-primary-100 shadow-sm p-8">
                <p className="text-xs uppercase tracking-[0.22em] text-primary-600 font-semibold mb-4">Need Direction?</p>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Here’s the Fastest Way to Reach Us</h3>
                <div className="space-y-4 text-sm text-gray-600 leading-relaxed">
                  <div className="bg-white/80 rounded-2xl border border-white px-4 py-4">
                    <p className="font-semibold text-gray-900 mb-1">Learning & Enrollment</p>
                    <p>Questions about chapters, subscriptions, or the right learning path for your goals.</p>
                  </div>
                  <div className="bg-white/80 rounded-2xl border border-white px-4 py-4">
                    <p className="font-semibold text-gray-900 mb-1">Studio & Partnership Requests</p>
                    <p>Reach out for collaborations, institutional programs, and studio-level opportunities.</p>
                  </div>
                  <div className="bg-white/80 rounded-2xl border border-white px-4 py-4">
                    <p className="font-semibold text-gray-900 mb-1">Creator Support</p>
                    <p>Ask about creator onboarding, content publishing, or platform support.</p>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-[2rem] border border-gray-200 shadow-sm p-8">
                <p className="text-xs uppercase tracking-[0.22em] text-gray-400 font-semibold mb-4">Quick Links</p>
                <div className="space-y-3">
                  <Link to="/courses" className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-gray-700 hover:border-primary-200 hover:text-primary-600 transition-colors">
                    <span>Explore Chapters</span>
                    <span>→</span>
                  </Link>
                  <Link to="/consultations" className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-gray-700 hover:border-primary-200 hover:text-primary-600 transition-colors">
                    <span>Book a Consultation</span>
                    <span>→</span>
                  </Link>
                  <Link to="/about" className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-gray-700 hover:border-primary-200 hover:text-primary-600 transition-colors">
                    <span>Learn More About Aiqda</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>
    </motion.div>
  );
}

export default ContactUs;
