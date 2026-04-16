export const PLATFORM_NOTICE_VERSION = 'POL-0016';

export const PLATFORM_NOTICE_ERROR_MESSAGE = 'Please accept the Terms & Conditions For Users before continuing.';

export const hasAcceptedCurrentPlatformNotice = (notice = null) => {
  return notice?.version === PLATFORM_NOTICE_VERSION && Boolean(notice?.acceptedAt);
};

export const hasAcceptedPlatformNoticeInput = (value) => {
  return value === true || value === 'true' || value === '1' || value === 1;
};
