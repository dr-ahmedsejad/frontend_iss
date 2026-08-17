'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ClipboardList, PlusCircle, BookOpen, Users,
  RefreshCw, Building2, Loader2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

interface StatsData {
  semaines_generees: number[];
}

const CARDS = [
  {
    href:    '/dashboard/suivi/ajouter',
    icon:    PlusCircle,
    label:   'Ajouter suivi',
    desc:    'Générer le suivi d\'une semaine depuis l\'EDT',
    color:   '#006633',
  },
  {
    href:    '/dashboard/suivi/remplissage',
    icon:    ClipboardList,
    label:   'Remplissage',
    desc:    'Marquer les séances Fait / Non fait semaine par semaine',
    color:   '#006633',
  },
  {
    href:    '/dashboard/suivi/fiches-individuelles',
    icon:    BookOpen,
    label:   'Fiches individuelles',
    desc:    'Fiche de présence par semestre et par semaine',
    color:   '#1a5c8f',
  },
  {
    href:    '/dashboard/suivi/fiches-collectives',
    icon:    Users,
    label:   'Fiches collectives',
    desc:    'Fiches de présence tous semestres confondus',
    color:   '#1a5c8f',
  },
  {
    href:    '/dashboard/suivi/rattrapage',
    icon:    RefreshCw,
    label:   'Rattrapage',
    desc:    'Consulter et corriger les séances non réalisées',
    color:   '#C82020',
  },
  {
    href:    '/dashboard/suivi/charges',
    icon:    Building2,
    label:   'Charges GP',
    desc:    'Charges d\'enseignement en institution partenaire',
    color:   '#7c3aed',
  },
];

export default function SuiviPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';
  const ts    = user?.semestre === 'Pairs' ? 'P' : 'I';

  const semainesQuery = useQuery({
    queryKey: ['suivi', 'semaines-generees', annee, ts] as const,
    queryFn:  async () => {
      const res = await apiFetch<StatsData>(
        `/api/v1/suivi/suivies/semaines-generees/?annee_universitaire=${annee}&type_semestre=${ts}`,
      ).catch(() => ({ semaines_generees: [] as number[] }));
      return res?.semaines_generees ?? [];
    },
    enabled: !!annee,
  });
  const semaines = semainesQuery.data ?? null;
  const loading  = semainesQuery.isLoading;

  const derniereSemaine = semaines && semaines.length > 0
    ? Math.max(...semaines)
    : null;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <ClipboardList size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Suivi des séances</h1>
          <p className="text-xs text-iss-gray">
            {annee ? `${annee} — ${ts === 'P' ? 'Semestre Pairs' : 'Semestre Impairs'}` : 'Chargement…'}
          </p>
        </div>
      </div>

      {/* Stats rapides */}
      {annee && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">

          <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 text-center">
            <p className="text-xs text-iss-gray mb-1">Semaines générées</p>
            {loading ? (
              <Loader2 size={20} className="animate-spin text-iss-primary mx-auto mt-1" />
            ) : (
              <p className="text-3xl font-extrabold" style={{ color: '#006633' }}>
                {semaines?.length ?? '—'}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 text-center">
            <p className="text-xs text-iss-gray mb-1">Dernière semaine</p>
            {loading ? (
              <Loader2 size={20} className="animate-spin text-iss-primary mx-auto mt-1" />
            ) : (
              <p className="text-3xl font-extrabold" style={{ color: '#006633' }}>
                {derniereSemaine !== null ? `S${derniereSemaine}` : '—'}
              </p>
            )}
          </div>

          <div className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 text-center col-span-2 sm:col-span-1">
            <p className="text-xs text-iss-gray mb-2">Progression des semaines</p>
            {loading || semaines === null ? (
              <Loader2 size={20} className="animate-spin text-iss-primary mx-auto" />
            ) : semaines.length === 0 ? (
              <p className="text-xs text-iss-gray/50 mt-1">Aucune semaine</p>
            ) : (
              <div className="flex flex-wrap gap-1 justify-center">
                {semaines.map(s => (
                  <Link
                    key={s}
                    href="/dashboard/suivi/remplissage"
                    className="px-2 py-0.5 rounded-lg text-xs font-semibold text-white"
                    style={{ background: '#006633' }}
                  >
                    S{s}
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* Cartes de navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {CARDS.map(({ href, icon: Icon, label, desc, color }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all group flex gap-4 items-start"
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}>
              <Icon size={18} className="text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-iss-dark mb-0.5">{label}</p>
              <p className="text-xs text-iss-gray leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {!annee && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-4 text-sm text-yellow-800">
          Année universitaire non définie dans votre profil.
        </div>
      )}
    </div>
  );
}
