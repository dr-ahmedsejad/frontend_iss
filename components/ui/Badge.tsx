'use client';

export type BadgeVariant = 'success' | 'danger' | 'warning' | 'info' | 'neutral' | 'primary';

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50  text-emerald-700 border-emerald-200',
  danger:  'bg-red-50      text-red-700     border-red-200',
  warning: 'bg-yellow-50   text-yellow-700  border-yellow-200',
  info:    'bg-blue-50     text-blue-700    border-blue-200',
  neutral: 'bg-gray-100   text-gray-600    border-gray-200',
  primary: 'bg-green-50   text-green-700   border-green-200',
};

interface BadgeProps {
  label:     string;
  variant?:  BadgeVariant;
  size?:     'sm' | 'md';
  className?: string;
}

export default function Badge({ label, variant = 'neutral', size = 'sm', className = '' }: BadgeProps) {
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${VARIANT_STYLES[variant]} ${sizeClass} ${className}`}>
      {label}
    </span>
  );
}
