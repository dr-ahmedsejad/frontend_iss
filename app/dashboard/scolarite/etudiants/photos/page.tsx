'use client';

/**
 * Photos des étudiants, déposées en une fois : chaque fichier porte le
 * matricule de son étudiant (« 24607.jpg »). On vérifie d'abord (aperçu, rien
 * n'est écrit), puis on enregistre. Les fichiers partent par paquets.
 * Serveur : apps/absence/photos.py — règles de l'écran : lib/photos-etudiants.ts.
 */
import { useRef, useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Camera, CheckCircle2, ImagePlus, Search, Upload } from 'lucide-react';
import { apiUpload } from '@/lib/api';
import Badge from '@/components/ui/Badge';
import {
  LIBELLES, paquets, preparer, type Ligne, type Statut,
} from '@/lib/photos-etudiants';

const URL_PHOTOS = '/api/v1/absences/photos-etudiants/';
const ORDRE: Statut[] = ['posee', 'remplacee', 'deja_photo', 'inconnu', 'doublon', 'invalide', 'trop_lourd'];

interface Reponse { apercu: boolean; lignes: Ligne[]; bilan: Partial<Record<Statut, number>> }

export default function PhotosEtudiantsPage() {
  const qc = useQueryClient();
  const entree = useRef<HTMLInputElement>(null);
  const [fichiers, setFichiers] = useState<File[]>([]);
  const [remplacer, setRemplacer] = useState(false);
  const [avancement, setAvancement] = useState<{ fait: number; total: number } | null>(null);
  const [lignes, setLignes] = useState<Ligne[] | null>(null);
  const [enregistre, setEnregistre] = useState(false);

  /** Envoie les fichiers acceptables par paquets ; renvoie toutes les lignes. */
  async function envoyer(apercu: boolean, aEnvoyer: File[], refuses: Ligne[]): Promise<Ligne[]> {
    const lots = paquets(aEnvoyer);
    const resultat: Ligne[] = [...refuses];
    setAvancement({ fait: 0, total: aEnvoyer.length });
    let fait = 0;
    for (const lot of lots) {
      const fd = new FormData();
      lot.forEach(f => fd.append('photos', f, f.name));
      if (remplacer) fd.append('remplacer', '1');
      if (apercu) fd.append('apercu', '1');
      const r = await apiUpload<Reponse>(URL_PHOTOS, fd);
      resultat.push(...r.lignes);
      fait += lot.length;
      setAvancement({ fait, total: aEnvoyer.length });
    }
    return resultat;
  }

  const verifier = useMutation({
    mutationFn: () => {
      const { aEnvoyer, refuses } = preparer(fichiers);
      return envoyer(true, aEnvoyer, refuses);
    },
    onMutate: () => { setLignes(null); setEnregistre(false); },
    onSuccess: setLignes,
    onSettled: () => setAvancement(null),
  });

  const enregistrer = useMutation({
    mutationFn: () => {
      // Seuls les fichiers que l'aperçu a jugés bons repartent.
      const bons = new Set((lignes ?? [])
        .filter(l => l.statut === 'posee' || l.statut === 'remplacee').map(l => l.fichier));
      const aEnvoyer = fichiers.filter(f => bons.has(f.name));
      const autres = (lignes ?? []).filter(l => !bons.has(l.fichier));
      return envoyer(false, aEnvoyer, autres);
    },
    onSuccess: (res) => {
      setLignes(res);
      setEnregistre(true);
      qc.invalidateQueries({ queryKey: ['scolarite', 'etudiants'] });
    },
    onSettled: () => setAvancement(null),
  });

  const occupe = verifier.isPending || enregistrer.isPending;
  const erreur = (verifier.error || enregistrer.error) as Error | null;
  const bilan = (lignes ?? []).reduce<Partial<Record<Statut, number>>>(
    (b, l) => ({ ...b, [l.statut]: (b[l.statut] ?? 0) + 1 }), {});
  const aPoser = (bilan.posee ?? 0) + (bilan.remplacee ?? 0);
  const tri = [...(lignes ?? [])].sort((a, b) =>
    ORDRE.indexOf(a.statut) - ORDRE.indexOf(b.statut) || a.matricule.localeCompare(b.matricule));

  function choisir(liste: FileList | null) {
    setFichiers(Array.from(liste ?? []));
    setLignes(null);
    setEnregistre(false);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5 p-2">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/etudiants"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-xl font-bold text-iss-dark">Photos des étudiants</h1>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-5">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100">
          <Camera size={20} className="text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-700 space-y-1">
            <p className="font-semibold">Chaque photo porte le matricule de son étudiant</p>
            <p className="text-xs leading-relaxed">
              Exemple : <code className="bg-blue-100 px-1 rounded">24607.jpg</code> va à l&apos;étudiant
              de matricule 24607. Formats : jpg, jpeg, png, webp — 5 Mo au plus par photo.
              Sélectionnez toutes les photos d&apos;un coup ; elles sont d&apos;abord vérifiées,
              rien n&apos;est enregistré avant votre confirmation.
            </p>
          </div>
        </div>

        <input ref={entree} type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          className="hidden" onChange={e => choisir(e.target.files)} />
        <button type="button" onClick={() => entree.current?.click()} disabled={occupe}
          className="w-full border-2 border-dashed border-gray-200 rounded-xl p-6 flex flex-col items-center gap-2 text-iss-gray hover:border-iss-primary hover:text-iss-primary transition-colors disabled:opacity-60">
          <ImagePlus size={28} />
          <span className="text-sm font-semibold">
            {fichiers.length ? `${fichiers.length} photo${fichiers.length > 1 ? 's' : ''} sélectionnée${fichiers.length > 1 ? 's' : ''} — changer` : 'Choisir les photos'}
          </span>
        </button>

        <label className="flex items-center gap-2 text-sm text-iss-dark">
          <input type="checkbox" checked={remplacer} disabled={occupe}
            onChange={e => { setRemplacer(e.target.checked); setLignes(null); setEnregistre(false); }} />
          Remplacer les photos déjà présentes
          <span className="text-xs text-iss-gray">(sinon, seuls les étudiants sans photo en reçoivent une)</span>
        </label>

        {avancement && (
          <div className="space-y-1">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all"
                style={{ width: `${avancement.total ? Math.round(avancement.fait / avancement.total * 100) : 100}%`,
                         background: 'linear-gradient(90deg, #006633, #008844)' }} />
            </div>
            <p className="text-xs text-iss-gray text-right">{avancement.fait} / {avancement.total}</p>
          </div>
        )}

        {erreur && <p className="text-sm text-red-600">{erreur.message}</p>}

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => verifier.mutate()} disabled={occupe || !fichiers.length}
            className="flex-1 py-3 rounded-xl text-sm font-bold border border-iss-primary text-iss-primary flex items-center justify-center gap-2 hover:bg-green-50 disabled:opacity-60">
            <Search size={16} />
            {verifier.isPending ? 'Vérification…' : 'Vérifier'}
          </button>
          <button onClick={() => enregistrer.mutate()} disabled={occupe || !lignes || enregistre || aPoser === 0}
            className="flex-1 py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <Upload size={16} />
            {enregistrer.isPending ? 'Enregistrement…' : `Enregistrer ${aPoser} photo${aPoser > 1 ? 's' : ''}`}
          </button>
        </div>
      </div>

      {lignes && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
          <div className="flex items-center gap-2">
            {enregistre && <CheckCircle2 size={18} className="text-emerald-600" />}
            <h2 className="font-semibold text-iss-dark">
              {enregistre ? 'Photos enregistrées' : 'Vérification — rien n’est encore enregistré'}
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {ORDRE.filter(s => bilan[s]).map(s => (
              <Badge key={s} label={`${bilan[s]} · ${LIBELLES[s].texte}`} variant={LIBELLES[s].variante} />
            ))}
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Fichier</th><th>Étudiant</th><th>Groupe</th><th>Résultat</th></tr>
              </thead>
              <tbody>
                {tri.map((l, i) => (
                  <tr key={`${l.fichier}-${i}`}>
                    <td><code className="text-xs">{l.fichier}</code></td>
                    <td>{l.etudiant ? `${l.etudiant.matricule} — ${l.etudiant.nom}` : '—'}</td>
                    <td>{l.etudiant?.groupe || '—'}</td>
                    <td><Badge label={LIBELLES[l.statut].texte} variant={LIBELLES[l.statut].variante} /></td>
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
