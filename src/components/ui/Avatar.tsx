'use client';

import { useState } from 'react';
import { getInitials } from '@/lib/utils';

const COLORS = [
  'bg-emerald-600','bg-violet-600','bg-rose-600','bg-amber-600',
  'bg-blue-600','bg-cyan-600','bg-fuchsia-600','bg-orange-600',
];

function colorFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return COLORS[h % COLORS.length];
}

export function Avatar({ name, size = 'md', className = '', photoURL }: {
  name: string;
  size?: 'sm'|'md'|'lg';
  className?: string;
  photoURL?: string | null;
}) {
  const [imgError, setImgError] = useState(false);
  const sz = size === 'sm' ? 'w-8 h-8 text-xs' : size === 'lg' ? 'w-16 h-16 text-2xl' : 'w-10 h-10 text-sm';
  if (photoURL && !imgError) {
    return (
      <img
        src={photoURL}
        alt={name}
        onError={() => setImgError(true)}
        className={`${sz} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }
  return (
    <div className={`${sz} ${colorFor(name)} rounded-full flex items-center justify-center font-bold shrink-0 ${className}`}>
      {getInitials(name)}
    </div>
  );
}
