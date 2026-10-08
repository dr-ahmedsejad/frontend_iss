'use client';

/**
 * Relevés d'étudiants : tous les relevés de notes d'un ou de plusieurs
 * étudiants, semestre par semestre, imprimés d'un coup dans UN seul PDF
 * (étudiant par étudiant, dans l'ordre de sélection). Les étudiants choisis
 * s'affichent en pastilles, comme des destinataires de courriel ; × les retire.
 * Chaque relevé reste un document officiel (numéro + QR) ; un relevé déjà émis
 * garde son numéro. Les semestres sans résultat sont montrés, pas imprimés.
 * Serveur : apps/documents/releves_etudiant.py.
 */
import { useState } from 'react';
import Link from 'next/link';
import { useMutation, useQueries } from '@tanstack/react-query';
import { ArrowLeft, FileStack, Loader2, Printer, X } from 'lucide-react';
import { documentsApi, type RelevesEtudiant } from '@/lib/api/documents';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import Badge from '@/components/ui/Badge';
import EtudiantPicker from '@/components/scolarite/EtudiantPicker';
import type { Etudiant } from '@/types/scolarite';

const MAX_ETUDIANTS = 60;   // même borne que le serveur

function fmtMoyenne(m: number | null): string {
  return m === null ? '—' : m.toFixed(2).replace('.', ',');
}

function nomDe(e: Etudiant): string {
  return `${e.prenom_fr ?? ''} ${e.nom_fr ?? ''}`.trim() || e.matricule;
}

