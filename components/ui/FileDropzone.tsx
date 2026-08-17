'use client';

import { useRef, useState } from 'react';
import { Upload, File, X, AlertCircle } from 'lucide-react';

interface FileDropzoneProps {
  label?:        string;
  accept?:       string;        // e.g. "image/jpeg,image/png"
  maxSizeMb?:    number;        // default 5
  value?:        File | null;
  onChange:      (f: File | null) => void;
  error?:        string;
  hint?:         string;
  className?:    string;
}

/** Zone de dépôt fichier avec validation MIME + taille côté client. */
export default function FileDropzone({
  label = 'Fichier',
  accept,
  maxSizeMb = 5,
  value,
  onChange,
  error,
  hint,
  className = '',
}: FileDropzoneProps) {
  const inputRef    = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [localErr, setLocalErr] = useState('');

  function validate(file: File): string | null {
    if (accept) {
      const accepted = accept.split(',').map(s => s.trim().toLowerCase());
      const mime     = file.type.toLowerCase();
      const ext      = '.' + file.name.split('.').pop()!.toLowerCase();
      const ok       = accepted.some(a => a === mime || a === ext || (a.endsWith('/*') && mime.startsWith(a.slice(0, -1))));
      if (!ok) return `Type de fichier non autorisé. Acceptés : ${accept}`;
    }
    if (file.size > maxSizeMb * 1024 * 1024) {
      return `Fichier trop volumineux (max ${maxSizeMb} Mo)`;
    }
    return null;
  }

  function handleFile(file: File) {
    const err = validate(file);
    if (err) { setLocalErr(err); return; }
    setLocalErr('');
    onChange(file);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  const displayError = error || localErr;

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <p className="text-sm font-medium text-iss-dark-soft">{label}</p>}

      {value ? (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-emerald-200 bg-emerald-50">
          <File size={18} className="text-emerald-600 shrink-0" />
          <p className="flex-1 text-sm font-medium text-emerald-700 truncate">{value.name}</p>
          <p className="text-xs text-emerald-600 shrink-0">{(value.size / 1024 / 1024).toFixed(2)} Mo</p>
          <button
            type="button"
            onClick={() => { onChange(null); setLocalErr(''); }}
            className="shrink-0 text-emerald-600 hover:text-red-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`flex flex-col items-center justify-center gap-2 px-4 py-8 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            dragging
              ? 'border-iss-primary bg-green-50'
              : displayError
              ? 'border-red-300 bg-red-50'
              : 'border-gray-200 bg-gray-50 hover:border-iss-primary hover:bg-green-50/30'
          }`}
        >
          <Upload size={24} className={dragging ? 'text-iss-primary' : 'text-iss-gray'} />
          <div className="text-center">
            <p className="text-sm font-medium text-iss-dark">
              Glisser-déposer ou <span className="text-iss-primary">parcourir</span>
            </p>
            {hint && <p className="text-xs text-iss-gray mt-0.5">{hint}</p>}
            <p className="text-[11px] text-iss-gray/70 mt-1">Max {maxSizeMb} Mo</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); e.target.value = ''; }}
      />

      {displayError && (
        <div className="flex items-center gap-1.5 text-red-600">
          <AlertCircle size={13} />
          <p className="text-[11px] font-medium">{displayError}</p>
        </div>
      )}
    </div>
  );
}
