'use client';

import { CheckCircle2, XCircle, User } from 'lucide-react';
import { formatDate, formatNote } from '@/lib/formatters';
import { safeImageSrc } from '@/lib/safe-image';
import type { DocumentVerification } from '@/types/documents';

interface QrVerifyCardProps {
  document:   DocumentVerification;
  className?: string;
}

type Pill = 'ok' | 'bad' | 'accent';
interface Row { label: string; value: string | null; pill?: Pill }

// Couleur de fond des pastilles en STYLE INLINE (pas en classe Tailwind) : garantit
// le rendu même si une couleur custom (ex. iss-primary) n'est pas incluse dans le
// bundle CSS de la page publique — sinon texte blanc sur fond blanc = valeur
// invisible (cas de la mention du diplôme).
const PILL_BG: Record<Pill, string> = {
  ok:     '#059669',  // vert — Semestre validé
  bad:    '#dc2626',  // rouge — non validé
  accent: '#006633',  // vert ISS — mention diplôme
};

export default function QrVerifyCard({ document: doc, className = '' }: QrVerifyCardProps) {
  const photo       = safeImageSrc(doc.photo_url);
  const isDiplome   = doc.type_document === 'attestation_diplome' || doc.type_document === 'diplome';
  const isReleveSem = doc.type_document === 'releve_semestre';
  const isInscript  = doc.type_document === 'attestation_inscription';
  const isAttestationTravail = doc.type_document === 'attestation_travail';

  // Lignes communes : Type → identifiant → NNI → Filière
  const rows: Row[] = [
    { label: 'Type', value: doc.type_libelle },
    isDiplome
      ? { label: 'N° de diplôme',   value: doc.numero_diplome }
      : { label: 'Numéro de série', value: doc.numero_serie },
    { label: 'NNI',     value: doc.nni },
    { label: 'Filière', value: doc.filiere },
  ];

  // Champs propres au type
  if (isInscript) {
    rows.push({ label: 'Niveau', value: doc.niveau });
  }
  if (isReleveSem) {
    rows.push({ label: 'Semestre', value: doc.semestre });
    rows.push({
      label: 'Moyenne du semestre',
      value: doc.moyenne_semestre != null ? `${formatNote(doc.moyenne_semestre)} / 20` : null,
    });
    rows.push({
      label: 'Crédits obtenus',
      value: doc.credits_obtenus != null ? `${doc.credits_obtenus} / ${doc.credits_total ?? '—'}` : null,
    });
    rows.push({
      label: 'Décision finale',
      value: doc.decision,
      pill:  doc.decision === 'Semestre validé' ? 'ok' : doc.decision ? 'bad' : undefined,
    });
  }
  if (isDiplome) {
    rows.push({ label: 'Mention', value: doc.mention, pill: 'accent' });
  }
  if (isAttestationTravail) {
    rows.push({ label: 'Qualité',       value: doc.qualite ?? null });
    rows.push({ label: 'Période',       value: doc.periode ?? null });
    rows.push({ label: 'Heures éq. CM', value: doc.heures_eq_cm != null ? `${doc.heures_eq_cm} h` : null });
  }

  // Lignes communes de fin
  rows.push({ label: 'Année universitaire', value: doc.annee_universitaire });
  rows.push({ label: 'Délivré le', value: doc.date_generation ? formatDate(doc.date_generation) : null });

  const visible = rows.filter(r => r.value);

  return (
    <div className={`bg-white rounded-2xl border shadow-card overflow-hidden ${
      doc.est_valide ? 'border-emerald-200' : 'border-red-200'
    } ${className}`}>
      {/* En-tête statut */}
      <div className={`px-6 py-4 flex items-center gap-3 ${
        doc.est_valide
          ? 'bg-gradient-to-r from-emerald-500 to-emerald-600'
          : 'bg-gradient-to-r from-red-500 to-red-600'
      }`}>
        {doc.est_valide
          ? <CheckCircle2 size={28} className="text-white shrink-0" />
          : <XCircle     size={28} className="text-white shrink-0" />}
        <div>
          <p className="text-white font-bold text-lg">
            {doc.est_valide ? 'Document VALIDE' : 'Document INVALIDE'}
          </p>
          <p className="text-white/80 text-sm">
            {doc.est_valide ? 'Émis par l\'établissement, non révoqué' : 'Ce document n\'est pas reconnu'}
          </p>
        </div>
      </div>

      {/* Titulaire — photo + identité à COMPARER avec le document présenté */}
      <div className="px-6 pt-5 flex items-center gap-4">
        <div className="w-20 h-24 rounded-xl border-2 border-iss-primary/20 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
          {photo
            ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="Photo de l'étudiant" className="w-full h-full object-cover" />
            )
            : <User size={32} className="text-gray-300" />}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-iss-gray">Titulaire</p>
          <p className="text-lg font-bold text-iss-dark leading-tight">{doc.titulaire_nom ?? doc.etudiant_nom}</p>
          {doc.etudiant_matricule && <p className="text-sm text-iss-gray font-mono">{doc.etudiant_matricule}</p>}
        </div>
      </div>

      <div className="mx-6 mt-4 rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
        <p className="text-[12px] text-amber-800">
          Comparez {photo ? <><strong>la photo</strong> et les</> : <><strong>le nom</strong> et les</>} informations ci-dessous avec le document présenté.
        </p>
      </div>

      {/* Détails */}
      <div className="px-6 py-5 space-y-3">
        {visible.map(({ label, value, pill }) => (
          <div key={label} className="flex justify-between items-center gap-4">
            <p className="text-sm text-iss-gray shrink-0">{label}</p>
            {pill
              ? (
                <span
                  className="inline-block rounded-full px-2.5 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: PILL_BG[pill] }}>
                  {value}
                </span>
              )
              : <p className="text-sm font-semibold text-iss-dark text-right">{value}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
