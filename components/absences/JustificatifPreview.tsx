'use client';

import { FileText, ExternalLink } from 'lucide-react';
import { safeFileUrl } from '@/lib/safe-file-url';

interface Props {
  url: string;
  filename?: string;
  size?: 'sm' | 'md';
}

/**
 * Sec-C : on whiteliste UNIQUEMENT les extensions raster (jpg/jpeg/png/webp/gif).
 * SVG est volontairement exclu : un .svg malveillant peut embarquer du JS qui
 * s'exécute dans le contexte de la page (les <img src> SVG sont rendus inline
 * par certains browsers et peuvent inclure <script>).
 *
 * Le backend doit aussi rejeter les SVG, mais c'est une défense en profondeur.
 */
function isRasterImage(url: string) {
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);
}

export default function JustificatifPreview({ url, filename, size = 'sm' }: Props) {
  const safeUrl = safeFileUrl(url);
  if (!safeUrl) {
    return <span className="text-xs text-gray-400 italic">Lien invalide</span>;
  }
  const image    = isRasterImage(safeUrl);
  const label    = filename || safeUrl.split('/').pop() || 'Justificatif';
  const imgClass = size === 'sm'
    ? 'w-12 h-12 object-cover rounded-lg border border-gray-200 hover:opacity-80 transition-opacity'
    : 'w-24 h-24 object-cover rounded-xl border border-gray-200 hover:opacity-80 transition-opacity';

  return (
    <div className="flex items-center gap-2">
      {image ? (
        <a href={safeUrl} target="_blank" rel="noopener noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={safeUrl} alt="Justificatif" className={imgClass} />
        </a>
      ) : (
        <a href={safeUrl} target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs text-[#1a5c8f] hover:underline">
          <FileText size={14} className="shrink-0" />
          <span className="truncate max-w-30">{label}</span>
          <ExternalLink size={10} />
        </a>
      )}
    </div>
  );
}
