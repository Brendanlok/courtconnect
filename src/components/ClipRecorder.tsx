'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Square, Upload, Download, X, Video, Check, AlertCircle, RotateCcw, MapPin, Zap, ZapOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { LiveMatch, CourtPosition } from '@/types';
import { computeHomography, applyHomography, CALIBRATION_CORNER_ORDER, type PixelPoint, type Homography } from '@/lib/courtCalibration';
import { computeCoverCrop, toGrayscale, motionCentroid } from '@/lib/motionDetect';
import { detectShuttleHits } from '@/lib/shuttleDetect';

const CORNER_LABELS: Record<typeof CALIBRATION_CORNER_ORDER[number], string> = {
  nearLeft: 'near-left corner (closest to you, left side)',
  nearRight: 'near-right corner (closest to you, right side)',
  farRight: 'far-right corner (far end, right side)',
  farLeft: 'far-left corner (far end, left side)',
};

type State = 'idle' | 'instructions' | 'requesting' | 'previewing' | 'recording' | 'done' | 'uploading' | 'uploaded';

// Phase 2 auto-detect tuning. ponytail: fixed constants rather than a
// settings UI — revisit if real-world use shows they need to vary per device.
const DETECT_INTERVAL_MS = 1200; // ~1 sample/sec is plenty for a heatmap
const DETECT_CANVAS_W = 160;
const DETECT_CANVAS_H = 90;
const DETECT_SLOW_MS = 250; // one tick's processing budget within the interval
const DETECT_SLOW_TICKS_LIMIT = 3; // consecutive slow ticks before auto-falling-back to manual tap

