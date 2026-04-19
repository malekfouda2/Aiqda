import { useRef, useEffect, useState, useCallback } from 'react';
import Player from '@vimeo/player';
import { useLocale } from '../i18n/useLocale';

function VimeoPlayer({ vimeoVideoId, onProgressUpdate, initialProgress = 0 }) {
  const { t, isRTL } = useLocale();
  const containerRef = useRef(null);
  const playerRef = useRef(null);
  const watchedSegmentsRef = useRef(new Set());
  const lastSentProgressRef = useRef(initialProgress);
  const progressIntervalRef = useRef(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [watchedPercentage, setWatchedPercentage] = useState(initialProgress);
  const [playerError, setPlayerError] = useState(null);

  useEffect(() => {
    const initial = new Set();
    for (let i = 0; i < initialProgress; i++) initial.add(i);
    watchedSegmentsRef.current = initial;
    setWatchedPercentage(initialProgress);
    lastSentProgressRef.current = initialProgress;
  }, [initialProgress]);

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
    if (!containerRef.current || !vimeoVideoId) return;

    try {
      const player = new Player(containerRef.current, {
        id: parseInt(vimeoVideoId),
        width: '100%',
        responsive: true,
        autopause: true,
        dnt: true,
      });

      playerRef.current = player;

      player.ready().then(() => {
        setPlayerReady(true);
        player.getDuration().then(dur => setDuration(dur));
      }).catch(err => {
        setPlayerError(isRTL ? 'تعذر تحميل مشغل الفيديو. قد لا يكون الفيديو متاحًا.' : 'Failed to load video player. The video may not be available.');
        console.error('Vimeo player error:', err);
      });

      player.on('play', () => setIsPlaying(true));
      player.on('pause', () => setIsPlaying(false));
      player.on('ended', () => {
        setIsPlaying(false);
        const pct = calculateWatchedPercentage();
        sendProgress(pct);
      });

      player.on('timeupdate', (data) => {
        setCurrentTime(data.seconds);
        const segment = Math.floor(data.percent * 100);
        if (segment >= 0 && segment <= 100) {
          watchedSegmentsRef.current.add(segment);
        }
        const pct = calculateWatchedPercentage();
        setWatchedPercentage(pct);
      });

      player.on('error', (err) => {
        console.error('Vimeo player error event:', err);
        setPlayerError(isRTL ? 'حدث خطأ أثناء تشغيل الفيديو. يرجى المحاولة مرة أخرى.' : 'Video playback error. Please try again.');
      });

      progressIntervalRef.current = setInterval(() => {
        const pct = calculateWatchedPercentage();
        if (pct > lastSentProgressRef.current) {
          sendProgress(pct);
        }
      }, 15000);
    } catch (err) {
      setPlayerError(isRTL ? 'تعذر تهيئة مشغل الفيديو.' : 'Failed to initialize video player.');
      console.error('Player init error:', err);
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
      const pct = calculateWatchedPercentage();
      if (pct > lastSentProgressRef.current && onProgressUpdate) {
        onProgressUpdate(pct);
      }
      if (playerRef.current) {
        playerRef.current.destroy().catch(() => {});
        playerRef.current = null;
      }
    };
  }, [vimeoVideoId]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (playerError) {
    return (
      <div className="aspect-video bg-white rounded-xl flex items-center justify-center border border-gray-200">
        <div className="text-center px-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center border border-red-100">
            <span className="text-4xl">⚠️</span>
          </div>
          <p className="text-gray-500 mb-2">{playerError}</p>
          <p className="text-gray-400 text-sm">Video ID: {vimeoVideoId}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="aspect-video bg-gray-900 rounded-xl overflow-hidden border border-gray-200 relative">
        <div ref={containerRef} className="w-full h-full" />
        {!playerReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center">
              <div className="w-12 h-12 border-3 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-3" />
              <p className="text-white/60 text-sm">{t('loading.video')}</p>
            </div>
          </div>
        )}
      </div>

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
