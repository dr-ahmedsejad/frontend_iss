'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft, Save, Search, FileWarning, Loader2,
  Calendar, AlertTriangle, Upload, X,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { validateUpload } from '@/lib/file-validation';
import { etudiantsApi } from '@/lib/api/scolarite';
import { setFlash } from '@/lib/flash';
import type { Etudiant } from '@/types/scolarite';

interface AnneeOption {
  id:    number;
  annee: string;
}

const TYPE_OPTIONS = [
  { value: 'annee_blanche',          label: 'Année blanche ',                          justifReq: true  },
  { value: 'derogation_inscription', label: "Dérogation d'inscription (au-delà du droit de redoublement)", justifReq: true  },
  { value: 'autre',                  label: 'Autre dérogation',                                            justifReq: false },
];

export default function AjouterDerogationPage() {
  const router = useRouter();
  const toast  = useToast();
  const qc     = useQueryClient();

  // Recherche étudiant
  const [search,        setSearch]        = useState('');
  const [suggestions,   setSuggestions]   = useState<Etudiant[]>([]);
  const [loadingSugg,   setLoadingSugg]   = useState(false);
  const [showSugg,      setShowSugg]      = useState(false);
  const [etudiant,      setEtudiant]      = useState<Etudiant | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchRef   = useRef<HTMLDivElement>(null);

  // Champs formulaire
  const [anneeId,       setAnneeId]       = useState<number | ''>('');
  const [typeDerog,     setTypeDerog]     = useState<string>('annee_blanche');
  const [motif,         setMotif]         = useState('');
  const [dateDecision,  setDateDecision]  = useState(new Date().toISOString().slice(0, 10));
  const [justificatif,  setJustificatif]  = useState<File | null>(null);

  const [errors,        setErrors]        = useState<Record<string, string>>({});

  // ── Chargement années ──────────────────────────────────────────────────────
  const anneesQuery = useQuery({
    queryKey: ['parametres', 'annees', 'list'] as const,
    queryFn:  async () => {
      const d = await apiFetch<AnneeOption[] | { results: AnneeOption[] }>('/api/v1/parametres/annees/');
      const list = Array.isArray(d) ? d : (d?.results ?? []);
      return [...list].sort((a, b) => b.annee.localeCompare(a.annee));
    },
  });
  const annees = anneesQuery.data ?? [];

  useEffect(() => {
    if (annees.length > 0 && anneeId === '') setAnneeId(annees[0].id);
  }, [annees, anneeId]);

  useEffect(() => {
    if (anneesQuery.error) toast.error((anneesQuery.error as Error).message);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anneesQuery.error]);

  // ── Recherche étudiants (debounce 300 ms) ─────────────────────────────────
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!search.trim() || etudiant) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoadingSugg(true);
      try {
        const data = await etudiantsApi.list({ search, page_size: 8 });
        setSuggestions(data.results ?? []);
        setShowSugg(true);
      } catch {
        setSuggestions([]);
      } finally {
        setLoadingSugg(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, etudiant]);

  // Fermer suggestions au clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSugg(false);
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, []);

  const selectEtudiant = (etu: Etudiant) => {
    setEtudiant(etu);
    setSearch(`${etu.matricule} — ${etu.nom_fr || etu.nom || ''}`);
    setSuggestions([]);
    setShowSugg(false);
  };

  const clearEtudiant = () => {
    setEtudiant(null);
    setSearch('');
  };

  // ── Soumission ────────────────────────────────────────────────────────────
  const submitMut = useMutation({
    mutationFn: () => {
      const fd = new FormData();
      fd.append('etudiant',         String(etudiant!.id));
      fd.append('annee_univ',       String(anneeId));
      fd.append('type_derogation',  typeDerog);
      fd.append('motif',            motif.trim());
      fd.append('date_decision',    dateDecision);
      if (justificatif) fd.append('justificatif', justificatif);
      return apiFetch('/api/v1/inscriptions/derogations/', { method: 'POST', body: fd });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inscriptions', 'derogations'] });
      setFlash('Dérogation enregistrée avec succès.');
      router.push('/dashboard/inscriptions/derogations');
    },
    onError: (e) => {
      const msg = (e as Error).message;
      try {
        const parsed = JSON.parse(msg);
        setErrors(parsed);
      } catch {
        toast.error(msg);
      }
    },
  });
  const loading = submitMut.isPending;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!etudiant)       errs.etudiant      = 'Sélectionnez un étudiant.';
    if (!anneeId)        errs.annee_univ    = "L'année universitaire est obligatoire.";
    if (!motif.trim())   errs.motif         = 'Le motif est obligatoire.';
    if (!dateDecision)   errs.date_decision = 'La date de la décision est obligatoire.';

    const typeOpt = TYPE_OPTIONS.find(t => t.value === typeDerog);
    if (typeOpt?.justifReq && !justificatif) {
      errs.justificatif = "Un justificatif est obligatoire pour ce type de dérogation.";
    }
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    submitMut.mutate();
  };

  const typeOpt = TYPE_OPTIONS.find(t => t.value === typeDerog);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* En-tête */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/inscriptions/derogations"
          className="p-2 rounded-md text-slate-600 hover:bg-slate-100 transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Nouvelle dérogation</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Enregistrement préalable à la délibération (année blanche, etc.)
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="bg-white rounded-lg shadow-sm border border-slate-200 p-6 space-y-5">

        {/* Étudiant */}
        <div ref={searchRef} className="relative">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Étudiant <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text" value={search}
              onChange={e => { setSearch(e.target.value); if (etudiant) setEtudiant(null); }}
              placeholder="Rechercher par matricule ou nom…"
              className="w-full pl-9 pr-9 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40"
            />
            {etudiant && (
              <button type="button" onClick={clearEtudiant}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                <X size={14} />
              </button>
            )}
          </div>
          {showSugg && suggestions.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
              {suggestions.map(e => (
                <button key={e.id} type="button" onClick={() => selectEtudiant(e)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0">
                  <div className="font-mono text-xs text-slate-500">{e.matricule}</div>
                  <div className="font-medium text-slate-800">{e.nom_fr || e.nom}</div>
                </button>
              ))}
            </div>
          )}
          {showSugg && loadingSugg && (
            <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg p-3 text-sm text-slate-500 flex items-center gap-2">
              <Loader2 size={14} className="animate-spin" /> Recherche…
            </div>
          )}
          {errors.etudiant && <p className="text-xs text-[#C82020] mt-1">{errors.etudiant}</p>}
        </div>

        {/* Année universitaire */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Année universitaire <span className="text-red-500">*</span>
          </label>
          <select value={anneeId} onChange={e => setAnneeId(Number(e.target.value))}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
            {annees.map(a => <option key={a.id} value={a.id}>{a.annee}</option>)}
          </select>
          {errors.annee_univ && <p className="text-xs text-[#C82020] mt-1">{errors.annee_univ}</p>}
        </div>

        {/* Type de dérogation */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Type de dérogation <span className="text-red-500">*</span>
          </label>
          <select value={typeDerog} onChange={e => setTypeDerog(e.target.value)}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40">
            {TYPE_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          {typeDerog === 'annee_blanche' && (
            <div className="mt-2 flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
              <AlertTriangle size={14} className="text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                L'année blanche annule l'année en cours pour l'étudiant. Elle ne consomme pas
                son droit de redoublement (Art. 23 Arrêté 562 / Art. 29 Décret 2018-070).
                Décision du directeur d'établissement sur avis médical.
              </p>
            </div>
          )}
          {typeDerog === 'derogation_inscription' && (
            <div className="mt-2 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-md">
              <AlertTriangle size={14} className="text-amber-700 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800 leading-relaxed">
                Autorise la réinscription de l'étudiant alors qu'il a déjà consommé son droit
                de redoublement (Art. 22 / Art. 28). Décision exceptionnelle du directeur
                d'établissement — l'étudiant ne sera pas exclu lors de la délibération annuelle.
              </p>
            </div>
          )}
        </div>

        {/* Motif */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Motif <span className="text-red-500">*</span>
          </label>
          <textarea value={motif} onChange={e => setMotif(e.target.value)}
            rows={3} placeholder="Ex : Hospitalisation prolongée du 15/12 au 28/02 attestée par certificat médical…"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40 resize-none" />
          {errors.motif && <p className="text-xs text-[#C82020] mt-1">{errors.motif}</p>}
        </div>

        {/* Date décision */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Date de la décision <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input type="date" value={dateDecision}
              onChange={e => setDateDecision(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-[#006633]/40" />
          </div>
          {errors.date_decision && <p className="text-xs text-[#C82020] mt-1">{errors.date_decision}</p>}
        </div>

        {/* Justificatif */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Justificatif {typeOpt?.justifReq && <span className="text-red-500">*</span>}
            {!typeOpt?.justifReq && <span className="text-slate-400 text-xs ml-1">(optionnel)</span>}
          </label>
          <div className="flex items-center gap-2">
            <label className="flex-1 flex items-center gap-2 px-3 py-2 border border-dashed border-slate-300 rounded-md text-sm text-slate-600 hover:bg-slate-50 cursor-pointer">
              <Upload size={14} />
              <span className="truncate">{justificatif?.name ?? 'Choisir un fichier (PDF, image…)'}</span>
              <input type="file" accept=".pdf,image/*"
                onChange={e => {
                  const f = e.target.files?.[0] ?? null;
                  if (f) {
                    const err = validateUpload(f, { maxSizeMb: 5, accept: '.pdf,image/jpeg,image/png,image/webp' });
                    if (err) { toast.error(err); e.target.value = ''; return; }
                  }
                  setJustificatif(f);
                }}
                className="hidden" />
            </label>
            {justificatif && (
              <button type="button" onClick={() => setJustificatif(null)}
                className="p-2 text-slate-400 hover:text-[#C82020] transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          {errors.justificatif && <p className="text-xs text-[#C82020] mt-1">{errors.justificatif}</p>}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <Link href="/dashboard/inscriptions/derogations"
            className="px-4 py-2 rounded-md text-sm border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors">
            Annuler
          </Link>
          <button type="submit" disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium text-white bg-[#006633] hover:bg-[#00552a] transition-colors disabled:opacity-50">
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Enregistrer
          </button>
        </div>
      </form>
    </div>
  );
}
