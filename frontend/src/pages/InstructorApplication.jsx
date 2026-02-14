import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const COUNTRY_CODES = [
  { code: '+1', label: 'US/CA (+1)' },
  { code: '+44', label: 'UK (+44)' },
  { code: '+966', label: 'Saudi Arabia (+966)' },
  { code: '+971', label: 'UAE (+971)' },
  { code: '+20', label: 'Egypt (+20)' },
  { code: '+91', label: 'India (+91)' },
  { code: '+61', label: 'Australia (+61)' },
  { code: '+49', label: 'Germany (+49)' },
  { code: '+33', label: 'France (+33)' },
  { code: '+81', label: 'Japan (+81)' },
  { code: '+86', label: 'China (+86)' },
  { code: '+82', label: 'South Korea (+82)' },
  { code: '+55', label: 'Brazil (+55)' },
  { code: '+52', label: 'Mexico (+52)' },
  { code: '+34', label: 'Spain (+34)' },
  { code: '+39', label: 'Italy (+39)' },
  { code: '+90', label: 'Turkey (+90)' },
  { code: '+62', label: 'Indonesia (+62)' },
  { code: '+60', label: 'Malaysia (+60)' },
  { code: '+65', label: 'Singapore (+65)' },
];

const STEPS = [
  { id: 1, name: 'Personal Info' },
  { id: 2, name: 'Education' },
  { id: 3, name: 'Professional' },
  { id: 4, name: 'Teaching' },
  { id: 5, name: 'Availability' },
];

const SPECIALIZATIONS = ['2D', '3D', 'Storyboarding for Animation', 'Stop Motion', 'Other'];

const slideVariants = {
  enter: (direction) => ({ x: direction > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction < 0 ? 300 : -300, opacity: 0 }),
};

