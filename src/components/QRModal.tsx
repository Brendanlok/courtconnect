'use client';
import { useApp } from '@/context/AppContext';
import { TIER_STYLE, BASE_PATH } from '@/lib/utils';
import { X, Share2, Copy, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';
import { ME, PLAYERS } from '@/lib/data';
import { auth } from '@/lib/firebase';

export function QRModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useApp();
  if (!open) return null;
  const s = TIER_STYLE[user.tier];

  // Encode as a profile URL so any QR scanner opens the profile directly.
  // /players/[username]/ only pre-renders the demo roster (static export) —
  // a real account's own username 404s there, so point real users at
  // /profile/?uid=X instead, which works for any signed-in account.
  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${BASE_PATH}` : 'https://brendanlok.github.io/courtconnect';
  const isDemoUsername = [ME, ...PLAYERS].some(p => p.username === user.username);
  const realUid = auth.currentUser?.uid;
  const qrPayload = isDemoUsername || !realUid
    ? `${baseUrl}/players/${user.username}/`
    : `${baseUrl}/profile/?uid=${realUid}`;

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
  const [copied, setCopied] = useState(false);
  const { ref: panelRef, dialogProps } = useModalA11y(true, onClose, 'My QR Code');

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCode.toCanvas(canvasRef.current, qrPayload, {
      width: 200,
      margin: 2,
      color: { dark: '#111827', light: '#ffffff' },
    }).catch(() => {});
  }, [qrPayload]);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${user.displayName} on CourtConnect`, url: qrPayload });
        return;
      } catch { /* user cancelled or not supported */ }
    }
    // Fallback: copy to clipboard
    try {
      await navigator.clipboard.writeText(qrPayload);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl p-7 w-full max-w-sm text-center shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">My QR Code</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
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
          <Button onClick={handleShare} className="flex-1">
            {copied ? <><Check size={15}/> Copied!</> : <><Share2 size={15}/> Share</>}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
        <p className="text-slate-500 text-xs mt-4">Scan to open this profile · Tap Share to copy link</p>
      </div>
    </div>
  );
}