interface Props {
  match: LiveMatch;
  onUploaded?: (url: string) => void;
  autoStart?: boolean;
  canScore?: boolean;
  onAddPoint?: (side: 'a' | 'b') => void;
  onUndo?: () => void;
  canUndo?: boolean;
  onRequestExit?: () => void;
  matchComplete?: boolean;
  onLogResult?: () => void;
  // Pose-tracking heatmap Phase 1: when set, tapping the live camera preview
  // (instead of a separate abstract court diagram) marks a court position,
  // via a one-time 4-corner calibration to correct for the camera's angle.
  courtTapMode?: boolean;
  onCourtTap?: (pos: CourtPosition) => void;
  courtTapCount?: number;
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const SETUP_TIPS = [
  { icon: '📱', title: 'Landscape, elevated', text: 'Turn your phone sideways and prop it up high — a tripod, chair, or shelf works — behind the baseline.' },
  { icon: '📏', title: 'Back up 3–4 metres', text: 'Stand it far enough back that both players and the full court fit in frame.' },
  { icon: '🎯', title: 'Keep it steady', text: 'Lean the phone against something solid rather than holding it — shaky footage is hard to review later.' },
  { icon: '🔋', title: 'Battery + storage', text: 'A full match can run 15–30+ minutes of video — check you have charge and space free.' },
];

type Readiness = 'checking' | 'ready' | 'warn';

// Wireframe guide the player lines the court up against on the live preview.
// Purely a visual placement aid — not burned into the recording. Shape matches
// what an elevated baseline camera actually sees: the court narrows into the
// distance (near baseline wide at the bottom, far end narrower near the top),
// with the net crossing horizontally partway up — not a bird's-eye layout.
function CourtGuideOverlay() {
  return (
    <svg viewBox="0 0 220 100" preserveAspectRatio="none" className="absolute inset-6 sm:inset-10 pointer-events-none">
      {/* Doubles sidelines — full court outline in perspective */}
      <polygon points="14,92 206,92 154,14 66,14" fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="1.5" strokeDasharray="7 5"/>
      {/* Singles sidelines */}
      <line x1="40" y1="92" x2="78" y2="14" stroke="white" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3"/>
      <line x1="180" y1="92" x2="142" y2="14" stroke="white" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="3 3"/>
      {/* Net — horizontal, partway up the frame */}
      <line x1="38.6" y1="55" x2="181.4" y2="55" stroke="#facc15" strokeOpacity="0.9" strokeWidth="1.5"/>
      <text x="110" y="50" textAnchor="middle" fill="#facc15" fontSize="7" fontFamily="sans-serif" fontWeight="bold">NET</text>
    </svg>
  );
}

export default function ClipRecorder({
  match, onUploaded, autoStart = false, canScore = false, onAddPoint,
  onUndo, canUndo = false, onRequestExit, matchComplete = false, onLogResult,
  courtTapMode = false, onCourtTap, courtTapCount = 0,
}: Props) {
  const [state,    setState]    = useState<State>('idle');
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [nativeMode, setNativeMode] = useState(false); // iOS fallback: native file input
  const [readiness, setReadiness]   = useState<Readiness>('checking');
  const [homography,   setHomography]   = useState<Homography | null>(null);
  const [calibCorners, setCalibCorners] = useState<PixelPoint[]>([]);
  const [calibLocked,  setCalibLocked]  = useState(false);
  const [lastTap,       setLastTap]     = useState<PixelPoint | null>(null);
  // Pose-tracking heatmap Phase 2: auto-detect play position via frame-diff
  // motion instead of requiring a manual tap every time. Off by default —
  // manual tap (Phase 1) always stays available as the fallback.
  const [autoDetect,    setAutoDetect]  = useState(false);
  const [autoSlowNotice, setAutoSlowNotice] = useState(false);
  // Shuttle-hit auto-detect: audio-based, runs once as a post-processing pass
  // after recording stops (see src/lib/shuttleDetect.ts for why audio + why
  // post-processing over live/video-based).
  const [shuttleHits, setShuttleHits] = useState<number[] | null>(null);
  const [detectingHits, setDetectingHits] = useState(false);

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef     = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detectCanvasRef = useRef<HTMLCanvasElement>(null);
  const prevGrayRef  = useRef<Uint8ClampedArray | null>(null);
  const slowTicksRef = useRef(0);

  // autoStart skips the small idle button and opens straight to setup instructions
  useEffect(() => {
    if (autoStart && state === 'idle') setState('instructions');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  // Cleanup stream on unmount
  useEffect(() => () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Fade the tap-feedback dot out shortly after each court tap.
  useEffect(() => {
    if (!lastTap) return;
    const t = setTimeout(() => setLastTap(null), 700);
    return () => clearTimeout(t);
  }, [lastTap]);

  // Readiness check — confirms the stream is actually live and the phone is
  // physically held in landscape before letting the user hit record. Not real
  // computer vision: it can't tell if the court is actually in frame, just that
  // the camera is set up sensibly (landscape, live track) before recording starts.
  // Landscape is read from the viewport (window dimensions), not the camera
  // track's getSettings() — the track's reported width/height is the sensor's
  // fixed capture format and does NOT change when the phone is rotated, so
  // checking it made "rotate to landscape" impossible to satisfy.
  useEffect(() => {
    if (state !== 'previewing') return;
    const check = () => {
      const track = streamRef.current?.getVideoTracks()[0];
      const live = track?.readyState === 'live';
      const landscape = window.innerWidth >= window.innerHeight;
      setReadiness(live && landscape ? 'ready' : 'warn');
    };
    const t = setTimeout(check, 1100);
    window.addEventListener('resize', check);
    window.addEventListener('orientationchange', check);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', check);
      window.removeEventListener('orientationchange', check);
    };
  }, [state]);

  const openCamera = useCallback(async () => {
    // Check if MediaRecorder is available; if not, fall back to native file input (iOS Safari)
    if (typeof MediaRecorder === 'undefined') {
      setNativeMode(true);
      return;
    }
    setState('requesting');
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState('previewing');
      setReadiness('checking');
      setHomography(null);
      setCalibCorners([]);
      setCalibLocked(false);
      setAutoDetect(false);
      setAutoSlowNotice(false);
      prevGrayRef.current = null;
      setShuttleHits(null);
      setDetectingHits(false);
    } catch {
      // Permission denied or no camera → native file input
      setNativeMode(true);
      setState('idle');
    }
  }, []);

  const startRec = useCallback(() => {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mime = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4']
      .find(t => MediaRecorder.isTypeSupported(t)) ?? '';
    const rec = new MediaRecorder(streamRef.current, mime ? { mimeType: mime } : {});
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    rec.onstop = () => {
      blobRef.current = new Blob(chunksRef.current, { type: rec.mimeType || 'video/webm' });
      stopStream();
      setState('done');
    };
    rec.start(1000);
    recorderRef.current = rec;
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    setState('recording');
  }, [stopStream]);

  const stopRec = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
  }, []);

