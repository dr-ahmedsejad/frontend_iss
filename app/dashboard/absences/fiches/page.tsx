'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ArrowLeft, BookOpen, Filter, Download,
  Loader2, AlertCircle, Users,
} from 'lucide-react';
import { apiFetch, apiFetchBlob } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface Departement { id: number; nom: string; niveau_nom?: string | null; filiere_code?: string | null; is_container?: boolean; }

/* Libellé groupe « FILIERE - NIVEAU - GROUPE » (ex. LPSTAT - L1 - G1),
   identique aux selects de emplois/gerer et absences/saisir. */
function deptLabel(d: Departement): string {
  return [d.filiere_code, d.niveau_nom, d.nom].filter(Boolean).join(' - ');
}

/* DS / ER / EF = examen/surveillance → signé par le surveillant (pas le prof),
   identique au PDF (fiches_presence.html). */
function isSurveillance(typeLabel: string | null | undefined): boolean {
  return ['DS', 'ER', 'EF'].includes((typeLabel ?? '').toUpperCase());
}

/* Date AAAA-MM-JJ → JJ/MM/AAAA (comme le PDF). */
function fmtDateFr(d: string | null | undefined): string {
  if (!d) return '';
  const [y, m, day] = d.split('-');
  return day && m && y ? `${day}/${m}/${y}` : d;
}
interface Semestre    {
  id: number; semestre: string; code_semestre: string;
  type_semestre: string; niveau_semestre: number; niveau_nom: string;
}
interface Etudiant { id: number; matricule: string; nom: string; genre: string; }
/** Un étudiant d'un AUTRE groupe, inscrit à cet élément en dette. */
interface EtudiantDette extends Etudiant { groupe: string; }
/** Un membre du groupe inscrit dans une AUTRE filière, placé ici pour la
 *  planification : il suit les cours sans être inscrit aux éléments. */
interface EtudiantRattache extends Etudiant { filiere: string; }

/** Ordre CROISSANT des matricules, en NOMBRE (« 9999 » avant « 10000 ») ; un
 *  matricule non numérique passe après. Même règle que le PDF :
 *  `ordre_matricule`, apps/absence/liste_appel.py. */
function compareMatricules(a: string, b: string): number {
  const ta = (a ?? '').trim(), tb = (b ?? '').trim();
  const na = /^\d+$/.test(ta), nb = /^\d+$/.test(tb);
  if (na && nb) return Number(ta) - Number(tb);
  if (na !== nb) return na ? -1 : 1;
  return ta.localeCompare(tb);
}

/** Une ligne de la fiche : l'étudiant, et la mention qui dit d'où il vient. */
interface LigneFiche { cle: string; etu: Etudiant; mention: string | null; }

/** UNE liste par matricule croissant — celle qu'on lit en faisant l'appel.
 *  Rattachés et dettes y prennent leur place au lieu d'être rejetés en fin de
 *  liste (le 05/10/2026 : « …255045, 24603, 24616… »). */
function lignesDeFiche(f: { etudiants: Etudiant[]; rattaches: EtudiantRattache[];
                            dettes: EtudiantDette[] }): LigneFiche[] {
  return [
    ...f.etudiants.map(etu => ({ cle: `e-${etu.id}`, etu, mention: null })),
    // Un rattaché prend sa place sans mention (demande du 05/10/2026).
    ...f.rattaches.map(etu => ({ cle: `r-${etu.id}`, etu, mention: null })),
    ...f.dettes.map(etu => ({ cle: `d-${etu.id}`, etu, mention: `dette · ${etu.groupe}` })),
  ].sort((x, y) => compareMatricules(x.etu.matricule, y.etu.matricule));
}

/** Une fiche telle que le serveur la calcule — le PDF imprime les mêmes
 *  (`apps/absence/fiches.py`). Un CM y est UNE fiche pour les groupes réunis. */
