'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Square, Upload, Download, X, Video, Check, AlertCircle, RotateCcw } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import type { LiveMatch } from '@/types';

type State = 'idle' | 'instructions' | 'requesting' | 'previewing' | 'recording' | 'done' | 'uploading' | 'uploaded';

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
}: Props) {
  const [state,    setState]    = useState<State>('idle');
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [nativeMode, setNativeMode] = useState(false); // iOS fallback: native file input
  const [readiness, setReadiness]   = useState<Readiness>('checking');

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef     = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      const path = `clips/${match.id}/recording.${ext}`;
      const task = uploadBytesResumable(ref(storage, path), blob, { contentType: blob.type });
      task.on('state_changed', snap => {
        setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100));
      });
      await task;
      const url = await getDownloadURL(ref(storage, path));
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
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline/>
        )}
        {state === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Requesting camera…</p>
          </div>
        )}
        {state === 'previewing' && (
          <>
            <CourtGuideOverlay/>
            <p className="absolute bottom-3 inset-x-3 text-center text-[11px] text-white/80 bg-black/40 rounded-full py-1">
              Fit both baselines and the net inside the dashed guide
            </p>
            <div className="absolute top-3 inset-x-3 flex justify-center">
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-semibold
                ${readiness === 'checking' ? 'bg-slate-800/90 text-slate-300'
                : readiness === 'ready' ? 'bg-emerald-500/90 text-white'
                : 'bg-amber-500/90 text-black'}`}>
                {readiness === 'checking' && <>⏳ Checking camera…</>}
                {readiness === 'ready' && <>✓ Looks good — you&apos;re set to record</>}
                {readiness === 'warn' && <>⚠ Rotate to landscape for full court coverage</>}
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
