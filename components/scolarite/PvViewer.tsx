'use client';

import dynamic from 'next/dynamic';
import { Download } from 'lucide-react';

interface PvViewerProps {
  blob:       Blob | null;
  filename?:  string;
  className?: string;
}

/**
 * Viewer PDF inline via <object> natif.
 * Chargé via next/dynamic avec ssr:false pour éviter les erreurs hydratation.
 */
function PvViewerInner({ blob, filename = 'pv.pdf', className = '' }: PvViewerProps) {
  if (!blob) return null;
  const url = URL.createObjectURL(blob);

  function handleDownload() {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-iss-dark">{filename}</p>
        <button onClick={handleDownload}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border border-gray-200 text-iss-gray hover:bg-gray-50 transition-colors">
          <Download size={13} />
          Télécharger
        </button>
      </div>
      <object
        data={url}
        type="application/pdf"
        className="w-full rounded-xl border border-gray-200"
        style={{ height: '600px' }}
      >
        <div className="flex items-center justify-center h-40 text-sm text-iss-gray">
          Votre navigateur ne supporte pas l&apos;affichage PDF inline.{' '}
          <button onClick={handleDownload} className="ml-1 text-iss-primary underline">
            Télécharger
          </button>
        </div>
      </object>
    </div>
  );
}

export default dynamic(() => Promise.resolve(PvViewerInner), { ssr: false });