interface FicheServeur {
  id:              number;
  groupes:         string[];
  cm_commun:       boolean;
  /** « L1 G1 », ou « L3 G1 + L3 G2 » pour un CM réuni. */
  groupe_libelle:  string;
  dep_nom:         string;
  filiere:         string;
  date_seance:     string | null;
  jour:            string;
  creneau_label:   string;
  type_seance:     string;
  numero_semaine:  number;
  em_code:         string;
  em_intitule:     string;
  prof_nom:        string;
  salle_nom:       string;
  etudiants:       Etudiant[];
  rattaches:       EtudiantRattache[];
  dettes:          EtudiantDette[];
  liste_non_verifiee: boolean;
}

interface SuivieRow {
  id:          number;
  jour_label:  string | null;
  creneau_label: string | null;
  type_seance_label: string | null;
  prof_nom:    string | null;
  em_intitule: string | null;
  em_code:     string | null;
  salle_nom:   string | null;
  dept_nom:    string | null;
  numero_semaine: number;
  date_suivie: string | null;
}

interface FicheGroup {
  suivi:      SuivieRow;
  etudiants:  Etudiant[];
  /** Membres du groupe inscrits dans une autre filière. */
  rattaches:  EtudiantRattache[];
  /** Inscrits à l'élément mais venus d'un autre groupe. */
  dettes:     EtudiantDette[];
  /** Les inscriptions à cet élément n'ont pas été saisies : liste du groupe. */
  nonVerifiee: boolean;
  depNom:     string;
  /** Le titre de la fiche : filière, puis groupe AVEC son niveau. */
  libelle:    string;
  filiere:    string;
}