  // Tapping the live preview: first 4 taps calibrate (map this camera's
  // perspective onto the court), every tap after that reports a position.
  // Coordinates are stored as a fraction of the video's rendered box, same
  // convention CourtHeatmap.tsx uses — self-consistent regardless of the
  // video's actual pixel resolution or any object-cover cropping.
  const handleCourtTap = useCallback((e: React.MouseEvent<HTMLVideoElement>) => {
    if (!courtTapMode) return;
    // Once 4 corners are placed, taps land on the draft quad to fine-tune it
    // (see dragCorner below) — clicks on blank video do nothing until confirmed.
    if (homography && !calibLocked) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pt: PixelPoint = [(e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height];

    if (!homography) {
      const next = [...calibCorners, pt];
      setCalibCorners(next);
      if (next.length < 4) return;
      try {
        setHomography(computeHomography(next));
      } catch {
        // degenerate corners (e.g. two taps on the same spot) — restart calibration
        setCalibCorners([]);
      }
      return;
    }

    const pos = applyHomography(homography, pt);
    onCourtTap?.({ x: Math.max(0, Math.min(1, pos.x)), y: Math.max(0, Math.min(1, pos.y)) });
    setLastTap(pt);
  }, [courtTapMode, homography, calibLocked, calibCorners, onCourtTap]);

  const recalibrate = useCallback(() => {
    setHomography(null);
    setCalibCorners([]);
    setCalibLocked(false);
    setAutoDetect(false);
    setAutoSlowNotice(false);
    prevGrayRef.current = null;
  }, []);

  // Phase 2: one frame-diff sample. Draws the video's currently-visible
  // (object-cover-cropped) region onto a small offscreen canvas, diffs it
  // against the previous sample, and reports the motion centroid the same
  // way a manual tap would. Self-throttles: if it can't keep up with
  // DETECT_INTERVAL_MS on this device for a few ticks running, it turns
  // itself off rather than staying on and janking the recording.
  const detectTick = useCallback(() => {
    const video = videoRef.current;
    const canvas = detectCanvasRef.current;
    if (!video || !canvas || !homography) return;
    const rect = video.getBoundingClientRect();
    if (!rect.width || !rect.height || !video.videoWidth || !video.videoHeight) return;

    const t0 = performance.now();
    const { sx, sy, sw, sh } = computeCoverCrop(video.videoWidth, video.videoHeight, rect.width, rect.height);
    canvas.width = DETECT_CANVAS_W;
    canvas.height = DETECT_CANVAS_H;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, DETECT_CANVAS_W, DETECT_CANVAS_H);
    const gray = toGrayscale(ctx.getImageData(0, 0, DETECT_CANVAS_W, DETECT_CANVAS_H).data, DETECT_CANVAS_W, DETECT_CANVAS_H);

    const prev = prevGrayRef.current;
    prevGrayRef.current = gray;
    if (prev) {
      const centroid = motionCentroid(prev, gray, DETECT_CANVAS_W, DETECT_CANVAS_H);
      if (centroid) {
        const pos = applyHomography(homography, [centroid.x, centroid.y]);
        onCourtTap?.({ x: Math.max(0, Math.min(1, pos.x)), y: Math.max(0, Math.min(1, pos.y)) });
        setLastTap([centroid.x, centroid.y]);
      }
    }

    const dt = performance.now() - t0;
    slowTicksRef.current = dt > DETECT_SLOW_MS ? slowTicksRef.current + 1 : 0;
    if (slowTicksRef.current >= DETECT_SLOW_TICKS_LIMIT) {
      slowTicksRef.current = 0;
      setAutoDetect(false);
      setAutoSlowNotice(true);
    }
  }, [homography, onCourtTap]);

