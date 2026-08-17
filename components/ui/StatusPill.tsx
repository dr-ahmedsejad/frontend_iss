'use client';

import type { BadgeVariant } from './Badge';

/** Mapping statut → libellé + variante de couleur */
const STATUT_MAP: Record<string, { label: string; variant: BadgeVariant }> = {
  // Preinscriptions
  soumise:            { label: 'Soumise',       variant: 'info'    },
  en_examen:          { label: 'En examen',      variant: 'warning' },
  acceptee:           { label: 'Acceptée',       variant: 'success' },
  rejetee:            { label: 'Rejetée',        variant: 'danger'  },
  inscrite:           { label: 'Inscrite',       variant: 'primary' },
  // Inscriptions admin
  en_attente:         { label: 'En attente',     variant: 'warning' },
  active:             { label: 'Active',         variant: 'success' },
  annulee:            { label: 'Annulée',        variant: 'danger'  },
  // Délibérations
  preparation:        { label: 'Préparation',    variant: 'neutral' },
  en_cours:           { label: 'En cours',       variant: 'info'    },
  validee:            { label: 'Validée',        variant: 'success' },
  cloturee:           { label: 'Clôturée',       variant: 'neutral' },
  // Résultats
  valide:             { label: 'Validé',         variant: 'success' },
  compense:           { label: 'Compensé',       variant: 'primary' },
  ajourne:            { label: 'Ajourné',        variant: 'danger'  },
  exclu:              { label: 'Exclu',          variant: 'danger'  },
  // Conventions stage
  brouillon:          { label: 'Brouillon',      variant: 'neutral' },
  terminee:           { label: 'Terminée',       variant: 'success' },
  // Étudiants
  actif:              { label: 'Actif',          variant: 'success' },
  suspendu:           { label: 'Suspendu',       variant: 'warning' },
  diplome:            { label: 'Diplômé',        variant: 'primary' },
  transfere:          { label: 'Transféré',      variant: 'info'    },
  // Dérogations
  approuvee:          { label: 'Approuvée',      variant: 'success' },
  refusee:            { label: 'Refusée',        variant: 'danger'  },
};

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-50  text-emerald-700 border-emerald-200',
  danger:  'bg-red-50      text-red-700     border-red-200',
  warning: 'bg-yellow-50   text-yellow-700  border-yellow-200',
  info:    'bg-blue-50     text-blue-700    border-blue-200',
  neutral: 'bg-gray-100   text-gray-600    border-gray-200',
  primary: 'bg-green-50   text-green-700   border-green-200',
};

interface StatusPillProps {
  statut:    string;
  size?:     'sm' | 'md';
  className?: string;
}

export default function StatusPill({ statut, size = 'sm', className = '' }: StatusPillProps) {
  const config = STATUT_MAP[statut] ?? { label: statut, variant: 'neutral' as BadgeVariant };
  const sizeClass = size === 'sm' ? 'text-[11px] px-2 py-0.5' : 'text-xs px-2.5 py-1';
  return (
    <span className={`inline-flex items-center font-semibold rounded-full border ${VARIANT_STYLES[config.variant]} ${sizeClass} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
        config.variant === 'success' ? 'bg-emerald-500' :
        config.variant === 'danger'  ? 'bg-red-500' :
        config.variant === 'warning' ? 'bg-yellow-500' :
        config.variant === 'info'    ? 'bg-blue-500' :
        config.variant === 'primary' ? 'bg-green-500' : 'bg-gray-400'
      }`} />
      {config.label}
    </span>
  );
}
