'use client';

import React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  UserX, Upload, ClipboardCheck, Search,
  FileText, BarChart2, BookOpen, Loader2, ShieldCheck, Smartphone,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

const STATUTS = {
  0: { label: 'Présent',    color: '#006633', bg: 'rgba(0,102,51,0.10)'  },
  1: { label: 'Absent',     color: '#C82020', bg: 'rgba(200,32,32,0.10)' },
  2: { label: 'Sanctionné', color: '#B8960C', bg: 'rgba(184,150,12,0.10)'},
  3: { label: 'Justifiée',  color: '#1a5c8f', bg: 'rgba(26,92,143,0.10)' },
};

const CARDS = [
  {
    href:  '/dashboard/absences/importer',
    icon:  Upload,
    label: 'Importer les étudiants',
    desc:  'Charger la liste des étudiants depuis un fichier Excel ou CSV',
    color: '#006633',
  },
  {
    href:  '/dashboard/absences/saisir',
    icon:  ClipboardCheck,
    label: 'Marquer absences',
    desc:  'Saisir les présences / absences par séance et par groupe',
    color: '#C82020',
  },
  {
    href:  '/dashboard/absences/etudiant',
    icon:  Search,
    label: 'ABS par étudiant(e)',
    desc:  'Rechercher et consulter les absences d\'un étudiant',
    color: '#1a5c8f',
  },
  {
    href:  '/dashboard/absences/rapport',
    icon:  FileText,
    label: 'Rapport absences',
    desc:  'Rapport mensuel ou par période pour un département',
    color: '#7c3aed',
  },
  {
    href:  '/dashboard/absences/stats',
    icon:  BarChart2,
    label: 'Statistiques ABS',
    desc:  'Tableau de bord global avec charts et liste rouge',
    color: '#B8960C',
  },
  {
    href:  '/dashboard/absences/fiches',
    icon:  BookOpen,
    label: 'Fiches de présence',
    desc:  'Générer les fiches de présence par séance et par groupe',
    color: '#0891b2',
  },
  {
    href:  '/dashboard/absences/saisir/salle',
    icon:  Smartphone,
    label: 'Mode Salle',
    desc:  'Pointage binaire mobile pour agents en salle — P/A en un tap',
    color: '#059669',
  },
  {
    href:  '/dashboard/absences/justificatifs',
    icon:  ShieldCheck,
    label: 'Arbitrage justificatifs',
    desc:  'DA/responsables : valider justificatifs et appliquer sanctions',
    color: '#1a5c8f',
    rolesOnly: ['admin', 'DA', 'responsable_filiere'],
  },
];

interface CardDef {
  href: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  color: string;
  rolesOnly?: string[];
}

interface StatsData {
  total_etudiants: number;
  total_absences:  number;
  liste_rouge:     number;
}

export default function AbsencesPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  const statsQuery = useQuery({
    queryKey: ['absences', 'stats', annee] as const,
    queryFn:  async (): Promise<StatsData> => {
      const [etus, pres] = await Promise.all([
        apiFetch<{ count: number }>(`/api/v1/absences/etudiants/?page_size=1`).catch(() => null),
        apiFetch<{ count: number }>(`/api/v1/absences/presences/?statut=1&page_size=1`).catch(() => null),
        apiFetch<{ seuil: number }>(`/api/v1/absences/seuil/`).catch(() => null),
      ]);
      return {
        total_etudiants: etus?.count ?? 0,
        total_absences:  pres?.count ?? 0,
        liste_rouge:     0,
      };
    },
    enabled: !!annee,
  });
  const stats   = statsQuery.data ?? null;
  const loading = statsQuery.isLoading;

  return (
    <div className="space-y-6 max-w-5xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #C82020, #E03535)' }}>
          <UserX size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Absences</h1>
          <p className="text-xs text-iss-gray">
            {annee ? `${annee} — Gestion des absences des étudiants` : 'Chargement…'}
          </p>
        </div>
      </div>

      {/* Légende statuts */}
      <div className="flex flex-wrap gap-2">
        {Object.values(STATUTS).map(({ label, color, bg }) => (
          <span key={label}
            className="px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: bg, color }}>
            {label}
          </span>
        ))}
      </div>

      {/* Stats rapides */}
      {annee && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Étudiants inscrits', value: stats?.total_etudiants, color: '#006633' },
            { label: 'Absences saisies',   value: stats?.total_absences,  color: '#C82020' },
            { label: 'Liste rouge',        value: stats?.liste_rouge,     color: '#B8960C' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 text-center">
              <p className="text-xs text-iss-gray mb-1">{label}</p>
              {loading ? (
                <Loader2 size={20} className="animate-spin mx-auto mt-1" style={{ color }} />
              ) : (
                <p className="text-3xl font-extrabold" style={{ color }}>
                  {value ?? '—'}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {(CARDS as CardDef[]).filter(c => !c.rolesOnly || c.rolesOnly.includes(user?.role ?? '')).map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}
            className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all group flex gap-4 items-start">
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
