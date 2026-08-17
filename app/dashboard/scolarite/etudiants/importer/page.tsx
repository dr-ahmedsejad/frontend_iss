'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FileDropzone from '@/components/ui/FileDropzone';
import FiliereSelect from '@/components/scolarite/FiliereSelect';

interface ImportResult {
  created:  number;
  updated:  number;
  errors:   { row: number; message: string }[];
}

export default function ImporterEtudiantsPage() {
  const toast = useToast();
  const qc    = useQueryClient();
  const [file, setFile]       = useState<File | null>(null);
  const [filiere, setFiliere] = useState<number | null>(null);
  const [progress, setProgress] = useState<number | null>(null);

  const importMut = useMutation({
    mutationFn: () => new Promise<ImportResult>((resolve, reject) => {
      const fd = new FormData();
      fd.append('fichier', file!);
      if (filiere) fd.append('filiere', String(filiere));

      const xhr = new XMLHttpRequest();
      xhr.withCredentials = true;
      xhr.open('POST', `${API_BASE_URL}/api/v1/scolarite/etudiants/importer/`);
      xhr.upload.onprogress = e => { if (e.lengthComputable) setProgress(Math.round(e.loaded / e.total * 100)); };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
        else {
          try { reject(new Error(JSON.parse(xhr.responseText).error || `Erreur ${xhr.status}`)); }
          catch { reject(new Error(`Erreur ${xhr.status}`)); }
        }
      };
      xhr.onerror = () => reject(new Error('Erreur réseau'));
      xhr.send(fd);
    }),
    onMutate: () => { setProgress(0); },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['scolarite', 'etudiants'] });
      if (res.errors.length === 0) toast.success(`Import réussi : ${res.created} créés, ${res.updated} mis à jour`);
      else toast.warning(`Import partiel : ${res.created + res.updated} importés, ${res.errors.length} erreurs`);
    },
    onError:  (e) => toast.error((e as Error).message),
    onSettled: () => setProgress(null),
  });
  const result  = importMut.data ?? null;
  const loading = importMut.isPending;

  function handleImport() {
    if (!file) { toast.error('Sélectionnez un fichier Excel'); return; }
    importMut.mutate();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/etudiants"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Importer des étudiants</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-5">
        {/* Instructions */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <FileSpreadsheet size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700">
            <p className="font-semibold mb-1">Format attendu (Excel .xlsx)</p>
            <p className="text-xs leading-relaxed">
              Colonnes requises : <code className="bg-blue-100 px-1 rounded">nom_fr</code>, <code className="bg-blue-100 px-1 rounded">prenom_fr</code>, <code className="bg-blue-100 px-1 rounded">genre</code>
              <br />Colonnes optionnelles : nom_ar, prenom_ar, date_naissance, numero_cni, email, telephone, niveau
            </p>
            <a href="/api/v1/scolarite/etudiants/template/"
              className="inline-block mt-2 text-xs font-semibold text-blue-600 underline">
              Télécharger le template
            </a>
          </div>
        </div>

        <FiliereSelect value={filiere} onChange={setFiliere}
          label="Filière cible (optionnel)" placeholder="Filière par défaut du fichier" />

        <FileDropzone
          label="Fichier Excel"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          maxSizeMb={10}
          value={file}
          onChange={setFile}
          hint="Fichier .xlsx uniquement, max 10 Mo"
        />

        {progress !== null && (
          <div className="space-y-1">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${progress}%`, background: 'linear-gradient(90deg, #006633, #008844)' }} />
            </div>
            <p className="text-xs text-iss-gray text-right">{progress}%</p>
          </div>
        )}

        <button onClick={handleImport} disabled={loading || !file}
          className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60 transition-all"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Upload size={16} />
          {loading ? 'Importation en cours…' : 'Importer'}
        </button>
      </div>

      {/* Résultats */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
          <h2 className="font-semibold text-iss-dark">Résultats de l&apos;import</h2>
          <div className="flex gap-4">
            <div className="flex items-center gap-2 text-emerald-600">
              <CheckCircle2 size={16} />
              <span className="text-sm font-medium">{result.created} créés</span>
            </div>
            <div className="flex items-center gap-2 text-blue-600">
              <CheckCircle2 size={16} />
              <span className="text-sm font-medium">{result.updated} mis à jour</span>
            </div>
            {result.errors.length > 0 && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle size={16} />
                <span className="text-sm font-medium">{result.errors.length} erreurs</span>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="mt-3 space-y-1 max-h-48 overflow-y-auto">
              {result.errors.map((err, i) => (
                <div key={i} className="flex items-center gap-2 text-red-600 text-xs">
                  <AlertCircle size={12} />
                  Ligne {err.row} : {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
