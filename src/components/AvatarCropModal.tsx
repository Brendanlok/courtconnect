'use client';
import { useEffect, useRef, useState } from 'react';
import { X, Check } from 'lucide-react';
import { useModalA11y } from '@/hooks/useModalA11y';

const FRAME = 260;
const OUTPUT = 512;

export function AvatarCropModal({ file, onCancel, onConfirm }: {
  file: File;
  onCancel: () => void;
  onConfirm: (blob: Blob) => void;
}) {
  const [src] = useState(() => URL.createObjectURL(file));
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const { ref: panelRef, dialogProps } = useModalA11y(true, onCancel, 'Crop Photo');

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  const baseScale = natural ? FRAME / Math.min(natural.w, natural.h) : 1;
  const scale = baseScale * zoom;
  const dispW = (natural?.w ?? 0) * scale;
  const dispH = (natural?.h ?? 0) * scale;

  const clamp = (x: number, y: number) => ({
    x: Math.min(0, Math.max(FRAME - dispW, x)),
    y: Math.min(0, Math.max(FRAME - dispH, y)),
  });

  const onImgLoad = () => {
    const img = imgRef.current;
    if (!img) return;
    const w = img.naturalWidth, h = img.naturalHeight;
    const bs = FRAME / Math.min(w, h);
    setNatural({ w, h });
    setPos({ x: (FRAME - w * bs) / 2, y: (FRAME - h * bs) / 2 });
  };

  // Re-clamp pan position when zoom shrinks the valid drag range.
  useEffect(() => {
    if (!natural) return;
    setPos(p => clamp(p.x, p.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: pos.x, origY: pos.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    setPos(clamp(dragRef.current.origX + dx, dragRef.current.origY + dy));
  };
  const onPointerUp = () => { dragRef.current = null; };

  const confirm = () => {
    const img = imgRef.current;
    if (!img || !natural) return;
    const canvas = document.createElement('canvas');
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const sx = -pos.x / scale;
    const sy = -pos.y / scale;
    const sSize = FRAME / scale;
    ctx.drawImage(img, sx, sy, sSize, sSize, 0, 0, OUTPUT, OUTPUT);
    canvas.toBlob(blob => { if (blob) onConfirm(blob); }, 'image/jpeg', 0.9);
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-[60] bg-black/75 flex items-center justify-center p-4" onClick={onCancel}>
      <div ref={panelRef} {...dialogProps} className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-sm shadow-2xl outline-none" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <h2 className="font-bold">Adjust Photo</h2>
          <button onClick={onCancel} aria-label="Close" className="text-slate-400 hover:text-white transition-colors"><X size={18}/></button>
        </div>

        <div className="p-5 flex flex-col items-center gap-4">
          <div
            className="relative overflow-hidden rounded-full border-2 border-slate-700 touch-none select-none"
            style={{ width: FRAME, height: FRAME }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              onLoad={onImgLoad}
              className="absolute top-0 left-0 max-w-none cursor-grab active:cursor-grabbing"
              style={{ width: dispW || undefined, height: dispH || undefined, transform: `translate(${pos.x}px, ${pos.y}px)` }}
            />
          </div>
          <p className="text-[11px] text-slate-500">Drag to reposition</p>

          <label className="w-full flex items-center gap-3">
            <span className="text-[11px] text-slate-500 font-semibold shrink-0">Zoom</span>
            <input type="range" min={1} max={3} step={0.01} value={zoom}
              onChange={e => setZoom(Number(e.target.value))}
              className="w-full accent-emerald-500"/>
          </label>
        </div>

        <div className="flex gap-2 px-5 pb-5">
          <button onClick={onCancel}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-semibold transition-colors">
            Cancel
          </button>
          <button onClick={confirm} disabled={!natural}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors">
            <Check size={14}/> Use Photo
          </button>
        </div>
      </div>
    </div>
  );
}
