import { useRef, useEffect, useState, useCallback } from 'react';
import Player from '@vimeo/player';
import { useLocale } from '../i18n/useLocale';

const PROGRESS_SYNC_INTERVAL_MS = 5000;
const WATERMARK_MOVE_INTERVAL_MS = 9000;
const WATERMARK_CLOCK_INTERVAL_MS = 30000;
const WATERMARK_POSITIONS = [
  { top: '8%', left: '7%', rotate: '-11deg' },
  { top: '18%', left: '58%', rotate: '8deg' },
  { top: '38%', left: '20%', rotate: '-7deg' },
  { top: '56%', left: '62%', rotate: '10deg' },
  { top: '72%', left: '14%', rotate: '-6deg' },
  { top: '74%', left: '57%', rotate: '7deg' },
];

function buildFallbackEmbedUrl(vimeoVideoId) {
  if (!vimeoVideoId) {
    return '';
  }

  const url = new URL(`https://player.vimeo.com/video/${vimeoVideoId}`);
  url.searchParams.set('title', '0');
  url.searchParams.set('byline', '0');
  url.searchParams.set('portrait', '0');
  url.searchParams.set('badge', '0');
  url.searchParams.set('dnt', '1');
  url.searchParams.set('fullscreen', '0');
  return url.toString();
}

function normalizeEmbedUrl(embedUrl) {
  if (!embedUrl) {
    return '';
  }

  try {
    const url = new URL(embedUrl);
    url.searchParams.set('title', '0');
    url.searchParams.set('byline', '0');
    url.searchParams.set('portrait', '0');
    url.searchParams.set('badge', '0');
    url.searchParams.set('dnt', '1');
    url.searchParams.set('fullscreen', '0');
    return url.toString();
  } catch {
    return embedUrl;
  }
}

function formatWatermarkTimestamp(value, locale) {
  try {
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(value);
  } catch {
    return value.toISOString();
  }
}

