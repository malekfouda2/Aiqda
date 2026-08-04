import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLocale } from '../i18n/useLocale';
import {
  initAnalytics,
  trackAnalyticsEvent,
  trackPageEngagement,
  trackPageView,
} from '../utils/analytics';

const SCROLL_MILESTONES = [25, 50, 75, 90];

const getPathFromLocation = (location) => `${location.pathname || '/'}${location.search || ''}${location.hash || ''}`;

const getScrollPercent = () => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return 0;
  }

  const root = document.documentElement;
  const scrollTop = window.scrollY || root.scrollTop || 0;
  const maxScrollable = Math.max(root.scrollHeight - window.innerHeight, 0);

  if (maxScrollable <= 0) {
    return 100;
  }

  return Math.min(100, Math.max(0, Math.round((scrollTop / maxScrollable) * 100)));
};

const getElementLabel = (element) => {
  if (!(element instanceof Element)) {
    return '';
  }

  const explicitLabel = element.getAttribute('data-analytics-label')
    || element.getAttribute('aria-label')
    || element.getAttribute('title');
  if (explicitLabel) {
    return explicitLabel.trim().slice(0, 160);
  }

  const textContent = element.textContent || '';
  return textContent.replace(/\s+/g, ' ').trim().slice(0, 160);
};

function PublicAnalyticsTracker() {
  const location = useLocation();
  const { locale } = useLocale();
  const routePath = getPathFromLocation(location);
  const pageStateRef = useRef({
    path: '',
    title: '',
    locale: null,
    enteredAt: 0,
    activeStartedAt: 0,
    activeDurationMs: 0,
    maxScrollPercent: 0,
    scrollMilestonesSent: new Set(),
  });

  const flushPageEngagement = (nextPath = '', useBeacon = false) => {
    const pageState = pageStateRef.current;
    if (!pageState.path) {
      return;
    }

    const now = Date.now();
    if (pageState.activeStartedAt > 0) {
      pageState.activeDurationMs += now - pageState.activeStartedAt;
      pageState.activeStartedAt = 0;
    }

    void trackPageEngagement({
      path: pageState.path,
      title: pageState.title,
      locale: pageState.locale,
      metadata: {
        enteredAt: pageState.enteredAt,
        engagementTimeMs: pageState.activeDurationMs,
        maxScrollPercent: pageState.maxScrollPercent,
        nextPath,
      },
    }, { useBeacon });
  };

  useEffect(() => {
    void initAnalytics();
  }, []);

  useEffect(() => {
    const nextPath = routePath;
    const previousPath = pageStateRef.current.path || '';

    if (previousPath && previousPath !== nextPath) {
      flushPageEngagement(nextPath);
    }

    pageStateRef.current = {
      path: nextPath,
      title: typeof document !== 'undefined' ? document.title || '' : '',
      locale,
      enteredAt: Date.now(),
      activeStartedAt: typeof document === 'undefined' || document.visibilityState === 'visible' ? Date.now() : 0,
      activeDurationMs: 0,
      maxScrollPercent: getScrollPercent(),
      scrollMilestonesSent: new Set(),
    };

    void trackPageView({
      path: nextPath,
      title: typeof document !== 'undefined' ? document.title || '' : '',
      locale,
      metadata: {
        previousPath,
        navigationType: previousPath ? 'spa_navigation' : 'initial_load',
      },
    });

    const searchParams = new URLSearchParams(location.search || '');
    const searchTerm = searchParams.get('q') || searchParams.get('query') || searchParams.get('search') || '';
    if (searchTerm.trim()) {
      void trackAnalyticsEvent('search', {
        path: nextPath,
        title: typeof document !== 'undefined' ? document.title || '' : '',
        locale,
        metadata: {
          searchTerm: searchTerm.trim().slice(0, 160),
        },
      });
    }
  }, [locale, location.search, routePath]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const pageState = pageStateRef.current;
      if (!pageState.path) {
        return;
      }

      const now = Date.now();
      if (document.visibilityState === 'hidden') {
        if (pageState.activeStartedAt > 0) {
          pageState.activeDurationMs += now - pageState.activeStartedAt;
          pageState.activeStartedAt = 0;
        }
        return;
      }

      if (pageState.activeStartedAt === 0) {
        pageState.activeStartedAt = now;
      }
    };

    const handlePageHide = () => {
      flushPageEngagement('exit', true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, []);

  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const pageState = pageStateRef.current;
        if (!pageState.path) {
          return;
        }

        const percent = getScrollPercent();
        pageState.maxScrollPercent = Math.max(pageState.maxScrollPercent, percent);

        for (const milestone of SCROLL_MILESTONES) {
          if (percent < milestone || pageState.scrollMilestonesSent.has(milestone)) {
            continue;
          }

          pageState.scrollMilestonesSent.add(milestone);
          void trackAnalyticsEvent('scroll_depth', {
            path: pageState.path,
            title: pageState.title,
            locale: pageState.locale,
            metadata: {
              percent: milestone,
            },
          });
        }
      });
    };

    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    const handleClick = (event) => {
      const targetElement = event.target instanceof Element
        ? event.target.closest('a,button,[role="button"],[data-analytics-click]')
        : null;
      if (!targetElement) {
        return;
      }

      const pageState = pageStateRef.current;
      const label = getElementLabel(targetElement);
      const basePayload = {
        path: pageState.path || getPathFromLocation(location),
        title: pageState.title || (typeof document !== 'undefined' ? document.title || '' : ''),
        locale: pageState.locale || locale,
      };

        const rawHref = targetElement.getAttribute('href') || '';
        const isDownload = targetElement.hasAttribute('download')
          || /\.(pdf|doc|docx|ppt|pptx|xls|xlsx|zip|rar|png|jpe?g|mp4|mov|mp3)$/i.test(rawHref);
        if (rawHref) {
          try {
            const url = new URL(rawHref, window.location.origin);
            const isExternal = url.origin !== window.location.origin;
            const eventType = isDownload ? 'file_download' : isExternal ? 'outbound_click' : 'navigation_click';
            void trackAnalyticsEvent(eventType, {
              ...basePayload,
              metadata: {
                label,
              href: url.href,
              destinationPath: `${url.pathname || '/'}${url.search || ''}${url.hash || ''}`,
              elementTag: targetElement.tagName.toLowerCase(),
            },
          });
          return;
        } catch {
          // Ignore invalid href values.
        }
      }

      void trackAnalyticsEvent('cta_click', {
        ...basePayload,
        metadata: {
          label,
          elementTag: targetElement.tagName.toLowerCase(),
          elementType: targetElement.getAttribute('type') || targetElement.getAttribute('role') || '',
          analyticsId: targetElement.getAttribute('data-analytics-id') || '',
        },
      });
    };

    document.addEventListener('click', handleClick, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [locale, routePath]);

  return null;
}

export default PublicAnalyticsTracker;
