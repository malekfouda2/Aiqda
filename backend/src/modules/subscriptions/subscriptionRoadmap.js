export const DEFAULT_ANNUAL_DURATION_DAYS = 365;
export const DEFAULT_MONTHLY_DURATION_DAYS = 30;
export const DEFAULT_ANNUAL_MULTIPLIER = 10;

export const LEGACY_SUBSCRIPTION_PACKAGE_NAMES = [
  'Engineering Starter',
  'Architecture Professional',
  'Business Analytics Bundle',
  'Complete Professional Package',
];

export const ROADMAP_PACKAGE_NAMES = [
  'Start Smart',
  'Pro Artist',
  'Full Studio',
  'Semester / Professional Track',
  'Enterprise',
];

export const ROADMAP_SELF_SERVE_PACKAGE_BLUEPRINTS = [
  {
    key: 'start-smart',
    name: 'Start Smart',
    monthlyPrice: 299,
    scheduleDuration: 'Monthly / Annual',
    learningMode: 'Asset to Asset Project-based',
    focus: 'Industry orientation, tool awareness, foundational concepts',
    softwareExposure: [
      'Photoshop/Krita',
      'Illustrator',
      'Toon Boom/After Effects',
      'Blender/Maya',
      'Unreal Engine',
      'Pipeline context',
    ],
    outcome: 'Individuals are able to create a simple, complete creative piece appropriate to entry-level understanding and basic visual structure.',
  },
  {
    key: 'pro-artist',
    name: 'Pro Artist',
    monthlyPrice: 349,
    scheduleDuration: 'Monthly / Annual',
    learningMode: 'Asset to Asset Project-based',
    focus: 'Applied fundamentals, skill combination',
    softwareExposure: ['Photoshop', 'Toon Boom', 'Blender/Maya', 'After Effects'],
    outcome: 'Individuals are able to create a finished creative work that demonstrates applied skills and coherent execution at an intermediate level.',
  },
  {
    key: 'full-studio',
    name: 'Full Studio',
    monthlyPrice: 499,
    scheduleDuration: 'Monthly / Annual',
    learningMode: 'Asset to Asset Project-based',
    focus: 'Studio workflows, pipeline execution, production discipline',
    softwareExposure: ['Maya/Blender', 'Unreal Engine', 'After Effects', 'Production pipeline tools'],
    outcome: 'Individuals are able to create a multi-element finished project reflecting structured production thinking and pipeline awareness.',
  },
  {
    key: 'semester-track',
    name: 'Semester / Professional Track',
    monthlyPrice: 899,
    scheduleDuration: 'Monthly / Annual',
    learningMode: 'Asset to Asset Project-based',
    focus: 'Professional readiness, specialization, portfolio development',
    softwareExposure: ['Full toolset based on specialization'],
    outcome: 'Individuals are able to create a polished, end-to-end creative product aligned with advanced industry-level complexity.',
  },
];

export const ROADMAP_ENTERPRISE_PACKAGE_BLUEPRINT = {
  key: 'enterprise',
  name: 'Enterprise',
  scheduleDuration: 'Custom (contract-based)',
  learningMode: 'Asset to Asset Project-based',
  focus: 'Institutional training, workforce upskilling, government alignment',
  softwareExposure: ['Defined per contract (Animation, Games, Film, VFX pipelines)'],
  outcome: 'Organizations are able to deploy appropriate Aiqda learning packages across their workforce, aligned with operational goals, scale, and industry context.',
};

export const buildSelfServeBillingOptions = (
  monthlyPrice,
  annualPrice = monthlyPrice * DEFAULT_ANNUAL_MULTIPLIER,
  monthlyDurationDays = DEFAULT_MONTHLY_DURATION_DAYS,
  annualDurationDays = DEFAULT_ANNUAL_DURATION_DAYS
) => ([
  {
    term: 'monthly',
    label: 'Monthly',
    price: monthlyPrice,
    durationDays: monthlyDurationDays,
    isActive: true,
  },
  {
    term: 'annual',
    label: 'Annual',
    price: annualPrice,
    durationDays: annualDurationDays,
    isActive: true,
  },
]);
