import { useRef, useEffect, useState, useCallback } from 'react';
import Player from '@vimeo/player';
import { useLocale } from '../i18n/useLocale';

const PROGRESS_SYNC_INTERVAL_MS = 5000;

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
  return url.toString();
}

function VimeoPlayer({ vimeoVideoId, embedUrl, onProgressUpdate, initialProgress = 0 }) {
  const { t, isRTL } = useLocale();
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

  useEffect(() => {
    const initial = new Set();
    for (let i = 0; i < initialProgress; i++) initial.add(i);
    watchedSegmentsRef.current = initial;
    setWatchedPercentage(initialProgress);
    lastSentProgressRef.current = initialProgress;
  }, [initialProgress]);

  const activeEmbedUrl = embedUrl || buildFallbackEmbedUrl(vimeoVideoId);

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
      iframe.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share');
      iframe.setAttribute('allowfullscreen', '');
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

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div>
      <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-200 relative">
        <div ref={containerRef} className="w-full h-full" />
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
