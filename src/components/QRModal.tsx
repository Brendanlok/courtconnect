'use client';
import { useApp } from '@/context/AppContext';
import { TIER_STYLE } from '@/lib/utils';
import { X, Share2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

export function QRModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  if (!open) return null;
  const s = TIER_STYLE[user.tier];

  // Encode uid + username + displayName as a compact JSON string
  const qrPayload = JSON.stringify({ uid: user.uid, username: user.username, displayName: user.displayName });

  return (
    <QRModalInner user={user} s={s} qrPayload={qrPayload} onClose={onClose}/>
  );
}

function QRModalInner({ user, s, qrPayload, onClose }: {
  user: { displayName: string; username: string; tier: string; mmr: number; globalRank: number; area: string; state: string };
  s: { bg: string; text: string; border: string; icon: string };
  qrPayload: string;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrPayload, {
      width: 200,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    }).catch(() => {});
  }, [qrPayload]);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-7 w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">My QR Code</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="w-52 h-52 mx-auto bg-white rounded-2xl flex items-center justify-center mb-5 shadow-lg overflow-hidden">
          <canvas ref={canvasRef} style={{ borderRadius: 12 }}/>
        </div>

        <p className="font-bold text-xl">{user.displayName}</p>
        <p className="text-slate-400 text-sm">@{user.username}</p>
        <span className={`inline-flex items-center gap-1 mt-2 px-3 py-1 rounded-full text-xs font-bold border ${s.bg} ${s.text} ${s.border}`}>
          {s.icon} {user.tier} · {user.mmr.toLocaleString()} MMR
        </span>
        <p className="text-slate-500 text-xs mt-1">#{user.globalRank} National · {user.area}, {user.state}</p>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-semibold text-sm transition-colors">
            <Share2 size={15}/> Share
          </button>
          <button onClick={onClose} className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl font-semibold text-sm transition-colors">
            Close
          </button>
        </div>
        <p className="text-slate-500 text-xs mt-4">💡 Opponent scans this to auto-fill match details</p>
      </div>
    </div>
  );
}
