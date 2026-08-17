'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, Trophy, Calculator, Loader2, AlertCircle, Download, Award } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { classementStageApi, type ClassementResponse, type ClassementItem } from '@/lib/api/stages';
import { filieresApi, semestresApi, yearsApi } from '@/lib/api/scolarite';
import type { Filiere, Semestre } from '@/types/scolarite';

const INPUT  = 'w-full px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary';
const LABEL  = 'block text-xs font-bold text-iss-gray uppercase tracking-wide mb-1';

interface Year { id: number; annee: string; est_active: boolean; }

const PRESETS: { label: string; type_stage: 'L2' | 'PFE'; niveau: number; semestres_codes: string[] }[] = [
  { label: 'Stage L2 (basé sur S1 + S2 + S3)',         type_stage: 'L2',  niveau: 2, semestres_codes: ['S1', 'S2', 'S3'] },
  { label: 'PFE (basé sur S1 + S2 + S3 + S4 + S5)',    type_stage: 'PFE', niveau: 3, semestres_codes: ['S1', 'S2', 'S3', 'S4', 'S5'] },
];

export default function ClassementStagePage() {
  const toast = useToast();

  const [filieres, setFilieres] = useState<Filiere[]>([]);
  const [years, setYears]       = useState<Year[]>([]);
  const [semestres, setSemestres] = useState<Semestre[]>([]);

  const [filiereId, setFiliereId] = useState<number | ''>('');
  const [niveau, setNiveau]       = useState<number | ''>('');
  const [annee, setAnnee]         = useState<string>('');
  const [typeStage, setTypeStage] = useState<'L2' | 'PFE' | ''>('');
  const [semestresIds, setSemestresIds] = useState<Set<number>>(new Set());

  const [computing, setComputing] = useState(false);
  const [result, setResult] = useState<ClassementResponse | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  // Charger filieres + annees + semestres
  useEffect(() => {
    Promise.all([
      filieresApi.all(),
      yearsApi.list(),
      semestresApi.all(),
    ]).then(([f, y, s]) => {
      setFilieres(f);
      setYears(y.results.map(yr => ({ id: yr.id, annee: yr.annee, est_active: yr.est_active })));
      setSemestres(s);
      // Defaut : annee active (precedente -> source notes pour le stage)
      const active = y.results.find(yr => yr.est_active);
      if (active) {
        // Pour le classement, on prend les notes de l'annee precedente
        const prevYear = y.results.find(yr => yr.annee < active.annee);
        setAnnee(prevYear?.annee ?? active.annee);
      }
    }).catch(() => {});
  }, []);

  // Les semestres sont generiques (S1, S2, ...) — on les expose tous.
  // Tri par code semestre puis dedup par code (un meme code peut exister en
  // plusieurs entrees pour les paires Impairs/Pairs vs Niveau).
  const semestresFiltered = useMemo(() => {
    const sorted = [...semestres].sort((a, b) => (a.code_semestre || '').localeCompare(b.code_semestre || ''));
    return sorted;
  }, [semestres]);

  function applyPreset(preset: typeof PRESETS[0]) {
    setTypeStage(preset.type_stage);
    setNiveau(preset.niveau);
    // Cocher les semestres correspondants (tout code matchant le preset)
    const ids = new Set<number>();
    for (const s of semestres) {
      if (preset.semestres_codes.includes(s.code_semestre || '')) {
        ids.add(s.id);
      }
    }
    setSemestresIds(ids);
  }

  function toggleSemestre(id: number) {
    const next = new Set(semestresIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSemestresIds(next);
  }

  async function compute() {
    setError('');
    if (!filiereId || !niveau || !annee || semestresIds.size === 0) {
      setError('Sélectionnez filière, niveau, année et au moins un semestre.');
      return;
    }
    setComputing(true);
    try {
      const data = await classementStageApi.calculer({
        filiere: filiereId as number,
        niveau_cible: niveau as number,
        annee_univ: annee,
        semestres: Array.from(semestresIds),
        type_stage: typeStage || undefined,
      });
      setResult(data);
      toast.success(`${data.total_etudiants} étudiants classés`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setComputing(false);
    }
  }

  async function exportExcel() {
    if (!result) return;
    if (!filiereId || !niveau || !annee || semestresIds.size === 0) return;
    setDownloading(true);
    try {
      const blob = await classementStageApi.excel({
        filiere: filiereId as number,
        niveau_cible: niveau as number,
        annee_univ: annee,
        semestres: Array.from(semestresIds),
        type_stage: typeStage || undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `classement-${result.filiere_code}-${result.annee_univ}-L${result.niveau}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 200);
      toast.success('Fichier Excel téléchargé');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  }

  function rangBadge(item: ClassementItem) {
    if (item.rang === null) return <span className="text-slate-400">—</span>;
    if (item.rang === 1) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-100 text-amber-800 font-bold text-xs">🥇</span>;
    if (item.rang === 2) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 text-gray-700 font-bold text-xs">🥈</span>;
    if (item.rang === 3) return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 font-bold text-xs">🥉</span>;
    return <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-slate-100 text-slate-600 font-medium text-xs">{item.rang}</span>;
  }

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/stages" className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #B8860B, #D4AF37)' }}>
          <Trophy size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Classement pour attribution des stages</h1>
          <p className="text-sm text-iss-gray">Moyenne arithmétique simple des moyennes des semestres choisis</p>
        </div>
      </div>

      {/* ── Presets rapides ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-4">
        <p className="text-xs font-bold text-iss-gray uppercase tracking-wide mb-2">Modèles rapides</p>
        <div className="flex flex-wrap gap-2">
          {PRESETS.map(p => (
            <button key={p.label} onClick={() => applyPreset(p)}
              disabled={!filiereId}
              className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-medium hover:bg-iss-primary/5 hover:border-iss-primary/40 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              <Award size={12} className="inline mr-1" />
              {p.label}
            </button>
          ))}
        </div>
        {!filiereId && <p className="text-xs text-iss-gray mt-2">Sélectionne une filière d&apos;abord pour pouvoir appliquer un modèle.</p>}
      </div>

      {/* ── Formulaire de selection ────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-4">
        <p className="text-xs font-bold text-iss-gray uppercase tracking-wide">Paramètres du classement</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className={LABEL}>Filière *</label>
            <select className={INPUT} value={filiereId}
              onChange={e => { setFiliereId(e.target.value === '' ? '' : Number(e.target.value)); setSemestresIds(new Set()); }}>
              <option value="">— choisir —</option>
              {filieres.map(f => <option key={f.id} value={f.id}>{f.intitule_fr}</option>)}
            </select>
          </div>
          <div>
            <label className={LABEL}>Niveau de l&apos;inscription *</label>
            <select className={INPUT} value={niveau}
              onChange={e => setNiveau(e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">— choisir —</option>
              <option value={1}>L1</option>
              <option value={2}>L2</option>
              <option value={3}>L3</option>
            </select>
          </div>
          <div>
            <label className={LABEL}>Année universitaire (source des notes) *</label>
            <select className={INPUT} value={annee}
              onChange={e => setAnnee(e.target.value)}>
              <option value="">— choisir —</option>
              {years.map(y => (
                <option key={y.id} value={y.annee}>{y.annee}{y.est_active ? ' (active)' : ''}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Semestres */}
        <div>
          <label className={LABEL}>Semestres à inclure dans le calcul *</label>
          {filiereId === '' ? (
            <p className="text-xs text-iss-gray italic">Sélectionne une filière pour voir les semestres disponibles.</p>
          ) : semestresFiltered.length === 0 ? (
            <p className="text-xs text-amber-600">Aucun semestre trouvé pour cette filière.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {semestresFiltered.map(s => {
                const checked = semestresIds.has(s.id);
                return (
                  <button key={s.id} onClick={() => toggleSemestre(s.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-colors ${
                      checked
                        ? 'bg-iss-primary text-white border border-iss-primary'
                        : 'bg-white text-iss-gray border border-gray-200 hover:bg-gray-50'
                    }`}>
                    {s.code_semestre} ({s.credits ?? 30} cr)
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-xs text-iss-gray mt-2">
            Le classement utilise la <strong>moyenne arithmétique simple</strong> :
            chaque semestre compte pour 1. Formule : <code className="px-1 bg-gray-100 rounded">(moy_S1 + moy_S2 + ...) / nombre_semestres</code>.
            Pour chaque semestre : SR si clôturée (max SN/SR appliqué), sinon SN.
          </p>
        </div>

        {/* Bouton calculer */}
        <div className="flex justify-end pt-2">
          <button onClick={compute} disabled={computing || !filiereId || !niveau || !annee || semestresIds.size === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {computing ? <Loader2 size={15} className="animate-spin" /> : <Calculator size={15} />}
            Calculer le classement
          </button>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-sm text-red-700">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* ── Resultats ──────────────────────────────────────────────────── */}
      {result && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
          <div className="px-5 py-4 bg-linear-to-r from-amber-50 to-yellow-50 border-b border-amber-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-iss-dark">
                Classement {result.type_stage && `(${result.type_stage})`} — {result.filiere}
              </h2>
              <p className="text-xs text-iss-gray mt-0.5">
                Niveau L{result.niveau} · {result.annee_univ} · Semestres : {result.semestres_inclus.join(', ')} · {result.total_etudiants} étudiants
              </p>
            </div>
            <button onClick={exportExcel} disabled={downloading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-50">
              {downloading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
              Télécharger Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-iss-gray">
                <tr>
                  <th className="text-center  p-2.5 border-b w-16">Rang</th>
                  <th className="text-left    p-2.5 border-b">Matricule</th>
                  <th className="text-left    p-2.5 border-b">Étudiant</th>
                  <th className="text-center  p-2.5 border-b">Genre</th>
                  <th className="text-right   p-2.5 border-b">Moyenne /20</th>
                  <th className="text-right   p-2.5 border-b">Crédits</th>
                  <th className="text-left    p-2.5 border-b">Détail par semestre</th>
                  <th className="text-center  p-2.5 border-b">Statut</th>
                </tr>
              </thead>
              <tbody>
                {result.items.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-iss-gray">Aucun étudiant trouvé pour ces critères.</td></tr>
                ) : result.items.map(item => (
                  <tr key={item.etudiant_id} className={`border-b border-gray-50 ${item.rang && item.rang <= 3 ? 'bg-amber-50/30' : ''}`}>
                    <td className="p-2.5 text-center">{rangBadge(item)}</td>
                    <td className="p-2.5 font-mono text-xs font-semibold">{item.matricule}</td>
                    <td className="p-2.5">
                      <div className="font-medium">{item.nom} {item.prenom}</div>
                    </td>
                    <td className="p-2.5 text-center text-xs">{item.genre}</td>
                    <td className="p-2.5 text-right tabular-nums font-bold">
                      {item.moyenne ? Number(item.moyenne).toFixed(2) : <span className="text-slate-400">—</span>}
                    </td>
                    <td className="p-2.5 text-right tabular-nums text-xs">{item.credits_valides}</td>
                    <td className="p-2.5">
                      <div className="flex flex-wrap gap-1">
                        {item.details.map(d => (
                          <span key={d.semestre}
                            className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                              d.moyenne === null
                                ? 'bg-red-50 text-red-600 border border-red-200'
                                : d.est_admis
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}
                            title={d.moyenne ? `${d.semestre} : ${d.moyenne}/20` : `${d.semestre} : pas de note`}>
                            {d.semestre}: {d.moyenne ? Number(d.moyenne).toFixed(2) : '—'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="p-2.5 text-center text-xs">
                      {!item.donnees_completes ? (
                        <span className="text-red-500" title={`Manque : ${item.semestres_manquants.join(', ')}`}>Incomplet</span>
                      ) : item.tous_semestres_valides ? (
                        <span className="text-emerald-600">Validé</span>
                      ) : (
                        <span className="text-amber-600">Partiel</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
