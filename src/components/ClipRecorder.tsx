'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { Camera, Square, Upload, Download, X, Video, Check, AlertCircle } from 'lucide-react';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import type { LiveMatch } from '@/types';

type State = 'idle' | 'requesting' | 'previewing' | 'recording' | 'done' | 'uploading' | 'uploaded';

interface Props {
  match: LiveMatch;
  onUploaded?: (url: string) => void;
}

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function ClipRecorder({ match, onUploaded }: Props) {
  const [state,    setState]    = useState<State>('idle');
  const [error,    setError]    = useState('');
  const [progress, setProgress] = useState(0);
  const [elapsed,  setElapsed]  = useState(0);
  const [nativeMode, setNativeMode] = useState(false); // iOS fallback: native file input

  const videoRef    = useRef<HTMLVideoElement>(null);
  const streamRef   = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef   = useRef<Blob[]>([]);
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const blobRef     = useRef<Blob | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    stopStream();
    recorderRef.current?.stop();
    blobRef.current = null;
    setState('idle');
    setError('');
    setElapsed(0);
  }, [stopStream]);

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
  if (state === 'uploaded') {
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
            <button onClick={downloadClip}
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors">
              <Download size={12}/>
            </button>
            <button onClick={() => { blobRef.current = null; setState('idle'); }}
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
      <button onClick={openCamera}
        className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm font-medium text-slate-400 transition-colors">
        <Camera size={14}/> Record
      </button>
    );
  }

  // ── Camera modal (requesting / previewing / recording / done / uploading) ──
  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Score header */}
      <div className="flex items-center justify-between px-5 py-3 bg-black/80">
        <span className="text-sm font-bold text-emerald-400">{match.teamAName}</span>
        <div className="flex items-center gap-3">
          <span className="text-2xl font-black text-white tabular-nums">
            {match.games[match.currentGame]?.a ?? 0}
          </span>
          <span className="text-slate-500 text-sm">vs</span>
          <span className="text-2xl font-black text-white tabular-nums">
            {match.games[match.currentGame]?.b ?? 0}
          </span>
          {state === 'recording' && (
            <span className="text-[11px] font-mono text-red-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
              {fmt(elapsed)}
            </span>
          )}
        </div>
        <span className="text-sm font-bold text-blue-400">{match.teamBName}</span>
      </div>

      {/* Camera preview / done state */}
      <div className="flex-1 relative bg-black flex items-center justify-center">
        {(state === 'requesting' || state === 'previewing' || state === 'recording') && (
          <video ref={videoRef} className="w-full h-full object-cover" muted playsInline/>
        )}
        {state === 'requesting' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="text-slate-400 text-sm">Requesting camera…</p>
          </div>
        )}
        {state === 'done' && (
          <div className="flex flex-col items-center gap-4 px-6 text-center">
            <Check size={40} className="text-emerald-400"/>
            <p className="text-lg font-bold">Recording complete</p>
            <p className="text-slate-400 text-sm">{fmt(elapsed)} recorded</p>
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
          <div className="absolute bottom-4 inset-x-4 flex items-center gap-2 bg-red-950 border border-red-500/30 text-red-400 rounded-xl px-4 py-3 text-sm">
            <AlertCircle size={14}/> {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-6 py-6 bg-black/80">
        <button onClick={closeModal}
          className="w-12 h-12 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 flex items-center justify-center transition-colors">
          <X size={18}/>
        </button>

        {state === 'previewing' && (
          <button onClick={startRec}
            className="w-18 h-18 w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center">
            <span className="w-12 h-12 rounded-full bg-red-500"/>
          </button>
        )}
        {state === 'recording' && (
          <button onClick={stopRec}
            className="w-[72px] h-[72px] rounded-full border-4 border-white flex items-center justify-center">
            <Square size={24} fill="white" className="text-white"/>
          </button>
        )}
        {state === 'done' && (
          <div className="flex gap-4">
            <button onClick={uploadClip}
              className="flex items-center gap-2 px-5 py-3 bg-emerald-600 hover:bg-emerald-500 rounded-2xl font-semibold transition-colors">
              <Upload size={16}/> Upload (+50 Credits)
            </button>
            <button onClick={downloadClip}
              className="flex items-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-2xl font-semibold transition-colors">
              <Download size={16}/>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
