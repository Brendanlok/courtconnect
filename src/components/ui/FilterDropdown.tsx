'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export function FilterDropdown<T extends string>({
  icon, label, value, options, onChange, defaultValue,
}: {
  icon?: React.ReactNode;
  label: string;
  value: T;
  options: { value: T; label: string; prefix?: React.ReactNode }[];
  onChange: (v: T) => void;
  /** Value considered "no filter applied" for the active/inactive button styling. Defaults to options[0]'s value. */
  defaultValue?: T;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const selected = options.find(o => o.value === value);
  const isDefault = value === (defaultValue ?? options[0]?.value);

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border rounded-xl text-xs transition-colors
          ${!isDefault ? 'border-emerald-500/50 text-emerald-300' : 'border-slate-800 text-slate-400 hover:border-slate-600 hover:text-slate-300'}`}>
        {icon}
        <span>{isDefault ? label : (selected?.label ?? value)}</span>
        <ChevronDown size={11} className={`text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`}/>
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 z-30 bg-slate-900 border border-slate-700 rounded-xl shadow-xl overflow-hidden min-w-[160px]">
          {options.map(o => (
            <button key={o.value} onClick={() => { onChange(o.value); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors
                ${o.value === value ? 'bg-emerald-600/20 text-emerald-300' : 'text-slate-300 hover:bg-slate-800'}`}>
              {o.prefix}
              {o.label}
              {o.value === value && <Check size={11} className="ml-auto text-emerald-400"/>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