export default function RelevesEtudiantPage() {
  const toast = useToast();
  const [etudiants, setEtudiants] = useState<Etudiant[]>([]);

  function ajouter(e: Etudiant | null) {
    if (!e) return;
    if (etudiants.some(x => x.id === e.id)) {
      toast.info?.(`${nomDe(e)} est déjà dans la liste.`);
      return;
    }
    if (etudiants.length >= MAX_ETUDIANTS) {
      toast.error(`${MAX_ETUDIANTS} étudiants au plus par impression.`);
      return;
    }
    setEtudiants(l => [...l, e]);
  }
  const retirer = (id: number) => setEtudiants(l => l.filter(x => x.id !== id));

  const apercus = useQueries({
    queries: etudiants.map(e => ({
      queryKey: ['documents', 'releves-etudiant', e.id] as const,
      queryFn:  () => documentsApi.relevesEtudiant(e.id),
    })),
  });
  const chargement = apercus.some(q => q.isLoading);
  const aImprimer = apercus.reduce(
    (n, q) => n + (q.data?.semestres.filter(s => s.a_des_resultats).length ?? 0), 0);

  const imprimer = useMutation({
    mutationFn: () => documentsApi.genererRelevesEtudiants(etudiants.map(e => e.id)),
    onSuccess: ({ blob, generated, sansReleve }) => {
      const url = URL.createObjectURL(blob);
      // Ouvert dans un onglet pour l'imprimer d'un coup ; téléchargé si le
      // navigateur bloque l'ouverture.
      const onglet = window.open(url, '_blank');
      if (!onglet) {
        const a = document.createElement('a');
        a.href = url;
        a.download = etudiants.length === 1
          ? `releves_${etudiants[0].matricule}.pdf`
          : `releves_${etudiants.length}_etudiants.pdf`;
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success(`${generated} relevé${generated > 1 ? 's' : ''} dans un seul PDF`
        + (sansReleve.length ? ` — sans relevé : ${sansReleve.join(', ')}.` : '.'));
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-5 p-2">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex items-center gap-3">
        <Link href="/dashboard/documents/generer"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Relevés d&apos;étudiants</h1>
          <p className="text-sm text-iss-gray">
            Tous les relevés de notes d&apos;un ou de plusieurs étudiants, dans un seul PDF à imprimer d&apos;un coup.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-4">
        <div className="space-y-2">
          <p className="text-sm font-medium text-iss-dark-soft">
            Étudiants <span className="text-iss-gray font-normal">({etudiants.length})</span>
          </p>
          {etudiants.length > 0 && (
            <div className="flex flex-wrap gap-2" aria-label="Étudiants choisis">
              {etudiants.map(e => (
                <span key={e.id}
                  className="inline-flex items-center gap-1.5 pl-1 pr-1.5 py-1 rounded-full border border-iss-primary/30 bg-green-50 text-xs text-iss-dark max-w-full">
                  <span className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: '#006633' }} aria-hidden="true">
                    {(e.prenom_fr || e.nom_fr || '?').charAt(0).toUpperCase()}
                  </span>
                  <span className="truncate">{nomDe(e)}</span>
                  <span className="text-iss-gray tabular-nums">{e.matricule}</span>
                  <button type="button" onClick={() => retirer(e.id)}
                    aria-label={`Retirer ${nomDe(e)}`} title="Retirer"
                    className="w-5 h-5 rounded-full flex items-center justify-center text-iss-gray hover:bg-white hover:text-iss-secondary focus:outline-none focus:ring-2 focus:ring-iss-primary/30">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Chaque choix ajoute une pastille ; le champ se vide pour le suivant. */}
          <EtudiantPicker label="" value={null} onChange={ajouter} />
        </div>

        {chargement && (
          <p className="text-sm text-iss-gray flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Lecture des semestres…
          </p>
        )}

        {etudiants.length > 0 && (
          <button onClick={() => imprimer.mutate()} disabled={imprimer.isPending || chargement || aImprimer === 0}
            className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-60"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            {imprimer.isPending ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
            {imprimer.isPending
              ? 'Préparation du PDF…'
              : aImprimer === 0
                ? 'Aucun relevé à imprimer'
                : `Imprimer ${aImprimer} relevé${aImprimer > 1 ? 's' : ''}`
                  + (etudiants.length > 1 ? ` de ${etudiants.length} étudiants` : '')
                  + ' (un seul PDF)'}
          </button>
        )}
        <p className="text-xs text-iss-gray flex items-center gap-1.5">
          <FileStack size={13} />
          Chaque relevé est un document officiel numéroté avec son QR de vérification ;
          un relevé déjà émis garde son numéro.
        </p>
      </div>

      {etudiants.map((e, k) => (
        <ApercuEtudiant key={e.id} etudiant={e} donnees={apercus[k]?.data}
          erreur={apercus[k]?.error as Error | null} onRetirer={() => retirer(e.id)} />
      ))}
    </div>
  );
}

function ApercuEtudiant({ etudiant, donnees, erreur, onRetirer }: {
  etudiant: Etudiant; donnees?: RelevesEtudiant; erreur: Error | null; onRetirer: () => void;
}) {
  const semestres = donnees?.semestres ?? [];
  const n = semestres.filter(s => s.a_des_resultats).length;
  return (
    <section className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <h2 className="font-semibold text-iss-dark">{nomDe(etudiant)}</h2>
        <span className="text-sm text-iss-gray tabular-nums">{etudiant.matricule}</span>
        {donnees && <Badge label={`${n} relevé${n > 1 ? 's' : ''} imprimé${n > 1 ? 's' : ''}`}
                           variant={n ? 'success' : 'neutral'} />}
        <button type="button" onClick={onRetirer}
          className="ml-auto text-xs text-iss-gray hover:text-iss-secondary inline-flex items-center gap-1">
          <X size={12} /> Retirer
        </button>
      </div>
      {erreur && <p className="text-sm text-red-600">{erreur.message}</p>}
      {donnees && (semestres.length === 0 ? (
        <p className="text-sm text-iss-gray italic">Aucune inscription pédagogique pour cet étudiant.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th className="text-center">Année</th><th className="text-center">Semestre</th>
                <th className="text-center">Filière</th><th className="text-center">Moyenne</th>
                <th className="text-center">Décision</th><th className="text-center">Relevé</th>
              </tr>
            </thead>
            <tbody>
              {semestres.map(s => (
                <tr key={`${s.annee_universitaire}-${s.semestre}`}>
                  <td className="text-center">{s.annee_universitaire}</td>
                  <td className="text-center font-semibold">{s.semestre_code}</td>
                  <td className="text-center">{s.filiere || '—'}</td>
                  <td className="text-center tabular-nums">{fmtMoyenne(s.moyenne)}</td>
                  <td className="text-center">{s.decision ?? '—'}</td>
                  <td className="text-center">
                    {s.a_des_resultats
                      ? <Badge label="Imprimé" variant="success" />
                      : <Badge label="Sans résultat — non imprimé" variant="neutral" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </section>
  );
}
