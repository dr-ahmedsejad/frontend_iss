'use client';

import { useState, useRef } from 'react';
import { Paperclip, Loader2, CheckCircle, X, ExternalLink } from 'lucide-react';
import { apiUpload } from '@/lib/api';
import { validateUpload } from '@/lib/file-validation';

interface Props {
  etudiantId: number;
  suiviId: number;
  existingUrl?: string | null;
  onSuccess?: (url: string) => void;
  disabled?: boolean;
  compact?: boolean;
}

export default function JustificatifUploader({
  etudiantId, suiviId, existingUrl, onSuccess, disabled, compact = false,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    const v = validateUpload(file, { maxSizeMb: 5, accept: 'image/jpeg,image/png,image/webp,application/pdf' });
    if (v) { setError(v); return; }
    setUploading(true); setError(null); setProgress(0);
    try {
      const fd = new FormData();
      fd.append('etudiant_id', String(etudiantId));
      fd.append('suivi_id', String(suiviId));
      fd.append('justificatif', file);
      const res = await apiUpload<{ message: string; statut: number; url: string }>(
        '/api/v1/absences/presences/upload-justificatif/',
        fd,
        { onProgress: setProgress },
      );
      setUploaded(true);
      onSuccess?.(res.url);
    } catch {
      setError('Échec upload.');
    } finally {
      setUploading(false);
    }
  }

  if (existingUrl && !uploaded) {
    return (
      <a href={existingUrl} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-xs text-[#1a5c8f] hover:underline">
        <Paperclip size={12} /> {compact ? 'PJ' : 'Justificatif'} <ExternalLink size={10} />
      </a>
    );
  }

  if (uploaded) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-[#006633]">
        <CheckCircle size={12} /> Envoyé
      </span>
    );
  }

  return (
    <div className="inline-flex items-center gap-1">
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        capture="environment"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
      <button
        disabled={disabled || uploading}
        onClick={() => ref.current?.click()}
        className="inline-flex items-center gap-1 text-xs text-[#7c3aed] hover:text-[#5b21b6] disabled:opacity-50"
        title="Joindre un justificatif"
      >
        {uploading
          ? <><Loader2 size={12} className="animate-spin" /> {progress}%</>
          : <><Paperclip size={12} /> {compact ? '' : 'Justificatif'}</>
        }
      </button>
      {error && (
        <span className="text-[10px] text-red-600 flex items-center gap-0.5">
          <X size={10} /> {error}
        </span>
      )}
    </div>
  );
}
