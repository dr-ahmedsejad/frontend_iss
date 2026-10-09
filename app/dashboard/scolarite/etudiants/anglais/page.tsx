'use client';

/**
 * Groupes d'anglais : deux groupes au plus par niveau, aux noms libres
 * (« Intermediate », « Advanced »…). Chaque étudiant garde son groupe
 * habituel ; pour l'anglais seul, il est affecté à l'un des groupes de son
 * niveau, pour l'année — à l'écran ou par un fichier Excel.
 * Serveur : apps/edt/anglais.py — règles de l'écran : lib/groupes-anglais.ts.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle, ArrowLeft, Check, FileSpreadsheet, Languages, Loader2, Pencil, Plus,
  Save, Search, Trash2, Upload, X,
} from 'lucide-react';
import { getStoredUser } from '@/lib/auth';
import { validateUpload } from '@/lib/file-validation';
import Badge from '@/components/ui/Badge';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import {
  anglaisApi, anglaisKeys, type GroupeAnglais, type NiveauAnglais, type ResultatAffectation,
} from '@/lib/api/anglais';
import {
  changements, ECRITS, filtrer, groupeAffiche, LIBELLES,
  type Choix, type Filtre, type Statut,
} from '@/lib/groupes-anglais';

const VERT = '#006633';
const ORDRE: Statut[] = ['affecte', 'change', 'retire', 'inchange', 'groupe_inconnu',
                         'hors_niveau', 'inconnu', 'doublon', 'vide'];

export default function GroupesAnglaisPage() {
  const toast = useToast();
  const annee = getStoredUser()?.annee_universitaire ?? '';
  const [niveauId, setNiveauId] = useState<number | null>(null);

  const tableau = useQuery({
    queryKey: anglaisKeys.tableau(annee),
    queryFn:  () => anglaisApi.tableau(annee),
    enabled:  !!annee,
  });
  const niveaux = tableau.data?.niveaux ?? [];
  const niveau = niveaux.find(n => n.id === niveauId) ?? niveaux[0] ?? null;

  return (
    <div className="max-w-5xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/etudiants"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Groupes d&apos;anglais {annee && `— ${annee}`}</h1>
          <p className="text-sm text-iss-gray">
            Pour l&apos;anglais, chaque étudiant suit l&apos;un des deux groupes de son niveau.
            Il garde son groupe habituel pour tous ses autres cours.
          </p>
        </div>
      </div>

      {!annee && <p className="text-sm text-red-600">Aucune année de travail choisie.</p>}
      {tableau.isLoading && <p className="text-sm text-iss-gray flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Chargement…</p>}
      {tableau.error && <p className="text-sm text-red-600">{(tableau.error as Error).message}</p>}

      {!!tableau.data?.groupes_sans_niveau.length && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
          <AlertTriangle size={18} className="shrink-0 mt-0.5" />
          <p>
            Ces groupes n&apos;ont pas de niveau : leurs étudiants n&apos;apparaissent pas ici —{' '}
            {tableau.data.groupes_sans_niveau.map(g => `${g.nom} (${g.etudiants})`).join(', ')}.
          </p>
        </div>
      )}

      {tableau.data && niveaux.length === 0 && (
        <p className="text-sm text-iss-gray italic">Aucun groupe avec un niveau en {annee}.</p>
      )}

      {niveaux.length > 0 && (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Niveaux">
          {niveaux.map(n => {
            const actif = niveau?.id === n.id;
            return (
              <button key={n.id} role="tab" aria-selected={actif} onClick={() => setNiveauId(n.id)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                  actif ? 'text-white border-transparent' : 'bg-white text-iss-dark border-gray-200 hover:border-iss-primary'}`}
                style={actif ? { background: VERT } : undefined}>
                {n.niveau}
                <span className={`ml-2 text-xs font-normal ${actif ? 'text-white/80' : 'text-iss-gray'}`}>
                  {n.affectes}/{n.etudiants} affectés
                </span>
              </button>
            );
          })}
        </div>
      )}

      {niveau && tableau.data && (
        <>
          <Groupes key={`g-${niveau.id}`} annee={annee} niveau={niveau}
            max={tableau.data.max_groupes} toast={toast} />
          <Etudiants key={`e-${niveau.id}`} annee={annee} niveau={niveau} toast={toast} />
        </>
      )}

      {annee && niveaux.length > 0 && <Import annee={annee} toast={toast} />}
    </div>
  );
}

type Toaster = ReturnType<typeof useToast>;

function useRafraichir() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: anglaisKeys.all });
}

// ── Les groupes du niveau ─────────────────────────────────────────────────────

function Groupes({ annee, niveau, max, toast }: {
  annee: string; niveau: NiveauAnglais; max: number; toast: Toaster;
}) {
  const rafraichir = useRafraichir();
  const [nomNouveau, setNomNouveau] = useState('');

  const creer = useMutation({
    mutationFn: () => anglaisApi.creerGroupe(annee, niveau.id, nomNouveau.trim() || undefined),
    onSuccess: (g) => { setNomNouveau(''); toast.success(`« ${g.nom} » créé.`); rafraichir(); },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <Languages size={18} className="text-iss-primary" />
        <h2 className="font-semibold text-iss-dark">Groupes d&apos;anglais de {niveau.niveau}</h2>
        <span className="text-xs text-iss-gray">({niveau.groupes.length}/{max})</span>
      </div>

      {niveau.groupes.length === 0 && (
        <p className="text-sm text-iss-gray">
          Aucun groupe d&apos;anglais pour {niveau.niveau}. Créez-en deux, puis affectez les étudiants.
        </p>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {niveau.groupes.map(g => <CarteGroupe key={g.id} groupe={g} toast={toast} />)}
      </div>

      {niveau.groupes.length < max && (
        <form className="flex flex-col sm:flex-row gap-2"
          onSubmit={e => { e.preventDefault(); creer.mutate(); }}>
          <input value={nomNouveau} onChange={e => setNomNouveau(e.target.value)} maxLength={200}
            placeholder={`Nom (facultatif) — ex. Anglais ${niveau.niveau} — Intermediate`}
            className="flex-1 px-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30" />
          <button type="submit" disabled={creer.isPending}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
            style={{ background: VERT }}>
            {creer.isPending ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Créer le groupe {niveau.groupes.length + 1}
          </button>
        </form>
      )}
    </section>
  );
}

function CarteGroupe({ groupe, toast }: { groupe: GroupeAnglais; toast: Toaster }) {
  const rafraichir = useRafraichir();
  const [edition, setEdition] = useState(false);
  const [nom, setNom] = useState(groupe.nom);

  const renommer = useMutation({
    mutationFn: () => anglaisApi.renommerGroupe(groupe.id, nom),
    onSuccess: () => { setEdition(false); rafraichir(); },
    onError: (e) => toast.error((e as Error).message),
  });
  const supprimer = useMutation({
    mutationFn: () => anglaisApi.supprimerGroupe(groupe.id),
    onSuccess: () => { toast.success(`« ${groupe.nom} » supprimé.`); rafraichir(); },
    onError: (e) => toast.error((e as Error).message),
  });

  function demanderSuppression() {
    const qui = groupe.effectif
      ? `\n\nSes ${groupe.effectif} affectation(s) seront retirées ; les étudiants gardent leur groupe habituel.`
      : '';
    if (window.confirm(`Supprimer « ${groupe.nom} » ?${qui}`)) supprimer.mutate();
  }

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-2">
      {edition ? (
        <form className="flex gap-2" onSubmit={e => { e.preventDefault(); renommer.mutate(); }}>
          <input autoFocus value={nom} onChange={e => setNom(e.target.value)} maxLength={200}
            aria-label="Nom du groupe"
            className="flex-1 min-w-0 px-2 py-1 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30" />
          <button type="submit" disabled={renommer.isPending} aria-label="Enregistrer le nom"
            className="p-1.5 rounded-lg text-emerald-700 hover:bg-emerald-50"><Check size={16} /></button>
          <button type="button" aria-label="Annuler" onClick={() => { setEdition(false); setNom(groupe.nom); }}
            className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-50"><X size={16} /></button>
        </form>
      ) : (
        <div className="flex items-start gap-2">
          <p className="flex-1 font-semibold text-iss-dark break-words">{groupe.nom}</p>
          <button type="button" onClick={() => setEdition(true)} aria-label={`Renommer ${groupe.nom}`}
            title="Renommer" className="p-1.5 rounded-lg text-iss-gray hover:bg-gray-50 hover:text-iss-primary">
            <Pencil size={14} />
          </button>
          <button type="button" onClick={demanderSuppression} disabled={supprimer.isPending}
            aria-label={`Supprimer ${groupe.nom}`} title="Supprimer"
            className="p-1.5 rounded-lg text-iss-gray hover:bg-red-50 hover:text-red-600">
            <Trash2 size={14} />
          </button>
        </div>
      )}
      <Badge label={`Groupe ${groupe.rang} · ${groupe.effectif} étudiant${groupe.effectif > 1 ? 's' : ''}`}
        variant={groupe.effectif ? 'success' : 'neutral'} />
    </div>
  );
}

// ── Les étudiants du niveau ───────────────────────────────────────────────────

function Etudiants({ annee, niveau, toast }: { annee: string; niveau: NiveauAnglais; toast: Toaster }) {
  const rafraichir = useRafraichir();
  const [choix, setChoix] = useState<Choix>({});
  const [texte, setTexte] = useState('');
  const [filtre, setFiltre] = useState<Filtre>('tous');

  const requete = useQuery({
    queryKey: anglaisKeys.etudiants(annee, niveau.id),
    queryFn:  () => anglaisApi.etudiants(annee, niveau.id),
  });
  const etudiants = requete.data?.etudiants ?? [];
  const aEnvoyer = changements(etudiants, choix);
  const visibles = filtrer(etudiants, choix, texte, filtre);
  const groupes = niveau.groupes;

  const enregistrer = useMutation({
    mutationFn: () => anglaisApi.affecter(annee, aEnvoyer),
    onSuccess: (r) => {
      const refus = r.lignes.filter(l => !ECRITS.includes(l.statut) && l.statut !== 'inchange');
      const faits = r.lignes.length - refus.length;
      if (refus.length) toast.error(`${refus.length} refusé(s) : ${refus.map(l => LIBELLES[l.statut].texte).join(', ')}.`);
      else toast.success(`${faits} affectation${faits > 1 ? 's' : ''} enregistrée${faits > 1 ? 's' : ''}.`);
      setChoix({});
      rafraichir();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function choisir(etudiantId: number, groupeId: number | null) {
    setChoix(c => ({ ...c, [etudiantId]: groupeId }));
  }
  function toutMettre(groupeId: number) {
    setChoix(c => {
      const suite = { ...c };
      visibles.forEach(e => { suite[e.id] = groupeId; });
      return suite;
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-semibold text-iss-dark">Étudiants de {niveau.niveau}</h2>
        <span className="text-xs text-iss-gray">{etudiants.length} au total</span>
      </div>

      {groupes.length === 0 ? (
        <p className="text-sm text-iss-gray">Créez d&apos;abord les groupes d&apos;anglais de {niveau.niveau}.</p>
      ) : (
        <>
          <div className="flex flex-col md:flex-row gap-2">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-iss-gray" />
              <input value={texte} onChange={e => setTexte(e.target.value)} aria-label="Rechercher"
                placeholder="Matricule, nom ou groupe habituel"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30" />
            </div>
            <div className="flex flex-wrap gap-1" aria-label="Filtre">
              {([['tous', 'Tous'], ['sans', 'Non affectés'],
                 ...groupes.map(g => [g.id, g.nom] as [number, string])] as [Filtre, string][]).map(([f, libelle]) => (
                <button key={String(f)} type="button" onClick={() => setFiltre(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold border max-w-[14rem] truncate ${
                    filtre === f ? 'text-white border-transparent' : 'bg-white text-iss-dark border-gray-200'}`}
                  style={filtre === f ? { background: VERT } : undefined}>
                  {libelle}
                </button>
              ))}
            </div>
          </div>

          {visibles.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-iss-gray">
              Mettre les {visibles.length} étudiant{visibles.length > 1 ? 's' : ''} affiché{visibles.length > 1 ? 's' : ''} dans :
              {groupes.map(g => (
                <button key={g.id} type="button" onClick={() => toutMettre(g.id)}
                  className="px-2 py-1 rounded-lg border border-gray-200 text-iss-dark hover:border-iss-primary max-w-[14rem] truncate">
                  {g.nom}
                </button>
              ))}
            </div>
          )}

          {requete.isLoading && <p className="text-sm text-iss-gray flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Chargement…</p>}
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Matricule</th><th>Nom</th><th>Groupe habituel</th><th>Filière</th>
                  <th>Groupe d&apos;anglais</th>
                </tr>
              </thead>
              <tbody>
                {visibles.map(e => {
                  const g = groupeAffiche(e, choix);
                  const modifie = e.id in choix && choix[e.id] !== e.groupe_anglais;
                  return (
                    <tr key={e.id} className={modifie ? 'bg-amber-50' : undefined}>
                      <td className="tabular-nums">{e.matricule}</td>
                      <td>
                        {e.nom}
                        {e.statut !== 'actif' && <span className="ml-2"><Badge label={e.statut} variant="neutral" /></span>}
                      </td>
                      <td>{e.groupe_habituel}</td>
                      <td>{e.filiere || '—'}</td>
                      <td>
                        <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden" role="radiogroup"
                          aria-label={`Groupe d'anglais de ${e.nom}`}>
                          {[null, ...groupes.map(x => x.id)].map(id => {
                            const actif = g === id;
                            const libelle = id === null ? '—' : `G${groupes.find(x => x.id === id)?.rang}`;
                            const titre = id === null ? 'Aucun' : groupes.find(x => x.id === id)?.nom;
                            return (
                              <button key={String(id)} type="button" role="radio" aria-checked={actif}
                                title={titre} onClick={() => choisir(e.id, id)}
                                className={`px-3 py-1 text-xs font-semibold border-r last:border-r-0 border-gray-200 ${
                                  actif ? 'text-white' : 'text-iss-dark hover:bg-gray-50'}`}
                                style={actif ? { background: id === null ? '#6b7280' : VERT } : undefined}>
                                {libelle}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!requete.isLoading && visibles.length === 0 && (
            <p className="text-sm text-iss-gray italic">Aucun étudiant ne correspond.</p>
          )}
          <p className="text-xs text-iss-gray">
            {groupes.map(g => `G${g.rang} = ${g.nom}`).join(' · ')}
          </p>

          {aEnvoyer.length > 0 && (
            <div className="sticky bottom-2 flex flex-col sm:flex-row items-center gap-2 p-3 rounded-xl bg-white border border-amber-200 shadow-card">
              <p className="flex-1 text-sm text-iss-dark">
                {aEnvoyer.length} changement{aEnvoyer.length > 1 ? 's' : ''} non enregistré{aEnvoyer.length > 1 ? 's' : ''}.
              </p>
              <button type="button" onClick={() => setChoix({})}
                className="px-4 py-2 rounded-xl text-sm font-semibold border border-gray-200 text-iss-dark hover:bg-gray-50">
                Annuler
              </button>
              <button type="button" onClick={() => enregistrer.mutate()} disabled={enregistrer.isPending}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-60"
                style={{ background: VERT }}>
                {enregistrer.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Enregistrer
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// ── L'import Excel ────────────────────────────────────────────────────────────

function Import({ annee, toast }: { annee: string; toast: Toaster }) {
  const rafraichir = useRafraichir();
  const entree = useRef<HTMLInputElement>(null);
  const [fichier, setFichier] = useState<File | null>(null);
  const [resultat, setResultat] = useState<ResultatAffectation | null>(null);


  const verifier = useMutation({
    mutationFn: () => anglaisApi.importer(annee, fichier as File, true),
    onSuccess: setResultat,
    onError: (e) => toast.error((e as Error).message),
  });
  const appliquer = useMutation({
    mutationFn: () => anglaisApi.importer(annee, fichier as File, false),
    onSuccess: (r) => {
      setResultat(r);
      const n = r.lignes.filter(l => ECRITS.includes(l.statut)).length;
      toast.success(`${n} affectation${n > 1 ? 's' : ''} enregistrée${n > 1 ? 's' : ''}.`);
      rafraichir();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  function choisir(f: File | null) {
    if (!f) return;
    const erreur = validateUpload(f, { maxSizeMb: 5, accept: '.xlsx' });
    if (erreur) { toast.error(erreur); return; }
    setFichier(f);
    setResultat(null);
  }

  const aEcrire = resultat ? resultat.lignes.filter(l => ECRITS.includes(l.statut)).length : 0;
  const tri = resultat ? [...resultat.lignes].sort((a, b) =>
    ORDRE.indexOf(a.statut) - ORDRE.indexOf(b.statut) || (a.ligne ?? 0) - (b.ligne ?? 0)) : [];
  const occupe = verifier.isPending || appliquer.isPending;

  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
      <div className="flex items-center gap-2">
        <FileSpreadsheet size={18} className="text-iss-primary" />
        <h2 className="font-semibold text-iss-dark">Affecter par un fichier Excel</h2>
      </div>
      <p className="text-sm text-iss-gray">
        Une colonne <strong>Matricule</strong> et une colonne <strong>Groupe</strong>. Le groupe s&apos;écrit
        avec son numéro (1 ou 2), son nom, ou un mot de son nom qui ne désigne que lui
        (« Advanced »). Tous niveaux mélangés : chaque étudiant va dans un groupe de son niveau.
        Le fichier est d&apos;abord vérifié, sans rien enregistrer.
      </p>

      <input ref={entree} type="file" accept=".xlsx" className="hidden"
        onChange={e => { choisir(e.target.files?.[0] ?? null); e.target.value = ''; }} />
      <div className="flex flex-col sm:flex-row gap-3">
        <button type="button" onClick={() => entree.current?.click()} disabled={occupe}
          className="flex-1 py-3 rounded-xl text-sm font-semibold border-2 border-dashed border-gray-200 text-iss-gray hover:border-iss-primary hover:text-iss-primary disabled:opacity-60">
          {fichier ? `${fichier.name} — changer` : 'Choisir le fichier (.xlsx)'}
        </button>
        <button type="button" onClick={() => verifier.mutate()} disabled={occupe || !fichier}
          className="flex-1 py-3 rounded-xl text-sm font-bold border border-iss-primary text-iss-primary inline-flex items-center justify-center gap-2 hover:bg-green-50 disabled:opacity-60">
          <Search size={16} /> {verifier.isPending ? 'Vérification…' : 'Vérifier'}
        </button>
        <button type="button" onClick={() => appliquer.mutate()}
          disabled={occupe || !resultat || !resultat.apercu || aEcrire === 0}
          className="flex-1 py-3 rounded-xl text-sm font-bold text-white inline-flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
          style={{ background: VERT }}>
          <Upload size={16} />
          {appliquer.isPending ? 'Enregistrement…' : `Enregistrer ${aEcrire} affectation${aEcrire > 1 ? 's' : ''}`}
        </button>
      </div>

      {resultat && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-iss-dark">
            {resultat.apercu ? 'Vérification — rien n’est encore enregistré' : 'Import enregistré'}
          </p>
          <div className="flex flex-wrap gap-2">
            {ORDRE.filter(s => resultat.bilan[s]).map(s => (
              <Badge key={s} label={`${resultat.bilan[s]} · ${LIBELLES[s].texte}`} variant={LIBELLES[s].variante} />
            ))}
          </div>
          <div className="overflow-x-auto max-h-96 overflow-y-auto">
            <table className="data-table">
              <thead>
                <tr><th>Ligne</th><th>Matricule</th><th>Étudiant</th><th>Écrit</th><th>Groupe</th><th>Résultat</th></tr>
              </thead>
              <tbody>
                {tri.map((l, i) => (
                  <tr key={`${l.ligne}-${i}`}>
                    <td className="tabular-nums">{l.ligne}</td>
                    <td className="tabular-nums">{l.matricule || '—'}</td>
                    <td>{l.etudiant?.nom ? `${l.etudiant.nom} (${l.etudiant.groupe_habituel || '—'})` : '—'}</td>
                    <td>{l.valeur || '—'}</td>
                    <td>{l.groupe?.nom ?? '—'}</td>
                    <td><Badge label={LIBELLES[l.statut].texte} variant={LIBELLES[l.statut].variante} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
