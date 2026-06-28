'use client';
import { useApp } from '@/context/AppContext';
import { TIER_STYLE } from '@/lib/utils';
import { X, Share2 } from 'lucide-react';

export function QRModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useApp();
  if (!open) return null;
  const s = TIER_STYLE[user.tier];

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-7 w-full max-w-sm text-center shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-bold text-lg">My QR Code</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
        </div>

        <div className="w-52 h-52 mx-auto bg-white rounded-2xl flex items-center justify-center mb-5 shadow-lg">
          <svg width="190" height="190" viewBox="0 0 190 190">
            <rect width="190" height="190" fill="white"/>
            <rect x="10" y="10" width="50" height="50" rx="5" fill="#111"/>
            <rect x="16" y="16" width="38" height="38" rx="3" fill="white"/>
            <rect x="22" y="22" width="26" height="26" rx="2" fill="#111"/>
            <rect x="130" y="10" width="50" height="50" rx="5" fill="#111"/>
            <rect x="136" y="16" width="38" height="38" rx="3" fill="white"/>
            <rect x="142" y="22" width="26" height="26" rx="2" fill="#111"/>
            <rect x="10" y="130" width="50" height="50" rx="5" fill="#111"/>
            <rect x="16" y="136" width="38" height="38" rx="3" fill="white"/>
            <rect x="22" y="142" width="26" height="26" rx="2" fill="#111"/>
            {[[72,10],[84,10],[96,10],[72,22],[96,22],[84,34],[72,46],
              [10,72],[22,72],[10,84],[34,84],[22,96],[10,108],
              [72,72],[84,72],[96,72],[108,72],[120,72],[72,84],[108,84],
              [72,96],[84,96],[120,96],[72,108],[96,108],[108,108],
              [130,72],[142,72],[154,72],[166,72],[130,84],[166,84],
              [130,96],[142,96],[154,96],[130,108],[154,108],[166,108],
              [130,130],[154,130],[166,130],[130,142],[142,142],[166,142],
              [130,154],[142,154],[154,154],[130,166],[154,166],[166,166],
              [72,130],[96,130],[108,130],[72,142],[84,142],[108,142],
              [72,154],[84,154],[96,154],[108,166]
            ].map(([x,y],i) => (
              <rect key={i} x={x} y={y} width="8" height="8" rx="1.5" fill="#111" opacity={i%5===0?0.4:1}/>
            ))}
            <circle cx="95" cy="95" r="18" fill="#059669"/>
            <text x="95" y="100" textAnchor="middle" fill="white" fontSize="18">🏸</text>
          </svg>
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
