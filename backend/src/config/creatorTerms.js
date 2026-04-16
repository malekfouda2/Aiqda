export const CREATOR_TERMS_VERSION = 'POL-0016';

export const CREATOR_AGREEMENT_ERROR_MESSAGE =
  'Please accept the creator agreement disclaimer before submitting your application.';

export const hasAcceptedCreatorAgreement = (value) => {
  return value === true || value === 'true' || value === '1' || value === 1;
};
