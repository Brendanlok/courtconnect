'use client';
import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { BASE_PATH } from '@/lib/utils';
import { countReferrals } from '@/lib/supabaseService';
import { auth } from '@/lib/supabase';
import { X, UserPlus, Share2, Check } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';
import { Button } from '@/components/ui/Button';

export function InviteModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useApp();
  const { ref: panelRef, dialogProps } = useModalA11y(open, onClose, 'Invite Friends');
  const [copied, setCopied] = useState(false);
  const [count, setCount] = useState<number | null>(null);

  const baseUrl = typeof window !== 'undefined' ? `${window.location.origin}${BASE_PATH}` : 'https://brendanlok.github.io/courtconnect';
  const inviteLink = `${baseUrl}/?ref=${user.username}`;

  useEffect(() => {
    if (!open) return;
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    countReferrals(uid).then(setCount).catch(() => {});
  }, [open]);

  if (!open) return null;

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on CourtConnect', text: `Play badminton, track MMR, and find matches — join me on CourtConnect!`, url: inviteLink });
        return;
      } catch { /* user cancelled or not supported */ }
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl p-7 w-full max-w-sm text-center shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg flex items-center gap-2"><UserPlus size={18} className="text-emerald-400"/> Invite Friends</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <p className="text-sm text-slate-400">Share your link — anyone who signs up through it gets connected to you from day one.</p>

        <div className="mt-4 px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-xs font-mono text-slate-300 truncate">
          {inviteLink}
        </div>

        {count !== null && count > 0 && (
          <p className="text-xs text-emerald-400 font-semibold mt-3">
            🎉 {count} friend{count === 1 ? '' : 's'} joined via your invite
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <Button onClick={handleShare} className="flex-1">
            {copied ? <><Check size={15}/> Copied!</> : <><Share2 size={15}/> Share Link</>}
          </Button>
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
