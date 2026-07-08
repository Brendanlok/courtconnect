'use client';
import { forwardRef } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'amber' | 'ghost';

const VARIANT_STYLES: Record<ButtonVariant, string> = {
  primary:   'bg-emerald-600 hover:bg-emerald-500 text-white',
  secondary: 'bg-slate-800 hover:bg-slate-700 text-slate-100',
  danger:    'bg-red-600 hover:bg-red-500 text-white',
  amber:     'bg-amber-500 hover:bg-amber-400 text-black',
  ghost:     'bg-transparent hover:bg-slate-800 text-slate-300 border border-slate-700',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

/**
 * Shared action button — the primary/secondary/danger/amber footer button shape
 * repeated across every modal (Save, Cancel, Submit, Delete, etc). Layout classes
 * (flex-1, w-full, px-*) are passed in via className; this component only owns
 * color, shape, and interaction state so call sites keep control of layout.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', icon, className = '', children, ...props }, ref,
) {
  return (
    <button
      ref={ref}
      className={`flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${VARIANT_STYLES[variant]} ${className}`}
      {...props}
    >
      {icon}{children}
    </button>
  );
});
