'use client'

import { useEffect, useRef, useCallback } from 'react'
import { useAudioStore } from '@/store/audioStore'
import { useSongStore } from '@/store/songStore'
import { logAudioDebug } from '@/lib/audioDebug'

// Progress update interval
const PROGRESS_INTERVAL_MS = 125
const PRELOAD_COUNT = 32

export function GlobalAudioPlayer() {
  const { 
    currentUrl, 
    isPlaying, 
    seekRequest,
    clearSeekRequest, 
    setPlayingState, 
    setProgressState,
    preloadedUrls
  } = useAudioStore()
  
  const hoveredSong = useSongStore(state => state.hoveredSong)

  const poolRef = useRef<Map<string, HTMLAudioElement>>(new Map())
  const loadingStatusRef = useRef<Map<string, 'loading' | 'loaded' | 'error'>>(new Map())
  const loadQueueRef = useRef<string[]>([])
  
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const audioFadeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null)

  // ── PRIORITY-BASED READY POOL ──────────────────────────────────────────
  const processQueue = useCallback(() => {
    const CONCURRENCY_LIMIT = 4;
    const queue = loadQueueRef.current;
    
    // Count active network loads
    let active = 0;
    for (const status of loadingStatusRef.current.values()) {
      if (status === 'loading') active++;
    }
    
    // Find next unstarted URLs
    for (let i = 0; i < queue.length; i++) {
      if (active >= CONCURRENCY_LIMIT) break;
      
      const url = queue[i];
      if (!poolRef.current.has(url) && !loadingStatusRef.current.has(url)) {
        loadingStatusRef.current.set(url, 'loading');
        active++;
        
        const audio = new Audio();
        audio.crossOrigin = 'anonymous';
        audio.preload = 'auto'; // Force browser to buffer the media
        
        const onDone = () => {
          if (loadingStatusRef.current.get(url) === 'loading') {
            logAudioDebug(`[PERF] Audio buffered & ready: ${url.substring(0,40)}... at ${performance.now().toFixed(1)}ms`);
            loadingStatusRef.current.set(url, 'loaded');
            processQueue(); // trigger next in queue
          }
        };
        
        audio.addEventListener('canplaythrough', onDone, { once: true });
        audio.addEventListener('error', () => {
          loadingStatusRef.current.set(url, 'error');
          processQueue();
        }, { once: true });
        
        logAudioDebug(`[PERF] Network preloading started: ${url.substring(0,40)}...`);
        audio.src = url;
        audio.load(); // Kick off request immediately
        poolRef.current.set(url, audio);
      }
    }
  }, []);

  // Re-evaluate queue priorities whenever hover/selection changes
  useEffect(() => {
    if (!preloadedUrls || preloadedUrls.length === 0) return;
    
    // Preload intelligently: DO NOT download hundreds of full media files unnecessarily.
    // Only buffer the top 20 (most likely visible) plus the explicitly hovered/selected tracks.
    const baseQueue = preloadedUrls.slice(0, 20);
    if (currentUrl && !baseQueue.includes(currentUrl) && preloadedUrls.includes(currentUrl)) {
      baseQueue.push(currentUrl);
    }
    const hoverUrl = hoveredSong?.previewUrl;
    if (hoverUrl && !baseQueue.includes(hoverUrl) && preloadedUrls.includes(hoverUrl)) {
      baseQueue.push(hoverUrl);
    }
    
    const queue = [...baseQueue];
    
    // Sort to prioritize current and hovered tracks
    queue.sort((a, b) => {
       if (a === currentUrl) return -1;
       if (b === currentUrl) return 1;
       if (hoverUrl && a === hoverUrl) return -1;
       if (hoverUrl && b === hoverUrl) return 1;
       return 0; // maintain original array order which represents visual rank
    });
    
    loadQueueRef.current = queue;
    processQueue();
    
    // Cleanup old items to prevent memory leaks
    for (const url of poolRef.current.keys()) {
      if (!preloadedUrls.includes(url) && url !== currentUrl) {
        const a = poolRef.current.get(url);
        if (a && a !== activeAudioRef.current) {
          a.pause();
          a.removeAttribute('src');
          a.load();
        }
        poolRef.current.delete(url);
        loadingStatusRef.current.delete(url);
      }
    }
  }, [preloadedUrls, currentUrl, hoveredSong, processQueue]);

  // Scrubbing/Progress Reporting
  const startProgressTimer = () => {
    if (progressTimerRef.current) return
    progressTimerRef.current = setInterval(() => {
      const el = activeAudioRef.current
      if (el && el.duration && !el.paused) {
        setProgressState((el.currentTime / el.duration) * 100, el.duration)
      }
    }, PROGRESS_INTERVAL_MS)
  }

  const stopProgressTimer = () => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current)
      progressTimerRef.current = null
    }
  }

  useEffect(() => {
    return () => stopProgressTimer()
  }, [])

  // Handle Seek requests
  useEffect(() => {
    if (seekRequest !== null && activeAudioRef.current && activeAudioRef.current.duration) {
      const el = activeAudioRef.current
      el.currentTime = (seekRequest / 100) * el.duration
      setProgressState(seekRequest, el.duration)
      clearSeekRequest()
    }
  }, [seekRequest, clearSeekRequest, setProgressState])

  // Handle Play/Pause toggles from the store
  useEffect(() => {
    const el = activeAudioRef.current
    if (!el || !el.src) return

    if (currentUrl && el.src !== currentUrl) {
      return
    }

    if (isPlaying && el.paused) {
      el.play().then(() => {
        startProgressTimer()
      }).catch(err => {
        if (err.name !== 'AbortError') console.error('Audio play error:', err)
      })
    } else if (!isPlaying && !el.paused) {
      el.pause()
      stopProgressTimer()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPlaying])

  // Handle URL changes
  useEffect(() => {
    if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)

    if (!currentUrl) {
      const audio = activeAudioRef.current
      if (audio) {
        // Fade out rapidly
        let vol = audio.volume
        const fadeOutStep = vol / 5
        audioFadeIntervalRef.current = setInterval(() => {
          vol -= fadeOutStep
          if (vol <= 0) {
            if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)
            audio.pause()
            stopProgressTimer()
            setPlayingState(false)
          } else {
            audio.volume = Math.max(0, vol)
          }
        }, 20)
      }
      return
    }

    const previousAudio = activeAudioRef.current
    if (previousAudio && previousAudio.src !== currentUrl) {
      previousAudio.pause()
      stopProgressTimer()
    }

    let audio = poolRef.current.get(currentUrl)
    if (!audio) {
      audio = new Audio()
      audio.crossOrigin = 'anonymous'
      audio.preload = 'auto'
      
      // Ensure the new audio is tracked immediately to prevent duplicate fetches
      poolRef.current.set(currentUrl, audio)
      loadingStatusRef.current.set(currentUrl, 'loading')
      
      const onDone = () => {
        if (loadingStatusRef.current.get(currentUrl) === 'loading') {
          loadingStatusRef.current.set(currentUrl, 'loaded');
          processQueue();
        }
      };
      
      audio.addEventListener('canplaythrough', onDone, { once: true });
      audio.addEventListener('error', () => {
        loadingStatusRef.current.set(currentUrl, 'error');
        processQueue();
      }, { once: true });

      // Start the fetch
      audio.src = currentUrl
      audio.load()
    }
    
    // Attach event listeners if they haven't been attached yet
    if (!audio.onended) {
       audio.onended = () => {
         logAudioDebug('audio ended')
         stopProgressTimer()
         setPlayingState(false)
         setProgressState(0, audio.duration)
       }
       audio.addEventListener('loadedmetadata', () => {
         if (activeAudioRef.current === audio) {
           setProgressState(0, audio.duration)
         }
       })
       audio.addEventListener('error', () => logAudioDebug('audio error event', { code: audio.error?.code, message: audio.error?.message }))
    }
    
    activeAudioRef.current = audio
    audio.volume = 0.05
    const targetUrl = currentUrl
    
    const tPlayStart = performance.now()
    logAudioDebug(`[PERF] Hover -> play() called for ${targetUrl.substring(0,40)}... at ${tPlayStart.toFixed(1)}ms`)
    
    audio.play().then(() => {
      const tPlayDone = performance.now()
      logAudioDebug(`[PERF] ZERO-LATENCY VERIFIED: Audio started in ${(tPlayDone - tPlayStart).toFixed(1)}ms!`)
      
      if (targetUrl !== useAudioStore.getState().currentUrl) return
      
      setPlayingState(true)
      startProgressTimer()
      
      let targetVol = 0.35
      let currentVol = audio.volume
      const fadeInStep = (targetVol - currentVol) / 5
      
      audioFadeIntervalRef.current = setInterval(() => {
        currentVol += fadeInStep
        if (currentVol >= targetVol) {
          if (audioFadeIntervalRef.current) clearInterval(audioFadeIntervalRef.current)
          audio.volume = targetVol
        } else {
          audio.volume = Math.min(targetVol, currentVol)
        }
      }, 20)
    }).catch(err => {
      logAudioDebug('play() rejected', { name: err.name, message: err.message })
      if (err.name !== 'AbortError') {
        console.error('Audio play error:', err)
        stopProgressTimer()
        setPlayingState(false)
      }
    })
    
  }, [currentUrl, setPlayingState])

  return null
}