  useEffect(() => {
    if (!autoDetect || !homography || !calibLocked) return;
    if (state !== 'previewing' && state !== 'recording') return;
    prevGrayRef.current = null; // fresh baseline each time detection (re)starts
    const id = setInterval(detectTick, DETECT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [autoDetect, homography, calibLocked, state, detectTick]);

  // Once a clip is done recording (camera or native file-input path), scan its
  // audio track once for shuttle hits. Runs regardless of onCourtTap/courtTapMode
  // — this is an independent review aid, not tied to position tracking.
  useEffect(() => {
    if (state !== 'done' || shuttleHits !== null || !blobRef.current) return;
    setDetectingHits(true);
    detectShuttleHits(blobRef.current).then(hits => {
      setShuttleHits(hits);
      setDetectingHits(false);
    });
  }, [state, shuttleHits]);

  const confirmCalibration = useCallback(() => setCalibLocked(true), []);

  // Dragging a draft corner handle recomputes the homography live so the user
  // can fine-tune a rough tap before locking it in — same math, just re-run
  // per corner move instead of once.
  const dragCorner = useCallback((idx: number) => (e: React.PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation();
    const videoEl = videoRef.current;
    if (!videoEl) return;
    const move = (ev: PointerEvent) => {
      const rect = videoEl.getBoundingClientRect();
      const pt: PixelPoint = [
        Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)),
        Math.max(0, Math.min(1, (ev.clientY - rect.top) / rect.height)),
      ];
      setCalibCorners(prev => {
        const next = [...prev];
        next[idx] = pt;
        try { setHomography(computeHomography(next)); } catch { /* keep last valid homography */ }
        return next;
      });
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }, []);

  const closeModal = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.onstop = null;
      recorderRef.current.stop();
    }
    recorderRef.current = null;
    stopStream();
    blobRef.current = null;
    setState('idle');
    setError('');
    setElapsed(0);
  }, [stopStream]);

  const requestExit = useCallback(() => {
    if (onRequestExit) onRequestExit();
    else closeModal();
  }, [onRequestExit, closeModal]);

  const uploadClip = useCallback(async () => {
    const blob = blobRef.current;
    if (!blob) return;
    setState('uploading');
    setProgress(0);
    setError('');
    try {
      const ext  = blob.type.includes('mp4') ? 'mp4' : 'webm';
      const path = `${match.id}/recording.${ext}`;
      // ponytail: supabase-js storage upload has no progress events (unlike
      // Firebase's uploadBytesResumable) — jump straight to 100 on success
      // instead of faking intermediate ticks.
      const { error } = await supabase.storage.from('clips').upload(path, blob, { contentType: blob.type, upsert: true });
      if (error) throw error;
      setProgress(100);
      // clips bucket is private (real match footage, not for anonymous public
      // access) — sign the URL instead of getPublicUrl, which only works on
      // public buckets. ponytail: 10-year expiry stored as a static URL rather
      // than re-signing on every view; fine unless the storage signing key
      // rotates, upgrade to sign-on-view if that ever becomes an issue.
      const { data, error: signErr } = await supabase.storage.from('clips').createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (signErr || !data) throw signErr ?? new Error('No signed URL returned');
      const url = data.signedUrl;
      blobRef.current = null;
      setState('uploaded');
      onUploaded?.(url);
    } catch {
      setError('Upload failed. Check your internet connection.');
      setState('done');
    }
  }, [match.id, onUploaded]);

  const downloadClip = useCallback(() => {
    const blob = blobRef.current;
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `match-${match.id}.webm`;
    a.click();
    URL.revokeObjectURL(url);
  }, [match.id]);

  const handleFileSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    blobRef.current = file;
    setShuttleHits(null);
    setState('done');
  }, []);

  // ── Uploaded confirmation chip ──
  if (state === 'uploaded' && !matchComplete) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 border border-emerald-500/25 rounded-xl text-xs font-semibold text-emerald-400">
        <Check size={12}/> Clip saved · +50 Credits
      </div>
    );
  }

  // ── Native file input mode (iOS / no getUserMedia) ──
  if (nativeMode) {
    return (
      <div className="flex items-center gap-2">
        <input ref={fileInputRef} type="file" accept="video/*" capture="environment"
          className="hidden" onChange={handleFileSelected}/>
        {state === 'done' ? (
          <>
            <button onClick={uploadClip}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-semibold transition-colors">
              <Upload size={12}/> Upload (+50)
            </button>
            <button onClick={downloadClip} aria-label="Download clip"
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors">
              <Download size={12}/>
            </button>
            <button onClick={() => { blobRef.current = null; setState('idle'); }} aria-label="Discard clip"
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors">
              <X size={12}/>
            </button>
          </>
        ) : state === 'uploading' ? (
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-slate-400">
            <Upload size={12} className="animate-pulse"/> {progress}%
          </div>
        ) : (
          <button onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-xs font-medium text-slate-400 transition-colors">
            <Video size={13}/> Record
          </button>
        )}
      </div>
    );
  }

  // ── Idle ──
  if (state === 'idle') {
    return (
      <button onClick={() => setState('instructions')}
        className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-400 transition-colors">
        <Camera size={14}/> Record
      </button>
    );
  }

  // ── Setup instructions ──
  if (state === 'instructions') {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 shrink-0">
          <p className="font-bold text-white">Set up your camera</p>
          <button onClick={requestExit} aria-label="Close" className="text-slate-400 hover:text-white p-1"><X size={18}/></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-6 space-y-4">
          <p className="text-sm text-slate-300">A few tips so the footage is actually usable:</p>
          {SETUP_TIPS.map(tip => (
            <div key={tip.title} className="flex items-start gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
              <span className="text-xl shrink-0">{tip.icon}</span>
              <div>
                <p className="text-sm font-semibold text-white">{tip.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{tip.text}</p>
              </div>
            </div>
          ))}
          {canScore && (
            <p className="text-[11px] text-slate-500 text-center pt-1">Once recording, tap either score in the header to add a point.</p>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-800 shrink-0">
          <button onClick={openCamera}
            className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-bold text-sm transition-colors">
            I&apos;m set up — Start Camera
          </button>
        </div>
      </div>
    );
  }

  // ── Camera modal (requesting / previewing / recording / done / uploading) ──
  // Screen is split 1/3 score (top) / 2/3 court + controls (bottom) — controls
  // overlay the bottom of the court area instead of taking their own strip.
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Score section — 1/3 of screen, each side is one big tap target */}
      <div className="flex-[1] min-h-0 flex flex-col bg-black/80">
        <div className="flex-1 min-h-0 flex items-stretch relative">
          <button disabled={!canScore || matchComplete} onClick={() => onAddPoint?.('a')}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 m-1.5 rounded-2xl transition-all
              ${canScore && !matchComplete ? 'active:scale-[0.97] active:bg-emerald-500/15' : ''}`}>
            <span className="text-xs font-bold text-emerald-400 truncate max-w-[90%]">{match.teamAName}</span>
            <span className="text-6xl sm:text-7xl font-black text-white tabular-nums leading-none">
              {match.games[match.currentGame]?.a ?? 0}
            </span>
          </button>

          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 bg-slate-800/90 border border-slate-700 rounded-full px-2 py-0.5 pointer-events-none">
            vs
          </div>

          <button disabled={!canScore || matchComplete} onClick={() => onAddPoint?.('b')}
            className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-0.5 m-1.5 rounded-2xl transition-all
              ${canScore && !matchComplete ? 'active:scale-[0.97] active:bg-blue-500/15' : ''}`}>
            <span className="text-xs font-bold text-blue-400 truncate max-w-[90%]">{match.teamBName}</span>
            <span className="text-6xl sm:text-7xl font-black text-white tabular-nums leading-none">
              {match.games[match.currentGame]?.b ?? 0}
            </span>
          </button>
        </div>

        <div className="flex items-center justify-center gap-2 pb-1.5 shrink-0">
          {state === 'recording' && (
            <span className="text-[11px] font-mono text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
              {fmt(elapsed)}
            </span>
          )}
          {canScore && !matchComplete && (
            <p className="text-center text-[10px] text-slate-500">Tap a score to add a point</p>
          )}
        </div>
      </div>

      {/* Court / camera area — 2/3 of screen, controls overlaid at the bottom */}
      <div className="flex-[2] min-h-0 relative bg-black flex items-center justify-center">
        {(state === 'requesting' || state === 'previewing' || state === 'recording') && (
          <video ref={videoRef} className={`w-full h-full object-cover ${courtTapMode ? 'cursor-crosshair' : ''}`}
            muted playsInline onClick={handleCourtTap}/>
        )}
        {courtTapMode && (state === 'previewing' || state === 'recording') && (
          <>
            {!homography ? (
              <div className={`absolute inset-x-3 flex justify-center pointer-events-none ${state === 'previewing' ? 'top-14' : 'top-3'}`}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-500/90 text-white text-center">
                  <MapPin size={11}/> Tap the {CORNER_LABELS[CALIBRATION_CORNER_ORDER[calibCorners.length]]} · {calibCorners.length}/4
                </div>
              </div>
            ) : !calibLocked ? (
              <div className={`absolute inset-x-3 flex justify-center gap-1.5 ${state === 'previewing' ? 'top-14' : 'top-3'}`}>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold bg-amber-500/90 text-black text-center">
                  Drag corners to fine-tune
                </div>
                <button onClick={confirmCalibration}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-emerald-500/90 text-white">
                  Confirm
                </button>
                <button onClick={recalibrate}
                  className="px-3 py-1.5 rounded-full text-[11px] font-semibold bg-black/50 text-slate-300">
                  Restart
                </button>
              </div>
            ) : (
              <div className="absolute top-3 right-3 flex flex-col items-end gap-1.5">
                <div className="flex items-center gap-1.5">
                  <div className="bg-black/50 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {courtTapCount} pts
                  </div>
                  <button onClick={() => { setAutoDetect(a => !a); setAutoSlowNotice(false); }}
                    className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors
                      ${autoDetect ? 'bg-emerald-500/90 text-white' : 'bg-black/50 hover:bg-black/70 text-slate-300'}`}>
                    {autoDetect ? <Zap size={10}/> : <ZapOff size={10}/>} Auto-detect {autoDetect ? 'on' : 'off'}
                  </button>
                  <button onClick={recalibrate}
                    className="bg-black/50 hover:bg-black/70 text-slate-300 text-[10px] font-semibold px-2 py-0.5 rounded-full transition-colors">
                    Recalibrate
                  </button>
                </div>
                {autoSlowNotice && (
                  <div className="bg-amber-500/90 text-black text-[10px] font-semibold px-2 py-1 rounded-lg max-w-[200px] text-right leading-snug">
                    Auto-detect is slow on this device — switched back to manual tap.
                  </div>
                )}
              </div>
            )}
            <canvas ref={detectCanvasRef} className="hidden" aria-hidden/>
            {homography && calibLocked && (
              <svg className="absolute inset-0 w-full h-full pointer-events-none">
                <polygon points={calibCorners.map(([x, y]) => `${x * 100}%,${y * 100}%`).join(' ')}
                  fill="none" stroke="#34d399" strokeOpacity="0.6" strokeWidth="1.5" strokeDasharray="5 4"/>
              </svg>
            )}
            {calibCorners.map(([x, y], i) => (
              <span key={i} onPointerDown={!calibLocked && homography ? dragCorner(i) : undefined}
                className={`absolute rounded-full bg-emerald-400 border border-white/80 -translate-x-1/2 -translate-y-1/2
                  ${!calibLocked && homography ? 'w-5 h-5 cursor-grab active:cursor-grabbing touch-none' : 'w-2.5 h-2.5 pointer-events-none'}`}
                style={{ left: `${x * 100}%`, top: `${y * 100}%` }}/>
            ))}
            {lastTap && (
              <span className="absolute w-4 h-4 rounded-full bg-emerald-400/70 border border-white -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: `${lastTap[0] * 100}%`, top: `${lastTap[1] * 100}%` }}/>
            )}
          </>
        )}
        {state === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Requesting camera…</p>
          </div>
        )}
        {state === 'previewing' && (
          <>
            <CourtGuideOverlay/>
            <p className="absolute bottom-3 inset-x-3 text-center text-[11px] text-white/80 bg-black/40 rounded-full py-1 pointer-events-none">
              Fit both baselines and the net inside the dashed guide
            </p>
            <div className="absolute top-3 inset-x-3 flex justify-center pointer-events-none">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold
                ${readiness === 'checking' ? 'bg-slate-800/90 text-slate-300'
                : readiness === 'ready' ? 'bg-emerald-500/90 text-white'
                : 'bg-amber-500/90 text-black'}`}>
                {readiness === 'checking' && <>⏳ Checking camera…</>}
                {readiness === 'ready' && <>✓ Looks good — you&apos;re set to record</>}
                {readiness === 'warn' && <>⚠ Rotate to landscape (check auto-rotate is on in quick settings)</>}
              </div>
            </div>
          </>
        )}
        {(state === 'done' || state === 'uploaded') && (
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <Check size={40} className="text-emerald-400"/>
            <p className="text-lg font-bold">{state === 'uploaded' ? 'Clip saved · +50 Credits' : 'Recording complete'}</p>
            <p className="text-slate-400 text-sm">{fmt(elapsed)} recorded</p>
            {matchComplete && (
              <p className="text-slate-500 text-xs">Match finished — log the result below when ready.</p>
            )}
            {detectingHits && (
              <p className="text-slate-500 text-xs">Scanning audio for shuttle hits…</p>
            )}
            {!detectingHits && shuttleHits && shuttleHits.length > 0 && (
              <div className="w-full max-w-xs">
                <p className="text-slate-500 text-xs mb-1.5">{shuttleHits.length} shuttle hit{shuttleHits.length === 1 ? '' : 's'} detected</p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {shuttleHits.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded-full text-[11px] font-mono text-slate-300">
                      {fmt(Math.round(t))}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {state === 'uploading' && (
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <Upload size={32} className="text-emerald-400 animate-pulse"/>
            <p className="text-lg font-bold">Uploading…</p>
            <div className="w-48 h-2 bg-slate-800 rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${progress}%` }}/>
            </div>
            <p className="text-slate-400 text-sm">{progress}%</p>
          </div>
        )}
        {error && (
          <div className="absolute bottom-24 inset-x-4 flex items-center gap-2 bg-red-950 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle size={14}/> {error}
          </div>
        )}

        {/* Controls — overlaid on the bottom of the court area */}
        <div className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-4 py-5 bg-gradient-to-t from-black/90 via-black/70 to-transparent flex-wrap px-4">
          <button onClick={requestExit} aria-label="Close"
            className="w-12 h-12 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors shrink-0">
            <X size={18}/>
          </button>

          {canUndo && onUndo && (state === 'previewing' || state === 'recording') && (
            <button onClick={onUndo} aria-label="Undo last point"
              className="w-12 h-12 rounded-full bg-slate-800/90 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors shrink-0" title="Undo last point">
              <RotateCcw size={16}/>
            </button>
          )}

          {state === 'previewing' && (
            <button onClick={startRec} disabled={readiness === 'checking'} aria-label="Start recording"
              className={`w-[72px] h-[72px] rounded-full border-4 flex items-center justify-center shrink-0 transition-opacity
                ${readiness === 'checking' ? 'border-slate-600 opacity-40 cursor-not-allowed' : 'border-white'}`}>
              <span className="w-12 h-12 rounded-full bg-red-500"/>
            </button>
          )}
          {state === 'recording' && (
            <button onClick={stopRec} aria-label="Stop recording"
              className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center shrink-0">
              <Square size={24} fill="white" className="text-white"/>
            </button>
          )}
          {state === 'done' && (
            <div className="flex gap-3 flex-wrap justify-center">
              <button onClick={uploadClip}
                className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold transition-colors">
                <Upload size={16}/> Upload (+50 Credits)
              </button>
              <button onClick={downloadClip} aria-label="Download clip"
                className="flex items-center gap-2 px-4 py-3 bg-slate-800/90 hover:bg-slate-700 border border-slate-700 rounded-2xl font-semibold transition-colors">
                <Download size={16}/>
              </button>
            </div>
          )}

          {matchComplete && onLogResult && (state === 'done' || state === 'uploaded') && (
            <button onClick={onLogResult}
              className="flex items-center gap-2 px-5 py-3 bg-amber-500 hover:bg-amber-400 text-black rounded-2xl font-bold transition-colors">
              <Check size={16}/> Log Result
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