function VimeoPlayer({ vimeoVideoId, embedUrl, onProgressUpdate, initialProgress = 0, viewerWatermark = null }) {
  const { t, isRTL } = useLocale();
  const shellRef = useRef(null);
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const playerInstanceIdRef = useRef(0);
  const watchedSegmentsRef = useRef(new Set());
  const lastSentProgressRef = useRef(initialProgress);
  const progressIntervalRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [watchedPercentage, setWatchedPercentage] = useState(initialProgress);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [playerError, setPlayerError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [watermarkIndex, setWatermarkIndex] = useState(0);
  const [watermarkTimestamp, setWatermarkTimestamp] = useState(() => new Date());

  useEffect(() => {
    const initial = new Set();
    for (let i = 0; i < initialProgress; i++) initial.add(i);
    watchedSegmentsRef.current = initial;
    setWatchedPercentage(initialProgress);
    lastSentProgressRef.current = initialProgress;
  }, [initialProgress]);

  const activeEmbedUrl = normalizeEmbedUrl(embedUrl) || buildFallbackEmbedUrl(vimeoVideoId);
  const activeWatermarkPosition = WATERMARK_POSITIONS[watermarkIndex % WATERMARK_POSITIONS.length];
  const secondaryWatermarkPosition = WATERMARK_POSITIONS[(watermarkIndex + 3) % WATERMARK_POSITIONS.length];

  const calculateWatchedPercentage = useCallback(() => {
    return Math.min(watchedSegmentsRef.current.size, 100);
  }, []);

  const sendProgress = useCallback((percentage) => {
    if (percentage > lastSentProgressRef.current && onProgressUpdate) {
      lastSentProgressRef.current = percentage;
      onProgressUpdate(percentage);
    }
  }, [onProgressUpdate]);

  useEffect(() => {
    if (!containerRef.current || !activeEmbedUrl) return;

    const instanceId = playerInstanceIdRef.current + 1;
    playerInstanceIdRef.current = instanceId;
    let isActive = true;
    let player = null;
    setPlayerReady(false);
    setIframeLoaded(false);
    setPlayerError(null);

    const isCurrentInstance = () => isActive && playerInstanceIdRef.current === instanceId;
    const shouldIgnoreError = (error) => (
      error?.message?.includes('Unknown player. Probably unloaded.')
      || error?.message?.includes('The player element passed isn’t a Vimeo embed.')
    );

    try {
      const container = containerRef.current;
      container.innerHTML = '';

      const iframe = document.createElement('iframe');
      iframe.src = activeEmbedUrl;
      iframe.title = isRTL ? 'مشغل فيديو Vimeo' : 'Vimeo video player';
      iframe.className = 'w-full h-full';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'autoplay; picture-in-picture; clipboard-write; encrypted-media; web-share');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.onload = () => {
        if (isCurrentInstance()) {
          setIframeLoaded(true);
        }
      };
      container.appendChild(iframe);

      player = new Player(iframe);

      playerRef.current = player;

      player.ready().then(() => {
        if (!isCurrentInstance()) {
          return;
        }
        setPlayerReady(true);
        player.getDuration().then(dur => {
          if (!isCurrentInstance()) {
            return;
          }
          setDuration(dur);
        });
      }).catch(err => {
        if (!isCurrentInstance() || shouldIgnoreError(err)) {
          return;
        }
        setPlayerError(isRTL ? 'تعذر تفعيل تتبع الفيديو المباشر، لكن قد يظل التشغيل متاحًا.' : 'Live video tracking could not be enabled, but playback may still be available.');
        console.error('Vimeo player error:', err);
      });

      player.on('play', () => {
        if (isCurrentInstance()) {
          setIsPlaying(true);
        }
      });
      player.on('pause', () => {
        if (isCurrentInstance()) {
          setIsPlaying(false);
          const pct = calculateWatchedPercentage();
          sendProgress(pct);
        }
      });
      player.on('ended', () => {
        if (!isCurrentInstance()) {
          return;
        }
        setIsPlaying(false);
        const pct = calculateWatchedPercentage();
        sendProgress(pct);
      });

      player.on('timeupdate', (data) => {
        if (!isCurrentInstance()) {
          return;
        }
        setCurrentTime(data.seconds);
        const segment = Math.floor(data.percent * 100);
        if (segment >= 0 && segment <= 100) {
          watchedSegmentsRef.current.add(segment);
        }
        const pct = calculateWatchedPercentage();
        setWatchedPercentage(pct);
      });

      player.on('error', (err) => {
        if (!isCurrentInstance() || shouldIgnoreError(err)) {
          return;
        }
        console.error('Vimeo player error event:', err);
        setPlayerError(isRTL ? 'حدث خطأ في تتبع فيديو Vimeo. إذا ظهر المشغل، يمكنك المتابعة بالمشاهدة.' : 'A Vimeo tracking error occurred. If the player is visible, you can continue watching.');
      });

      progressIntervalRef.current = setInterval(() => {
        const pct = calculateWatchedPercentage();
        if (pct > lastSentProgressRef.current) {
          sendProgress(pct);
        }
      }, PROGRESS_SYNC_INTERVAL_MS);
    } catch (err) {
      setPlayerError(isRTL ? 'تعذر تهيئة مشغل الفيديو.' : 'Failed to initialize video player.');
      console.error('Player init error:', err);
    }

    return () => {
      isActive = false;
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      const pct = calculateWatchedPercentage();
      if (pct > lastSentProgressRef.current && onProgressUpdate) {
        onProgressUpdate(pct);
      }
      const activePlayer = player;
      if (activePlayer) {
        activePlayer.destroy().catch(() => {});
        if (playerRef.current === activePlayer) {
          playerRef.current = null;
        }
      }
      if (containerRef.current && playerInstanceIdRef.current === instanceId) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [activeEmbedUrl, vimeoVideoId, calculateWatchedPercentage, isRTL, onProgressUpdate, sendProgress]);

  useEffect(() => {
    if (!viewerWatermark) {
      return undefined;
    }

    const moveInterval = setInterval(() => {
      setWatermarkIndex((current) => (current + 1) % WATERMARK_POSITIONS.length);
    }, WATERMARK_MOVE_INTERVAL_MS);
    const clockInterval = setInterval(() => {
      setWatermarkTimestamp(new Date());
    }, WATERMARK_CLOCK_INTERVAL_MS);

    return () => {
      clearInterval(moveInterval);
      clearInterval(clockInterval);
    };
  }, [viewerWatermark]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(shellRef.current && document.fullscreenElement === shellRef.current));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const shell = shellRef.current;
    if (!shell) {
      return;
    }

    try {
      if (document.fullscreenElement === shell) {
        await document.exitFullscreen?.();
        return;
      }

      await shell.requestFullscreen?.();
    } catch (error) {
      console.error('Failed to toggle custom fullscreen mode:', error);
      setPlayerError(isRTL ? 'تعذر فتح وضع ملء الشاشة المخصص.' : 'Failed to open custom fullscreen mode.');
    }
  }, [isRTL]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <div
        ref={shellRef}
        className={`aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-200 relative select-none ${isFullscreen ? 'vimeo-shell-fullscreen' : ''}`}
      >
        <div ref={containerRef} className="w-full h-full" />
        <button
          type="button"
          onClick={toggleFullscreen}
          className="absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-white/18 bg-slate-950/46 px-3 py-2 text-xs font-semibold text-white/88 shadow-lg backdrop-blur-sm transition hover:bg-slate-950/65"
          aria-label={isFullscreen ? (isRTL ? 'الخروج من ملء الشاشة' : 'Exit fullscreen') : (isRTL ? 'ملء الشاشة' : 'Enter fullscreen')}
        >
          <span aria-hidden="true">{isFullscreen ? '⤢' : '⤢'}</span>
          <span>{isFullscreen ? (isRTL ? 'خروج' : 'Exit') : (isRTL ? 'ملء الشاشة' : 'Fullscreen')}</span>
        </button>
        {viewerWatermark && (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {[activeWatermarkPosition, secondaryWatermarkPosition].map((position, index) => (
              <div
                key={`${position.top}-${position.left}-${index}`}
                className={`watermark-badge absolute max-w-[68%] rounded-2xl border border-white/14 bg-slate-950/24 px-3 py-2 text-white/78 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.95)] backdrop-blur-[2px] transition-all duration-[1800ms] ease-out ${index === 1 ? 'opacity-45' : 'opacity-75'}`}
                style={{
                  top: position.top,
                  left: position.left,
                  transform: `translate(-50%, -50%) rotate(${position.rotate})`,
                }}
              >
                <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/58">
                  {isRTL ? 'مشاهدة مرخصة' : 'Licensed View'}
                </div>
                <div className="mt-1 text-sm font-semibold leading-tight text-white/88">
                  {viewerWatermark.name}
                </div>
                <div className="mt-1 text-[11px] font-medium tracking-[0.18em] text-white/60">
                  {viewerWatermark.code} • {formatWatermarkTimestamp(watermarkTimestamp, isRTL ? 'ar' : 'en')}
                </div>
              </div>
            ))}
          </div>
        )}
        {!playerReady && !iframeLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="w-12 h-12 border-3 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/60 text-sm">{t('loading.video')}</p>
            </div>
          </div>
        )}
      </div>

      {playerError && (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          <p>{playerError}</p>
          <p className="mt-1 text-xs text-amber-600">Video ID: {vimeoVideoId}</p>
        </div>
      )}

      {playerReady && (
        <div className="mt-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${isPlaying ? 'bg-emerald-400 animate-pulse' : 'bg-gray-300'}`} />
            <span className="text-sm text-gray-500">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-cyan-500 rounded-full transition-all duration-300"
                style={{ width: `${watchedPercentage}%` }}
              />
            </div>
            <span className="text-sm font-medium text-gray-900">{watchedPercentage}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default VimeoPlayer;