function InstructorApplication() {
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [errors, setErrors] = useState({});
  const cvInputRef = useRef(null);
  const materialsInputRef = useRef(null);

  const [formState, setFormState] = useState({
    email: '',
    fullName: '',
    nationality: '',
    country: '',
    city: '',
    phoneCode: '+1',
    phoneNumber: '',
    educationLevel: '',
    fieldOfStudy: '',
    yearsOfExperience: '',
    specialization: [],
    previousTeachingExperience: '',
    softwareProficiency: '',
    institutionsOrStudios: '',
    notableWorks: '',
    websiteOrPortfolio: '',
    cvFile: null,
    teachingStyle: '',
    studentGuidance: '',
    existingCourseMaterials: '',
    courseMaterialsFile: null,
    preferredSchedule: '',
    earliestStartDate: '',
    additionalComments: '',
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

  const toggleSpecialization = (spec) => {
    setFormState((prev) => {
      const current = prev.specialization;
      const updated = current.includes(spec)
        ? current.filter((s) => s !== spec)
        : [...current, spec];
      return { ...prev, specialization: updated };
    });
    if (errors.specialization) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next.specialization;
        return next;
      });
    }
  };

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formState.email.trim()) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formState.email)) newErrors.email = 'Enter a valid email';
      if (!formState.fullName.trim()) newErrors.fullName = 'Full name is required';
      if (!formState.nationality.trim()) newErrors.nationality = 'Nationality is required';
      if (!formState.country.trim()) newErrors.country = 'Country is required';
      if (!formState.city.trim()) newErrors.city = 'City is required';
      if (!formState.phoneNumber.trim()) newErrors.phoneNumber = 'Phone number is required';
    }

    if (step === 2) {
      if (!formState.educationLevel) newErrors.educationLevel = 'Level of education is required';
      if (!formState.fieldOfStudy.trim()) newErrors.fieldOfStudy = 'Field of study is required';
      if (!formState.yearsOfExperience.trim()) newErrors.yearsOfExperience = 'Years of experience is required';
      if (formState.specialization.length === 0) newErrors.specialization = 'Select at least one specialization';
    }

    if (step === 3) {
      if (!formState.softwareProficiency.trim()) newErrors.softwareProficiency = 'Software proficiency is required';
      if (!formState.cvFile) newErrors.cvFile = 'CV/Resume is required';
    }

    if (step === 4) {
      if (!formState.teachingStyle.trim()) newErrors.teachingStyle = 'Teaching style is required';
      if (!formState.studentGuidance.trim()) newErrors.studentGuidance = 'This field is required';
    }

    if (step === 5) {
      if (!formState.preferredSchedule.trim()) newErrors.preferredSchedule = 'Preferred schedule is required';
      if (!formState.earliestStartDate) newErrors.earliestStartDate = 'Earliest start date is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep(currentStep)) {
      setDirection(1);
      setCurrentStep((prev) => Math.min(prev + 1, 5));
    }
  };

  const goBack = () => {
    setDirection(-1);
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    if (!validateStep(5)) return;

    setIsSubmitting(true);
    try {
      const data = new FormData();
      data.append('email', formState.email);
      data.append('fullName', formState.fullName);
      data.append('nationality', formState.nationality);
      data.append('country', formState.country);
      data.append('city', formState.city);
      data.append('phoneCode', formState.phoneCode);
      data.append('phoneNumber', formState.phoneNumber);
      data.append('educationLevel', formState.educationLevel);
      data.append('fieldOfStudy', formState.fieldOfStudy);
      data.append('yearsOfExperience', formState.yearsOfExperience);
      data.append('specialization', JSON.stringify(formState.specialization));
      data.append('previousTeachingExperience', formState.previousTeachingExperience);
      data.append('softwareProficiency', formState.softwareProficiency);
      data.append('institutionsOrStudios', formState.institutionsOrStudios);
      data.append('notableWorks', formState.notableWorks);
      data.append('websiteOrPortfolio', formState.websiteOrPortfolio);
      data.append('teachingStyle', formState.teachingStyle);
      data.append('studentGuidance', formState.studentGuidance);
      data.append('existingCourseMaterials', formState.existingCourseMaterials);
      data.append('preferredSchedule', formState.preferredSchedule);
      data.append('earliestStartDate', formState.earliestStartDate);
      data.append('additionalComments', formState.additionalComments);
      if (formState.cvFile) data.append('cvFile', formState.cvFile);
      if (formState.courseMaterialsFile) data.append('courseMaterialsFile', formState.courseMaterialsFile);

      await axios.post('/api/instructor-applications', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
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
        <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
        <input
          type="email"
          value={formState.email}
          onChange={(e) => updateField('email', e.target.value)}
          className="input-field"
          placeholder="you@example.com"
        />
        {renderError('email')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
        <input
          type="text"
          value={formState.fullName}
          onChange={(e) => updateField('fullName', e.target.value)}
          className="input-field"
          placeholder="John Doe"
        />
        {renderError('fullName')}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Nationality *</label>
          <input
            type="text"
            value={formState.nationality}
            onChange={(e) => updateField('nationality', e.target.value)}
            className="input-field"
            placeholder="e.g. American"
          />
          {renderError('nationality')}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Country *</label>
          <input
            type="text"
            value={formState.country}
            onChange={(e) => updateField('country', e.target.value)}
            className="input-field"
            placeholder="e.g. United States"
          />
          {renderError('country')}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">City *</label>
        <input
          type="text"
          value={formState.city}
          onChange={(e) => updateField('city', e.target.value)}
          className="input-field"
          placeholder="e.g. New York"
        />
        {renderError('city')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number *</label>
        <div className="flex gap-3">
          <select
            value={formState.phoneCode}
            onChange={(e) => updateField('phoneCode', e.target.value)}
            className="input-field w-44 flex-shrink-0"
          >
            {COUNTRY_CODES.map((cc) => (
              <option key={cc.code} value={cc.code}>{cc.label}</option>
            ))}
          </select>
          <input
            type="tel"
            value={formState.phoneNumber}
            onChange={(e) => updateField('phoneNumber', e.target.value)}
            className="input-field flex-1"
            placeholder="555 123 4567"
          />
        </div>
        {renderError('phoneNumber')}
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Level of Education *</label>
        <select
          value={formState.educationLevel}
          onChange={(e) => updateField('educationLevel', e.target.value)}
          className="input-field"
        >
          <option value="">Select level</option>
          <option value="Bachelor Degree">Bachelor Degree</option>
          <option value="Masters Degree">Masters Degree</option>
          <option value="PhD">PhD</option>
          <option value="Other">Other</option>
        </select>
        {renderError('educationLevel')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Field of Study *</label>
        <input
          type="text"
          value={formState.fieldOfStudy}
          onChange={(e) => updateField('fieldOfStudy', e.target.value)}
          className="input-field"
          placeholder="e.g. Animation, Fine Arts"
        />
        {renderError('fieldOfStudy')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Years of Experience in Animation or Related Field *</label>
        <input
          type="text"
          value={formState.yearsOfExperience}
          onChange={(e) => updateField('yearsOfExperience', e.target.value)}
          className="input-field"
          placeholder="e.g. 5 years"
        />
        {renderError('yearsOfExperience')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Specialization * (select all that apply)</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {SPECIALIZATIONS.map((spec) => (
            <label
              key={spec}
              className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${
                formState.specialization.includes(spec)
                  ? 'border-primary-400 bg-primary-50 text-primary-700'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <input
                type="checkbox"
                checked={formState.specialization.includes(spec)}
                onChange={() => toggleSpecialization(spec)}
                className="w-4 h-4 rounded border-gray-300 text-primary-500 focus:ring-primary-500"
              />
              <span className="text-sm font-medium">{spec}</span>
            </label>
          ))}
        </div>
        {renderError('specialization')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Previous Teaching or Mentorship Experience</label>
        <textarea
          value={formState.previousTeachingExperience}
          onChange={(e) => updateField('previousTeachingExperience', e.target.value)}
          className="input-field min-h-[100px] resize-y"
          placeholder="Describe any relevant teaching or mentoring experience..."
          rows={4}
        />
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Software Proficiency *</label>
        <input
          type="text"
          value={formState.softwareProficiency}
          onChange={(e) => updateField('softwareProficiency', e.target.value)}
          className="input-field"
          placeholder="e.g. Maya, Blender, After Effects, Toon Boom"
        />
        {renderError('softwareProficiency')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Institutions, Studios or Projects You've Worked With</label>
        <textarea
          value={formState.institutionsOrStudios}
          onChange={(e) => updateField('institutionsOrStudios', e.target.value)}
          className="input-field min-h-[100px] resize-y"
          placeholder="List institutions, studios, or projects..."
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Notable Works, Productions or Publications</label>
        <textarea
          value={formState.notableWorks}
          onChange={(e) => updateField('notableWorks', e.target.value)}
          className="input-field min-h-[100px] resize-y"
          placeholder="List any notable works or publications..."
          rows={3}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Website or Portfolio Link</label>
        <input
          type="url"
          value={formState.websiteOrPortfolio}
          onChange={(e) => updateField('websiteOrPortfolio', e.target.value)}
          className="input-field"
          placeholder="https://your-portfolio.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Upload CV/Resume * (PDF, DOC, DOCX)</label>
        <div
          onClick={() => cvInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all duration-200 ${
            formState.cvFile
              ? 'border-primary-300 bg-primary-50'
              : errors.cvFile
              ? 'border-red-300 bg-red-50'
              : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
          }`}
        >
          <input
            ref={cvInputRef}
            type="file"
            accept=".pdf,.doc,.docx"
            className="hidden"
            onChange={(e) => updateField('cvFile', e.target.files[0] || null)}
          />
          {formState.cvFile ? (
            <div className="flex items-center justify-center gap-3">
              <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="text-left">
                <p className="text-sm font-medium text-gray-800">{formState.cvFile.name}</p>
                <p className="text-xs text-gray-500">{(formState.cvFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); updateField('cvFile', null); }}
                className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <>
              <svg className="w-10 h-10 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 font-medium">Click to upload your CV/Resume</p>
              <p className="text-xs text-gray-400 mt-1">PDF, DOC, or DOCX (max 10MB)</p>
            </>
          )}
        </div>
        {renderError('cvFile')}
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Describe Your Teaching Style or Philosophy *</label>
        <textarea
          value={formState.teachingStyle}
          onChange={(e) => updateField('teachingStyle', e.target.value)}
          className="input-field min-h-[120px] resize-y"
          placeholder="Tell us about how you approach teaching and engaging students..."
          rows={4}
        />
        {renderError('teachingStyle')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">How Do You Guide Students Toward Completing a Final Project? *</label>
        <textarea
          value={formState.studentGuidance}
          onChange={(e) => updateField('studentGuidance', e.target.value)}
          className="input-field min-h-[120px] resize-y"
          placeholder="Describe your approach to mentoring students through project completion..."
          rows={4}
        />
        {renderError('studentGuidance')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Do You Have Existing Course Structure or Materials?</label>
        <textarea
          value={formState.existingCourseMaterials}
          onChange={(e) => updateField('existingCourseMaterials', e.target.value)}
          className="input-field min-h-[100px] resize-y"
          placeholder="Describe any existing course structures, syllabi, or materials you have..."
          rows={3}
        />
        <div className="mt-3">
          <div
            onClick={() => materialsInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-4 text-center cursor-pointer transition-all duration-200 ${
              formState.courseMaterialsFile
                ? 'border-primary-300 bg-primary-50'
                : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
          >
            <input
              ref={materialsInputRef}
              type="file"
              className="hidden"
              onChange={(e) => updateField('courseMaterialsFile', e.target.files[0] || null)}
            />
            {formState.courseMaterialsFile ? (
              <div className="flex items-center justify-center gap-3">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-gray-800">{formState.courseMaterialsFile.name}</span>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); updateField('courseMaterialsFile', null); }}
                  className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                <span className="text-primary-500 font-medium">Attach file</span> (optional)
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Preferred Teaching Schedule - Days & Times *</label>
        <textarea
          value={formState.preferredSchedule}
          onChange={(e) => updateField('preferredSchedule', e.target.value)}
          className="input-field min-h-[100px] resize-y"
          placeholder="e.g. Weekdays 6-9 PM EST, Saturdays 10 AM - 2 PM..."
          rows={3}
        />
        {renderError('preferredSchedule')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Earliest Starting Date *</label>
        <input
          type="date"
          value={formState.earliestStartDate}
          onChange={(e) => updateField('earliestStartDate', e.target.value)}
          className="input-field"
        />
        {renderError('earliestStartDate')}
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Additional Comments or Questions</label>
        <textarea
          value={formState.additionalComments}
          onChange={(e) => updateField('additionalComments', e.target.value)}
          className="input-field min-h-[100px] resize-y"
          placeholder="Anything else you'd like us to know..."
          rows={4}
        />
      </div>
    </div>
  );

  const stepRenderers = { 1: renderStep1, 2: renderStep2, 3: renderStep3, 4: renderStep4, 5: renderStep5 };

  if (isSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4 relative overflow-hidden bg-gray-50">
        <div className="absolute inset-0 mesh-gradient" />
        <div className="absolute inset-0 overflow-hidden">
          <div className="floating-orb w-[400px] h-[400px] bg-emerald-100/50 top-[-100px] left-[-100px] animate-float" />
          <div className="floating-orb w-[300px] h-[300px] bg-primary-100/40 bottom-[-50px] right-[-50px] animate-float-slow" />
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-lg text-center"
        >
          <div className="card p-10">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
              className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <svg className="w-10 h-10 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </motion.div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Application Submitted!</h2>
            <p className="text-gray-500 text-lg mb-8">
              Thank you for applying to be an instructor at Aiqda. We'll review your application and get back to you soon.
            </p>
            <Link to="/" className="btn-primary inline-block py-3 px-8 text-base">
              Back to Home
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-12 px-4 relative overflow-hidden bg-gray-50">
      <div className="absolute inset-0 mesh-gradient" />
      <div className="absolute inset-0 overflow-hidden">
        <div className="floating-orb w-[400px] h-[400px] bg-cyan-100/50 top-[-100px] left-[-100px] animate-float" />
        <div className="floating-orb w-[300px] h-[300px] bg-primary-100/40 bottom-[-50px] right-[-50px] animate-float-slow" />
        <div className="floating-orb w-[200px] h-[200px] bg-orange-100/30 top-1/2 right-1/4 animate-glow-pulse" />
      </div>

      <div className="relative max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <Link to="/" className="inline-block mb-6">
            <img src="/logo.png" alt="Aiqda" className="h-14 w-auto mx-auto" />
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Instructor Application</h1>
          <p className="text-gray-500 text-lg">Join our team of expert animation instructors</p>
        </div>

        <div className="card mb-8 p-4 md:p-6">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((step, index) => (
              <div key={step.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                      currentStep > step.id
                        ? 'bg-primary-500 text-white'
                        : currentStep === step.id
                        ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                        : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      step.id
                    )}
                  </div>
                  <span
                    className={`text-xs mt-1.5 font-medium hidden sm:block ${
                      currentStep >= step.id ? 'text-primary-600' : 'text-gray-400'
                    }`}
                  >
                    {step.name}
                  </span>
                </div>
                {index < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 mt-[-18px] sm:mt-[-18px]">
                    <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full"
                        initial={false}
                        animate={{ width: currentStep > step.id ? '100%' : '0%' }}
                        transition={{ duration: 0.4 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6 md:p-8 min-h-[400px]">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              {STEPS[currentStep - 1].name}
            </h2>
            <p className="text-sm text-gray-400 mt-1">Step {currentStep} of 5</p>
          </div>

          {errors.submit && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-6"
            >
              {errors.submit}
            </motion.div>
          )}

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {stepRenderers[currentStep]()}
            </motion.div>
          </AnimatePresence>

          <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
            {currentStep > 1 ? (
              <button
                type="button"
                onClick={goBack}
                className="btn-secondary flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            ) : (
              <div />
            )}
            {currentStep < 5 ? (
              <button
                type="button"
                onClick={goNext}
                className="btn-primary flex items-center gap-2"
              >
                Next
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="btn-primary flex items-center gap-2 py-3 px-8"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Submitting...
                  </span>
                ) : (
                  'Submit Application'
                )}
              </button>
            )}
          </div>
        </div>

        <p className="text-center text-gray-400 text-sm mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-500 hover:text-primary-600 font-medium transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default InstructorApplication;
