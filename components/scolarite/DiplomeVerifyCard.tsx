import { GraduationCap, CheckCircle2 } from 'lucide-react';
import type { DiplomeVerification } from '@/types/documents';

interface DiplomeVerifyCardProps {
  doc: DiplomeVerification;
}

/**
 * Carte de vérification publique d'un DIPLÔME (scan QR) — contenu propre au
 * diplôme (groupe, établissement, identité, libellé, NNI, matricule, date).
 * Distincte de QrVerifyCard (photo + données), conservée pour plus tard.
 */
export default function DiplomeVerifyCard({ doc }: DiplomeVerifyCardProps) {
  const rows: { label: string; value: string }[] = [
    { label: 'Nom complet',        value: doc.nom_complet },
    { label: 'Diplôme',            value: doc.diplome },
    { label: 'NNI',                value: doc.nni },
    { label: 'Matricule',          value: doc.matricule },
    { label: "Date d'obtention",   value: doc.date_obtention },
  ];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
      {/* En-tête : groupe + établissement + intitulé */}
      <div className="px-6 py-5 text-center border-b border-gray-100">
        {doc.groupe && <p className="text-sm font-semibold text-iss-primary">{doc.groupe}</p>}
        <p className="text-base font-bold text-iss-dark leading-tight">{doc.institution}</p>
        <div className="flex items-center justify-center gap-2 mt-3">
          <GraduationCap size={18} className="text-purple-600" />
          <p className="text-lg font-bold text-purple-700">{doc.type_libelle}</p>
        </div>
      </div>

      {/* Informations */}
      <div className="p-6 space-y-3">
        {rows.map(r => (
          <div key={r.label} className="flex flex-col">
            <span className="text-xs text-iss-gray">{r.label}</span>
            <span className="text-sm font-semibold text-iss-dark break-words">{r.value || '—'}</span>
          </div>
        ))}
      </div>

      {/* Bandeau d'authenticité */}
      {doc.est_valide && (
        <div className="px-6 py-3 bg-emerald-50 border-t border-emerald-100 flex items-center justify-center gap-2">
          <CheckCircle2 size={16} className="text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-700">Document authentique</span>
        </div>
      )}
    </div>
  );
}
