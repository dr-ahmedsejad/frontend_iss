'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Upload, CheckCircle, AlertCircle,
  RefreshCw, Loader2, FileSpreadsheet,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';
import { validateUpload } from '@/lib/file-validation';

interface Departement {
  id:   number;
  nom:  string;
  annee_universitaire: string;
}

interface ImportResultat {
  imported:  number;
  created?:  number;
  updated?:  number;
  errors?:   string[];
  lignes?:   { matricule: string; nom: string; departement: string }[];
}

export default function ImporterEtudiantsPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const [depId,      setDepId]      = useState('');
  const [useFileDep, setUseFileDep] = useState(false);
  const [fichier,    setFichier]    = useState<File | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [success,    setSuccess]    = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const departementsQuery = useQuery({
    queryKey: ['departements', 'list', { annee_universitaire: annee, page_size: 200, exclude: ['HE','ST'] }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Departement[] } | Departement[]>(
        `/api/v1/departements/?annee_universitaire=${annee}&page_size=200`,
      );
      const list = Array.isArray(res) ? res : res.results;
      return list.filter(d => !['HE','ST'].includes(d.nom)).sort((a,b) => a.nom.localeCompare(b.nom));
    },
    enabled: !!annee,
  });
  const departements = departementsQuery.data ?? [];
  const loadingDeps = departementsQuery.isLoading;

  const qc = useQueryClient();
  const importMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('fichier', fichier!);
      if (!useFileDep && depId) fd.append('departement_id', depId);
      return apiFetch<ImportResultat>('/api/v1/absences/etudiants/importer/', { method: 'POST', body: fd });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['absences', 'etudiants'] });
      setSuccess(`Import terminé : ${res.imported ?? 0} étudiant(s) traité(s).`);
      setFichier(null);
      if (fileRef.current) fileRef.current.value = '';
    },
    onError: (err) => setError(err instanceof Error ? err.message : 'Erreur lors de l\'import.'),
  });
  const loading  = importMut.isPending;
  const resultat = importMut.data ?? null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fichier) { setError('Veuillez sélectionner un fichier.'); return; }
    if (!useFileDep && !depId) { setError('Choisissez un département ou cochez l\'option fichier.'); return; }
    setError(null); setSuccess(null);
    importMut.mutate();
  }

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/absences"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Upload size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Importer les étudiants</h1>
          <p className="text-xs text-iss-gray">Charger depuis un fichier Excel (.xlsx) ou CSV</p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Département */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-iss-dark mb-1.5">
                Filière (département)
                <span className="ml-1 font-normal text-iss-gray text-xs">(optionnel)</span>
              </label>
              {loadingDeps ? (
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                  <Loader2 size={14} className="animate-spin text-iss-gray" />
                  <span className="text-sm text-iss-gray">Chargement…</span>
                </div>
              ) : (
                <select
                  value={depId}
                  onChange={e => setDepId(e.target.value)}
                  disabled={useFileDep}
                  className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-iss-primary disabled:opacity-50 disabled:cursor-not-allowed">
                  <option value="">— Choisir une filière —</option>
                  {departements.map(d => (
                    <option key={d.id} value={d.id}>{d.nom}</option>
                  ))}
                </select>
              )}
              <p className="mt-1 text-xs text-iss-gray">
                Si coché ci-contre, la filière sera lue depuis le fichier.
              </p>
            </div>

            <div className="flex items-start pt-6">
              <label className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={useFileDep}
                  onChange={e => { setUseFileDep(e.target.checked); if (e.target.checked) setDepId(''); }}
                  className="w-4 h-4 rounded accent-iss-primary"
                />
                <span className="text-sm font-medium text-iss-dark group-hover:text-iss-primary transition-colors">
                  Utiliser la filière indiquée dans le fichier
                </span>
              </label>
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="block text-sm font-semibold text-iss-dark mb-1.5">
              Fichier <span className="text-iss-secondary">*</span>
            </label>
            <div
              className="relative border-2 border-dashed border-gray-200 rounded-2xl p-8 text-center hover:border-iss-primary transition-colors cursor-pointer"
              style={fichier ? { borderColor: '#006633', background: 'rgba(0,102,51,0.03)' } : {}}
              onClick={() => fileRef.current?.click()}>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.csv"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  if (f) {
                    const err = validateUpload(f, { maxSizeMb: 10, accept: '.xlsx,.csv' });
                    if (err) { setError(err); e.target.value = ''; return; }
                  }
                  setFichier(f); setError(null);
                }}
              />
              {fichier ? (
                <div className="flex flex-col items-center gap-2">
                  <FileSpreadsheet size={32} style={{ color: '#006633' }} />
                  <p className="text-sm font-semibold text-iss-dark">{fichier.name}</p>
                  <p className="text-xs text-iss-gray">{(fichier.size / 1024).toFixed(1)} Ko</p>
                  <button type="button"
                    className="mt-1 text-xs text-iss-secondary hover:underline"
                    onClick={e => { e.stopPropagation(); setFichier(null); if (fileRef.current) fileRef.current.value = ''; }}>
                    Supprimer
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload size={28} className="text-iss-gray" />
                  <p className="text-sm font-medium text-iss-dark">
                    Glissez votre fichier ici ou <span style={{ color: '#006633' }} className="font-semibold">cliquez pour sélectionner</span>
                  </p>
                  <p className="text-xs text-iss-gray">Formats acceptés : .xlsx (préféré) ou .csv</p>
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-iss-gray">
              Colonnes attendues (insensibles à la casse) :&nbsp;
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">matricule</code>,&nbsp;
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">nom</code>,&nbsp;
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">genre</code>&nbsp;(opt.),&nbsp;
              <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">departement</code>&nbsp;(opt.)
            </p>
          </div>

          {/* Error / success */}
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-green-50 border border-green-200 text-sm text-green-700">
              <CheckCircle size={16} className="shrink-0 mt-0.5" />
              {success}
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !fichier}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {loading ? 'Import en cours…' : 'Importer'}
            </button>
            <button
              type="button"
              onClick={() => { setFichier(null); setDepId(''); setUseFileDep(false); importMut.reset(); setError(null); setSuccess(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-iss-gray hover:bg-gray-50 transition-colors">
              <RefreshCw size={14} />
              Réinitialiser
            </button>
          </div>
        </form>
      </div>

      {/* Results */}
      {resultat && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Recap */}
          <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
            <h3 className="text-sm font-bold text-iss-dark mb-4">Récapitulatif</h3>
            <div className="space-y-2">
              {[
                { label: 'Traités',    value: resultat.imported ?? 0,  color: '#006633' },
                { label: 'Créés',      value: resultat.created  ?? 0,  color: '#006633' },
                { label: 'Mis à jour', value: resultat.updated  ?? 0,  color: '#1a5c8f' },
              ].map(({ label, value, color }) => (
                <div key={label} className="flex items-center justify-between px-3 py-2 rounded-xl bg-gray-50">
                  <span className="text-sm text-iss-gray">{label}</span>
                  <span className="text-sm font-bold" style={{ color }}>{value}</span>
                </div>
              ))}
            </div>

            {resultat.errors && resultat.errors.length > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
                <p className="text-xs font-semibold text-amber-800 mb-2">
                  Erreurs ({resultat.errors.length})
                </p>
                <ul className="space-y-1">
                  {resultat.errors.slice(0, 5).map((e, i) => (
                    <li key={i} className="text-xs text-amber-700">• {e}</li>
                  ))}
                  {resultat.errors.length > 5 && (
                    <li className="text-xs text-amber-500">… {resultat.errors.length - 5} de plus</li>
                  )}
                </ul>
              </div>
            )}
          </div>

          {/* Preview */}
          {resultat.lignes && resultat.lignes.length > 0 && (
            <div className="lg:col-span-2 bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-bold text-iss-dark">
                  Aperçu ({Math.min(resultat.lignes.length, 100)} lignes)
                </h3>
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Matricule</th>
                      <th>Nom</th>
                      <th>Filière</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resultat.lignes.slice(0, 100).map((r, i) => (
                      <tr key={i}>
                        <td><code className="text-xs">{r.matricule}</code></td>
                        <td>{r.nom}</td>
                        <td className="text-iss-gray text-xs">{r.departement}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
