'use client';

import { type LucideIcon, Inbox } from 'lucide-react';
import Link from 'next/link';

interface EmptyStateProps {
  icon?:        LucideIcon;
  title:        string;
  description?: string;
  action?:      { label: string; href?: string; onClick?: () => void };
}

export default function EmptyState({ icon: Icon = Inbox, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
        style={{ background: 'rgba(0,102,51,0.08)' }}>
        <Icon size={28} style={{ color: '#006633' }} />
      </div>
      <h3 className="text-base font-semibold text-iss-dark mb-1">{title}</h3>
      {description && <p className="text-sm text-iss-gray mb-6 max-w-xs">{description}</p>}
      {action && (
        action.href ? (
          <Link href={action.href}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {action.label}
          </Link>
        ) : (
          <button onClick={action.onClick}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {action.label}
          </button>
        )
      )}
    </div>
  );
}