export default function FichesPresencePage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const [selSemId,   setSelSemId]   = useState('');   // ID du semestre sélectionné
  const [selSemaine, setSelSemaine] = useState('');
  const [selDepId,   setSelDepId]   = useState('');
  const [error, setError] = useState<string | null>(null);

  // Mutation telechargement PDF — track le vrai loading state via apiFetchBlob
  const pdfMut = useMutation({
    mutationFn: () => {
      const params: Record<string, string> = {
        annee_universitaire: annee,
        numero_semaine:      selSemaine,
      };
      if (selDepId) params.departement = selDepId;
      return apiFetchBlob('/api/v1/absences/presences/fiches-pdf/', params);
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `fiches_presence_semaine_${selSemaine}${selDepId ? `_dept${selDepId}` : ''}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onError: (err) => {
      const msg = err instanceof Error ? err.message : 'Erreur inconnue';
      if (msg === 'Failed to fetch') {
        console.warn('[pdf] fetch a leve "Failed to fetch" mais le download fonctionne — ignore.');
        return;
      }
      setError(`Erreur lors du téléchargement du PDF : ${msg}`);
    },
  });
  const pdfLoading = pdfMut.isPending;

  /* ─── Init : semestres ── */
  const semestresQuery = useQuery({
    queryKey: ['parametres', 'semestres', 'all', { type: ts }] as const,
    queryFn:  async () => {
      const sems = await apiFetch<Semestre[]>('/api/v1/parametres/semestres/all/').catch(() => [] as Semestre[]);
      return (Array.isArray(sems) ? sems : []).filter(s => s.type_semestre === ts);
    },
    enabled: !!annee,
  });
  const semestres = semestresQuery.data ?? [];

  /* ─── Init : semaines générées ── */
  const semainesQuery = useQuery({
    queryKey: ['suivi', 'semaines-generees', annee, ts] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ semaines_generees: number[] }>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({ semaines_generees: [] as number[] }));
      return [...(res?.semaines_generees ?? [])].sort((a, b) => a - b);
    },
    enabled: !!annee,
  });
  const semaines = semainesQuery.data ?? [];
  const loadingInit = semestresQuery.isLoading || semainesQuery.isLoading;

  // Présélection de la dernière semaine générée
  useEffect(() => {
    if (semaines.length && !selSemaine) setSelSemaine(String(Math.max(...semaines)));
  }, [semaines, selSemaine]);

  /* ─── Départements (dépend du niveau du semestre) ── */
  const selSem = semestres.find(s => String(s.id) === selSemId);
  const niveauId = selSem?.niveau_semestre ?? null;

  const departementsQuery = useQuery({
    queryKey: ['departements', 'list', { annee_universitaire: annee, niveau: niveauId, page_size: 200, exclude: ['HE', 'ST'] }] as const,
    queryFn:  async () => {
      const res = await apiFetch<{ results: Departement[] } | Departement[]>(
        `/api/v1/departements/?annee_universitaire=${annee}&niveau=${niveauId}&page_size=200`,
      );
      const list = Array.isArray(res) ? res : res.results;
      return list.filter(d => !['HE', 'ST'].includes(d.nom)
                            && !d.is_container
                            && !(d.nom || '').toLowerCase().includes('stage'))
                 .sort((a, b) => deptLabel(a).localeCompare(deptLabel(b)));
    },
    enabled: !!annee && !!niveauId,
  });
  const departements = departementsQuery.data ?? [];
  const loadingDeps = departementsQuery.isLoading || departementsQuery.isFetching;

  // Reset selDepId quand on change de semestre
  useEffect(() => {
    setSelDepId('');
  }, [selSemId]);

  /* ─── Générer les fiches (action button-driven) ── */
  const fichesMut = useMutation({
    mutationFn: async (): Promise<FicheGroup[]> => {
      const params = new URLSearchParams({
        annee_universitaire: annee,
        numero_semaine:      selSemaine,
      });
      if (selDepId) params.set('departement', selDepId);

      // Le serveur fait les fiches, le PDF lit le même calcul : qui figure sur
      // chaque fiche (`liste_appel`), et la réunion des groupes d'un CM en
      // une seule fiche. Deux implémentations séparées auraient dérivé.
      const res = await apiFetch<FicheServeur[]>(
        `/api/v1/absences/presences/fiches/?${params}`);
      return res.map(f => ({
        suivi: {
          id: f.id, jour_label: f.jour, creneau_label: f.creneau_label,
          type_seance_label: f.type_seance, prof_nom: f.prof_nom,
          em_intitule: f.em_intitule, em_code: f.em_code, salle_nom: f.salle_nom,
          dept_nom: f.dep_nom, numero_semaine: f.numero_semaine, date_suivie: f.date_seance,
        },
        etudiants:   f.etudiants,
        rattaches:   f.rattaches ?? [],
        dettes:      f.dettes,
        nonVerifiee: f.liste_non_verifiee,
        depNom:      f.dep_nom || '—',
        libelle:     f.groupe_libelle,
        filiere:     f.filiere,
      }));
    },
    onError: (err: unknown) => setError(err instanceof Error ? err.message : 'Erreur de chargement.'),
  });
  const fiches  = fichesMut.data ?? null;
  const loading = fichesMut.isPending;

  function handleLoadFiches() {
    if (!annee || !selSemaine) { setError('Sélectionnez une semaine.'); return; }
    setError(null);
    fichesMut.mutate();
  }

  const depNom = departements.find(d => String(d.id) === selDepId)?.nom;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/absences"
            className="p-2 rounded-xl text-iss-gray hover:bg-gray-100 hover:text-iss-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <BookOpen size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Fiches de présence</h1>
            <p className="text-xs text-iss-gray">Fiche par séance — liste des étudiants par matricule</p>
          </div>
        </div>

        {fiches && fiches.length > 0 && (
          <button
            onClick={() => { if (selSemaine) { setError(null); pdfMut.mutate(); } }}
            disabled={pdfLoading}
            className="sm:ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-60 transition-all"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {pdfLoading
              ? <><Loader2 size={14} className="animate-spin" /> Génération…</>
              : <><Download size={14} /> Télécharger PDF</>
            }
          </button>
        )}
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={14} className="text-iss-primary" />
          <span className="text-sm font-semibold text-iss-dark">Critères de sélection</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">

          {/* 1. Semestre */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Semestre <span className="text-[#C82020]">*</span>
            </label>
            <select value={selSemId} onChange={e => setSelSemId(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633]">
              <option value="">— Choisir —</option>
              {semestres.map(s => (
                <option key={s.id} value={s.id}>{s.semestre} ({s.niveau_nom})</option>
              ))}
            </select>
          </div>

          {/* 2. Groupe (filtré par niveau du semestre) */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Groupe</label>
            {loadingDeps ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-gray-200 bg-gray-50">
                <Loader2 size={12} className="animate-spin text-iss-gray" />
                <span className="text-xs text-iss-gray">Chargement…</span>
              </div>
            ) : (
              <select value={selDepId} onChange={e => setSelDepId(e.target.value)}
                disabled={!selSemId}
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633] disabled:opacity-50">
                <option value="">
                  {selSemId ? 'Tous les groupes' : '— Choisir d\'abord un semestre —'}
                </option>
                {departements.map(d => <option key={d.id} value={d.id}>{deptLabel(d)}</option>)}
              </select>
            )}
          </div>

          {/* 3. Semaine */}
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">
              Semaine <span className="text-[#C82020]">*</span>
            </label>
            <select value={selSemaine} onChange={e => setSelSemaine(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-gray-50 focus:outline-none focus:border-[#006633]">
              <option value="">— Choisir —</option>
              {semaines.map(s => <option key={s} value={s}>Semaine {s}</option>)}
            </select>
          </div>

          {/* 4. Bouton */}
          <div className="flex items-end">
            <button onClick={handleLoadFiches} disabled={loading || !selSemaine}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
              style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Filter size={14} />}
              {loading ? 'Chargement…' : 'Afficher'}
            </button>
          </div>
        </div>

        {loadingInit && (
          <div className="mt-3 flex items-center gap-2 text-xs text-iss-gray">
            <Loader2 size={12} className="animate-spin" /> Chargement…
          </div>
        )}

        {error && (
          <div className="mt-3 flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
            <AlertCircle size={14} /> {error}
          </div>
        )}
      </div>

      {/* Compteur */}
      {fiches !== null && !loading && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-2xl border text-sm"
          style={{ background: 'rgba(0,102,51,0.06)', borderColor: 'rgba(0,102,51,0.2)', color: '#006633' }}>
          <BookOpen size={16} />
          <span>
            <strong>{fiches.length}</strong> fiche{fiches.length !== 1 ? 's' : ''} générée{fiches.length !== 1 ? 's' : ''}
            {selSem && ` — ${selSem.semestre}`}
            {depNom && ` — ${depNom}`}
            {` — Semaine ${selSemaine}`}
          </span>
        </div>
      )}

      {/* Fiches imprimables */}
      {fiches !== null && !loading && (
        <>
          {fiches.length === 0 ? (
            <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
              <BookOpen size={40} className="mx-auto mb-3 text-iss-gray/30" />
              <p className="text-sm text-iss-gray">Aucune séance trouvée pour cette sélection.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {fiches.map((fiche, fi) => {
                const surv = isSurveillance(fiche.suivi.type_seance_label);
                return (
                <div key={fi}
                  className="bg-white rounded-2xl shadow-card border border-gray-100 overflow-hidden print:break-inside-avoid print:shadow-none print:border print:border-gray-300">

                  {/* Titre — miroir du PDF */}
                  <div className="px-5 py-3 border-b border-gray-100 text-center"
                    style={{ background: 'rgba(0,102,51,0.04)' }}>
                    {/* Même titre que le PDF. « G1 » seul ne disait pas quelle
                        promotion : trois groupes portent ce nom cette année. */}
                    <p className="text-sm font-bold text-iss-dark">
                      Fiche de Présence
                      {fiche.filiere && ` — ${fiche.filiere}`}
                      {' — '}{fiche.libelle || fiche.depNom}
                    </p>
                  </div>

                  {/* Informations de la séance — mêmes champs que le PDF */}
                  <div className="px-5 py-4 border-b border-gray-100 text-sm text-iss-dark">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap">Date :</span>
                        <span>{fmtDateFr(fiche.suivi.date_suivie) || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap">Séance :</span>
                        <span className="font-bold">{fiche.suivi.type_seance_label || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap">Créneau :</span>
                        <span>{fiche.suivi.creneau_label || '—'}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="font-semibold whitespace-nowrap">Enseignant :</span>
                        <span>{fiche.suivi.prof_nom || '—'}</span>
                      </div>
                      <div className="flex gap-2 sm:col-span-2">
                        <span className="font-semibold whitespace-nowrap">Élément du module :</span>
                        <span>
                          {fiche.suivi.em_code && <span className="mr-1 text-iss-gray">{fiche.suivi.em_code}</span>}
                          {fiche.suivi.em_intitule || '—'}
                        </span>
                      </div>
                      {!surv && (
                        <div className="flex gap-2 sm:col-span-2">
                          <span className="font-semibold whitespace-nowrap">Objet du cours :</span>
                          <span className="flex-1 border-b border-dashed border-gray-300">&nbsp;</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Liste étudiants */}
                  {fiche.etudiants.length === 0 && fiche.rattaches.length === 0 && fiche.dettes.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <Users size={24} className="mx-auto mb-2 text-iss-gray/30" />
                      <p className="text-xs text-iss-gray">Aucun étudiant inscrit dans ce groupe.</p>
                      <Link href="/dashboard/absences/importer"
                        className="mt-1 inline-block text-xs text-iss-primary hover:underline">
                        → Importer les étudiants
                      </Link>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th className="w-28 text-center">Matricule</th>
                              <th>Nom et Prénom</th>
                              <th className="text-center w-24">A si absent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Une seule liste, par matricule croissant. Les
                                rattachés (du groupe, inscrits dans une autre
                                filière) et les dettes (d'un autre groupe) y sont
                                NOMMÉS comme tels : un nom venu d'ailleurs qu'on
                                prendrait pour une erreur ferait douter de la liste. */}
                            {lignesDeFiche(fiche).map(({ cle, etu, mention }, ei) => (
                              <tr key={cle} className={ei % 2 === 0 ? '' : 'bg-gray-50/50'}>
                                <td className="text-center"><code className="text-xs font-bold">{etu.matricule}</code></td>
                                <td className="font-medium text-iss-dark">
                                  {etu.nom}
                                  {mention && (
                                    <span className="ml-2 text-[11px] font-normal text-iss-gray">
                                      — {mention}
                                    </span>
                                  )}
                                </td>
                                <td className="text-center">&nbsp;</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Inscriptions non saisies : la liste est celle du groupe
                          entier. On le dit, plutôt que de la laisser passer pour
                          une liste vérifiée. */}
                      {fiche.nonVerifiee && (
                        <p className="px-5 pt-2 text-[11px] italic text-iss-gray">
                          Liste du groupe entier : les inscriptions à cet élément
                          n&apos;ont pas été saisies.
                        </p>
                      )}

                      {/* Signature unique — miroir du PDF (prof, ou surveillant si DS/ER/EF) */}
                      <div className="px-5 py-4 border-t border-gray-100" style={{ width: '40%' }}>
                        <p className="text-xs text-iss-gray mb-6">
                          {surv ? 'Nom et Signature du surveillant' : "Signature de l'enseignant"}
                        </p>
                        <div className="h-px bg-gray-300" />
                      </div>
                    </>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {fiches === null && !loading && (
        <div className="bg-white rounded-2xl p-12 shadow-card border border-gray-100 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-iss-gray/30" />
          <p className="text-sm text-iss-gray">
            Sélectionnez un semestre et une semaine puis cliquez sur <strong>Afficher</strong>.
          </p>
        </div>
      )}

      <style>{`
        @media print {
          header, aside, .no-print { display: none !important; }
          .print\\:break-inside-avoid { page-break-inside: avoid; }
        }
      `}</style>
    </div>
  );
}
