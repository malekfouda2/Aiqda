import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { fadeInUp, staggerContainer, pageVariants } from '../utils/animations';

const STEPS = [
  { id: 1, name: 'Studio Identity' },
  { id: 2, name: 'Delivery Format' },
  { id: 3, name: 'Contribution' },
  { id: 4, name: 'Objectives' },
];

const VIDEO_FILE_SIZES = [
  '1–3 min: Max 500 MB',
  '4–6 min: Max 1 GB',
  '7–9 min: Max 1.5 GB',
];

const VIDEO_FORMATS = ['.mov', '.mp4'];
const FRAME_RATES = ['24 fps', '30 fps'];
const DOMAINS = ['Animation', 'VFX'];
const OBJECTIVES = ['Brand visibility', 'Institutional exposure and potential contracts', 'All of the above'];

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction < 0 ? 300 : -300, opacity: 0 }),
};

export default function StudioApplication() {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState({});

  const [formState, setFormState] = useState({
    studioName: '',
    yearEstablished: '',
    countryOfRegistration: '',
    websitePortfolio: '',
    studioType: '',
    videoResolutionAck: false,
    videoFileSizes: [],
    videoFormats: [],
    frameRates: [],
    audioSpecAck: false,
    audioFrequencyAck: false,
    domains: [],
    objectives: [],
  });

  const updateField = (field, value) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const toggleArrayItem = (field, item) => {
    setFormState((prev) => {
      const current = prev[field];
      const updated = current.includes(item)
        ? current.filter((i) => i !== item)
        : [...current, item];
      return { ...prev, [field]: updated };
    });
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formState.studioName.trim()) newErrors.studioName = 'Studio name is required';
      if (!formState.yearEstablished.trim()) newErrors.yearEstablished = 'Year established is required';
      if (!formState.countryOfRegistration.trim()) newErrors.countryOfRegistration = 'Country is required';
      if (!formState.websitePortfolio.trim()) newErrors.websitePortfolio = 'Website/Portfolio link is required';
      if (!formState.studioType) newErrors.studioType = 'Studio type is required';
    }

    if (step === 2) {
      if (!formState.videoResolutionAck) newErrors.videoResolutionAck = 'You must acknowledge the video resolution policy';
      if (formState.videoFileSizes.length !== VIDEO_FILE_SIZES.length) newErrors.videoFileSizes = 'All file size policies must be acknowledged';
      if (formState.videoFormats.length === 0) newErrors.videoFormats = 'Select at least one video format';
      if (formState.frameRates.length === 0) newErrors.frameRates = 'Select at least one frame rate';
      if (!formState.audioSpecAck) newErrors.audioSpecAck = 'You must acknowledge the audio specification policy';
      if (!formState.audioFrequencyAck) newErrors.audioFrequencyAck = 'You must acknowledge the audio frequency policy';
    }

    if (step === 3) {
      if (formState.domains.length === 0) newErrors.domains = 'Select at least one domain';
    }

    if (step === 4) {
      if (formState.objectives.length === 0) newErrors.objectives = 'Select at least one objective';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep(currentStep)) {
      setDirection(1);
      setCurrentStep((prev) => Math.min(prev + 1, 4));
    }
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(4)) return;

    setIsSubmitting(true);
    try {
      await axios.post('/api/studio-applications', formState);
      setIsSubmitted(true);
    } catch (err) {
      setErrors({ submit: err.response?.data?.message || 'Something went wrong. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderError = (field) =>
    errors[field] ? (
      <motion.p
        initial={{ opacity: 0, y: -5 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-red-500 text-xs mt-1"
      >
        {errors[field]}
      </motion.p>
    ) : null;

  const renderStep1 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Legal Studio Name *</label>
        <input
          type="text"
          value={formState.studioName}
          onChange={(e) => updateField('studioName', e.target.value)}
          className="input-field"
          placeholder="Enter studio name"
        />
        {renderError('studioName')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Year Established *</label>
          <input
            type="text"
            value={formState.yearEstablished}
            onChange={(e) => updateField('yearEstablished', e.target.value)}
            className="input-field"
            placeholder="e.g. 2010"
          />
          {renderError('yearEstablished')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Country of Registration *</label>
          <input
            type="text"
            value={formState.countryOfRegistration}
            onChange={(e) => updateField('countryOfRegistration', e.target.value)}
            className="input-field"
            placeholder="e.g. United States"
          />
          {renderError('countryOfRegistration')}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Website + Portfolio Link *</label>
        <input
          type="url"
          value={formState.websitePortfolio}
          onChange={(e) => updateField('websitePortfolio', e.target.value)}
          className="input-field"
          placeholder="https://yourstudio.com"
        />
        {renderError('websitePortfolio')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Studio Type *</label>
        <div className="flex gap-4">
          {['Animation Studio', 'VFX Studio'].map((type) => (
            <label key={type} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="studioType"
                value={type}
                checked={formState.studioType === type}
                onChange={(e) => updateField('studioType', e.target.value)}
                className="w-4 h-4 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{type}</span>
            </label>
          ))}
        </div>
        {renderError('studioType')}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
        <h4 className="text-sm font-semibold text-blue-800 mb-2">Delivery Policy</h4>
        <p className="text-xs text-blue-600 leading-relaxed">
          To maintain high-quality standards, all studios must adhere to the following technical delivery requirements.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.videoResolutionAck}
              onChange={(e) => updateField('videoResolutionAck', e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 font-medium">1920 x 1080 (Full HD – Mandatory) *</span>
          </label>
          {renderError('videoResolutionAck')}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Video File Sizes (All Required) *</label>
          <div className="space-y-2">
            {VIDEO_FILE_SIZES.map((size) => (
              <label key={size} className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formState.videoFileSizes.includes(size)}
                  onChange={() => toggleArrayItem('videoFileSizes', size)}
                  className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-600">{size}</span>
              </label>
            ))}
          </div>
          {renderError('videoFileSizes')}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Video Formats *</label>
            <div className="flex gap-4">
              {VIDEO_FORMATS.map((fmt) => (
                <label key={fmt} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.videoFormats.includes(fmt)}
                    onChange={() => toggleArrayItem('videoFormats', fmt)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">{fmt}</span>
                </label>
              ))}
            </div>
            {renderError('videoFormats')}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Frame Rates *</label>
            <div className="flex gap-4">
              {FRAME_RATES.map((rate) => (
                <label key={rate} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.frameRates.includes(rate)}
                    onChange={() => toggleArrayItem('frameRates', rate)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600">{rate}</span>
                </label>
              ))}
            </div>
            {renderError('frameRates')}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.audioSpecAck}
              onChange={(e) => updateField('audioSpecAck', e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 font-medium">Stereo (2 Channels – Mandatory) *</span>
          </label>
          {renderError('audioSpecAck')}

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={formState.audioFrequencyAck}
              onChange={(e) => updateField('audioFrequencyAck', e.target.checked)}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700 font-medium">-12 dB to -6 dB Peak Range (Mandatory) *</span>
          </label>
          {renderError('audioFrequencyAck')}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">Our studio can contribute structured, chapter-based tutorials in:</p>
      <div className="grid grid-cols-1 gap-3">
        {DOMAINS.map((domain) => (
          <label
            key={domain}
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
              formState.domains.includes(domain)
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={formState.domains.includes(domain)}
              onChange={() => toggleArrayItem('domains', domain)}
              className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm font-medium">{domain}</span>
          </label>
        ))}
      </div>
      {renderError('domains')}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-5">
      <p className="text-sm text-gray-600">What are your primary objectives for partnering with Aiqda? (select all that apply)</p>
      <div className="grid grid-cols-1 gap-3">
        {OBJECTIVES.map((objective) => (
          <label
            key={objective}
            className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all duration-200 ${
              formState.objectives.includes(objective)
                ? 'border-primary-400 bg-primary-50 text-primary-700'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              checked={formState.objectives.includes(objective)}
              onChange={() => toggleArrayItem('objectives', objective)}
              className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
            />
            <span className="text-sm font-medium">{objective}</span>
          </label>
        ))}
      </div>
      {renderError('objectives')}
    </div>
  );

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeInUp}
          className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center"
        >
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Application Submitted!</h2>
          <p className="text-gray-600 mb-8 leading-relaxed">
            Thank you for applying as a studio partner at Aiqda. We'll review your application and get back to you soon.
          </p>
          <Link to="/" className="btn-primary w-full py-3 inline-block">
            Return Home
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] relative overflow-hidden py-20 px-4">
      {/* Background orbs */}
      <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-primary-200/30 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-200/20 rounded-full blur-[120px] pointer-events-none" />

      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto relative z-10"
      >
        <motion.div variants={fadeInUp} className="text-center mb-10">
          <h1 className="text-4xl font-bold text-gray-900 mb-3">Studio Application</h1>
          <p className="text-gray-600">Join Aiqda as an Animation & VFX studio partner</p>
        </motion.div>

        {/* Step Progress Bar */}
        <motion.div variants={fadeInUp} className="mb-8">
          <div className="flex justify-between mb-2">
            {STEPS.map((step) => (
              <span
                key={step.id}
                className={`text-xs font-bold uppercase tracking-wider ${
                  currentStep >= step.id ? 'text-primary-600' : 'text-gray-400'
                }`}
              >
                {step.name}
              </span>
            ))}
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: '0%' }}
              animate={{ width: `${(currentStep / STEPS.length) * 100}%` }}
              className="h-full bg-primary-500"
            />
          </div>
        </motion.div>

        <motion.div
          variants={fadeInUp}
          className="bg-white rounded-[32px] shadow-sm border border-gray-100 p-8 md:p-10"
        >
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.2 } }}
            >
              {currentStep === 1 && renderStep1()}
              {currentStep === 2 && renderStep2()}
              {currentStep === 3 && renderStep3()}
              {currentStep === 4 && renderStep4()}
            </motion.div>
          </AnimatePresence>

          {errors.submit && (
            <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
              {errors.submit}
            </div>
          )}

          <div className="mt-10 flex gap-4">
            {currentStep > 1 && (
              <button
                onClick={goBack}
                disabled={isSubmitting}
                className="flex-1 px-6 py-4 rounded-2xl border border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Back
              </button>
            )}
            {currentStep < 4 ? (
              <button
                onClick={goNext}
                className="flex-[2] bg-primary-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200"
              >
                Continue
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-[2] bg-primary-600 text-white px-6 py-4 rounded-2xl font-bold hover:bg-primary-700 transition-colors shadow-lg shadow-primary-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </>
                ) : (
                  'Submit Application'
                )}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
