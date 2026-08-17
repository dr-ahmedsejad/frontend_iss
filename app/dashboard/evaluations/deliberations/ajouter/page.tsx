'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save, BookOpen, CalendarDays } from 'lucide-react';
import { deliberationsApi, sessionsApi } from '@/lib/api/evaluations';
import type { SessionEvaluation, TypePV, TypeSemestre } from '@/types/evaluations';
import { filieresApi } from '@/lib/api/scolarite';
import type { Filiere } from '@/types/scolarite';
import { setFlash } from '@/lib/flash';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import FiliereSelect from '@/components/scolarite/FiliereSelect';
import AnneeSelect from '@/components/scolarite/AnneeSelect';
import { getStoredUser } from '@/lib/auth';

const NIVEAUX   = [
  { value: 1, label: 'L1 — 1ère année' },
  { value: 2, label: 'L2 — 2ème année' },
  { value: 3, label: 'L3 — 3ème année' },
];

const INPUT = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-iss-dark focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white disabled:bg-gray-50';

export default function AjouterDeliberationPage() {
  const router = useRouter();
  const toast  = useToast();

  const [typePv, setTypePv]       = useState<TypePV>('semestriel');
  const [filiere, setFiliere]     = useState<number | null>(null);
  const [niveau, setNiveau]       = useState<number>(1);
  const [session, setSession]     = useState<number | null>(null);
  const [semestreCode, setSemestreCode] = useState('S1');
  const [anneeUniv, setAnneeUniv] = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);
  const [errors, setErrors]       = useState<Record<string, string>>({});

  const [sessions, setSessions]   = useState<SessionEvaluation[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [filieres, setFilieres]   = useState<Filiere[]>([]);

  // Filières (pour borner les niveaux selon niveau_debut / niveau_fin)
  useEffect(() => {
    filieresApi.all().then(setFilieres).catch(() => {/* UI continue sans bornage */});
  }, []);

  // Annee universitaire du contexte utilisateur (filtrage automatique des sessions)
  const user          = getStoredUser();
  const anneeContexte = user?.annee_universitaire ?? '';

  useEffect(() => {
    if (typePv !== 'semestriel') return;
    setLoadingSessions(true);
    const params: Record<string, string | number> = { page_size: 100 };
    if (anneeContexte) params.annee_univ = anneeContexte;  // libellé "2023-2024"
    sessionsApi.list(params)
      .then(r => setSessions(Array.isArray(r) ? r : r.results))
      .catch(() => {})
      .finally(() => setLoadingSessions(false));
  }, [typePv, anneeContexte]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!filiere) errs.filiere = 'Requis';
    if (typePv === 'semestriel' && !session) errs.session = 'Requis';
    if (typePv === 'annuel' && !anneeUniv)   errs.annee_univ = 'Requis';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    setSaving(true);
    try {
      const body = typePv === 'semestriel'
        ? { type_pv: typePv, filiere: filiere!, niveau, session: session!, semestre_code: semestreCode }
        : { type_pv: typePv, filiere: filiere!, niveau, annee_univ: anneeUniv! };

      const delib = await deliberationsApi.create(body);
      setFlash('PV de délibération créé');
      router.push(`/dashboard/evaluations/deliberations/${delib.id}`);
    } catch (e) {
      const err = e as Error;
      try { setErrors(JSON.parse(err.message)); } catch { toast.error(err.message); }
    } finally {
      setSaving(false);
    }
  }

  // ── Cascade : filière → niveaux ; (niveau + parité de la session) → semestre ──
  const niveauOptions = (f: Filiere | null) =>
    f ? NIVEAUX.filter(n => n.value >= f.niveau_debut && n.value <= f.niveau_fin) : NIVEAUX;
  // Le semestre est DÉTERMINÉ par le niveau + la parité (type_semestre) de la session
  // choisie : L{n} Impairs → S{2n-1}, Pairs → S{2n}. (ex. L2 + session Impairs = S3)
  const computeSemestre = (parite: TypeSemestre | undefined, niv: number): string =>
    parite === 'Pairs' ? `S${2 * niv}` : `S${2 * niv - 1}`;

  const selectedFiliere      = filieres.find(f => f.id === filiere) ?? null;
  const niveauxDisponibles   = niveauOptions(selectedFiliere);
  const pariteSession        = sessions.find(s => s.id === session)?.type_semestre;
  const semestresDisponibles = pariteSession
    ? [computeSemestre(pariteSession, niveau)]
    : [`S${2 * niveau - 1}`, `S${2 * niveau}`];

  function handleFiliere(id: number | null) {
    setFiliere(id);
    const opts = niveauOptions(filieres.find(f => f.id === id) ?? null);
    const nv = opts.some(o => o.value === niveau) ? niveau : (opts[0]?.value ?? niveau);
    if (nv !== niveau) { setNiveau(nv); setSemestreCode(computeSemestre(pariteSession, nv)); }
  }
  function handleNiveau(nv: number) {
    setNiveau(nv);
    setSemestreCode(computeSemestre(pariteSession, nv));
  }
  function handleSession(id: number | null) {
    setSession(id);
    setSemestreCode(computeSemestre(sessions.find(s => s.id === id)?.type_semestre, niveau));
  }

  return (
    <div className="max-w-xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/evaluations/deliberations"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Nouveau PV de délibération</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-5">

        {/* Type de PV */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-iss-dark-soft">Type de PV <span className="text-iss-secondary">*</span></span>
          <div className="grid grid-cols-2 gap-3">
            {([
              { value: 'semestriel', label: 'Semestriel', sub: 'Session normale / rattrapage', Icon: BookOpen },
              { value: 'annuel',     label: 'Annuel',     sub: 'Progression / passage', Icon: CalendarDays },
            ] as const).map(({ value, label, sub, Icon }) => (
              <button key={value} type="button" onClick={() => setTypePv(value)}
                className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                  typePv === value
                    ? 'border-iss-primary bg-iss-primary/5'
                    : 'border-gray-200 hover:border-gray-300'
                }`}>
                <Icon size={18} className={typePv === value ? 'text-iss-primary mt-0.5' : 'text-iss-gray mt-0.5'} />
                <div>
                  <p className={`text-sm font-semibold ${typePv === value ? 'text-iss-primary' : 'text-iss-dark'}`}>{label}</p>
                  <p className="text-[11px] text-iss-gray leading-snug">{sub}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Filière + Niveau */}
        <div className="grid grid-cols-2 gap-4">
          <FiliereSelect value={filiere} onChange={handleFiliere} required error={errors.filiere} />
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-iss-dark-soft">
              Niveau <span className="text-iss-secondary">*</span>
            </label>
            <select value={niveau} onChange={e => handleNiveau(Number(e.target.value))}
              disabled={!selectedFiliere} className={INPUT}>
              {niveauxDisponibles.map(n => <option key={n.value} value={n.value}>{n.label}</option>)}
            </select>
          </div>
        </div>

        {/* Champs selon type_pv */}
        {typePv === 'semestriel' ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-iss-dark-soft">
                Session <span className="text-iss-secondary">*</span>
              </label>
              <select value={session ?? ''} onChange={e => handleSession(Number(e.target.value) || null)}
                disabled={loadingSessions} required
                className={`${INPUT} ${errors.session ? 'border-red-400' : ''}`}>
                <option value="">{loadingSessions ? 'Chargement…' : 'Sélectionner'}</option>
                {sessions.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.type_session === 'rattrapage' ? 'Rattrapage' : 'Normale'} — {s.type_semestre} — {s.annee_universitaire}
                  </option>
                ))}
              </select>
              {errors.session && <p className="text-[11px] text-red-600 font-medium">{errors.session}</p>}
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-iss-dark-soft">
                Semestre <span className="text-iss-secondary">*</span>
              </label>
              <select value={semestreCode} disabled className={INPUT}
                title="Déterminé par le niveau et la parité de la session">
                {semestresDisponibles.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <AnneeSelect value={anneeUniv} onChange={setAnneeUniv} required error={errors.annee_univ} />
        )}

        <div className="flex gap-3 pt-1">
          <Link href="/dashboard/evaluations/deliberations"
            className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray text-center hover:bg-gray-50">
            Annuler
          </Link>
          <button type="submit" disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Save size={16} />
            {saving ? 'Création…' : 'Créer le PV'}
          </button>
        </div>
      </form>
    </div>
  );
}
