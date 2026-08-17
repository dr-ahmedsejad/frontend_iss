'use client';

interface LoadingSkeletonProps {
  rows?:    number;
  cols?:    number;
  height?:  string;
  className?: string;
}

/** Skeleton de chargement réutilisable. Jamais de spinner plein écran sur une liste. */
export default function LoadingSkeleton({ rows = 5, cols = 4, height = 'h-10', className = '' }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse space-y-2 ${className}`}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className={`flex-1 bg-gray-200 rounded-lg ${height}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Skeleton pour une seule ligne de texte. */
export function TextSkeleton({ width = 'w-32', height = 'h-4' }: { width?: string; height?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${width} ${height}`} />;
}

/** Skeleton pour une carte. */
export function CardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-white rounded-2xl border border-gray-100 p-5 space-y-3 ${className}`}>
      <div className="h-5 bg-gray-200 rounded w-2/3" />
      <div className="h-4 bg-gray-200 rounded w-1/2" />
      <div className="h-4 bg-gray-200 rounded w-full" />
    </div>
  );
}
