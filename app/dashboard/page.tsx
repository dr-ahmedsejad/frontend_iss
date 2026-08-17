'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart2, Calendar, ClipboardList, TrendingUp,
  UserX, Banknote, Settings, Users, Building2,
  ArrowRight, Activity,
} from 'lucide-react';
import { getStoredUser, canAccess, fetchAndStoreModules, getStoredModules, AuthUser } from '@/lib/auth';
import { apiFetch } from '@/lib/api';
import { profsApi } from '@/lib/api/profs';
import { etudiantsApi } from '@/lib/api/scolarite';

interface Section {
  href: string;
  icon: React.ElementType;
  label: string;
  desc: string;
  color: string;
  module: string;
}

const SECTIONS: Section[] = [
  { href: '/dashboard/statistiques', icon: BarChart2,     label: 'Statistiques',       desc: 'Vue d\'ensemble des indicateurs clés',        color: '#006633', module: 'statistiques' },
  { href: '/dashboard/emplois',      icon: Calendar,      label: 'Emplois du temps',   desc: 'Créer et consulter les grilles horaires',       color: '#006633', module: 'emplois' },
  { href: '/dashboard/suivi',        icon: ClipboardList, label: 'Suivi des séances',  desc: 'Pointer la présence des enseignants',           color: '#006633', module: 'suivi' },
  { href: '/dashboard/avancement',   icon: TrendingUp,    label: 'Avancement',         desc: 'Suivre l\'avancement des cours par semestre',   color: '#B8960C', module: 'avancement' },
  { href: '/dashboard/absences',     icon: UserX,         label: 'Absences',           desc: 'Gérer les absences des étudiants',              color: '#C82020', module: 'absences' },
  { href: '/dashboard/payement',     icon: Banknote,      label: 'Payement',           desc: 'Calculer et éditer les vacations',              color: '#006633', module: 'payement' },
  { href: '/dashboard/profs',        icon: Users,         label: 'Professeurs',        desc: 'Gérer les dossiers des enseignants vacataires',color: '#006633', module: 'parametres' },
  { href: '/dashboard/banque',       icon: Building2,     label: 'Banques',            desc: 'Gérer les informations bancaires',              color: '#006633', module: 'parametres' },
  { href: '/dashboard/parametres',   icon: Settings,      label: 'Paramètres',         desc: 'Configurer les données de référence',           color: '#64748b', module: 'parametres' },
];

export default function DashboardPage() {
  const [user,    setUser]    = useState<AuthUser | null>(null);
  const [visible, setVisible] = useState<Section[]>([]);

  useEffect(() => {
    const u = getStoredUser();
    if (!u) return;
    setUser(u);

    // Si les modules sont déjà en sessionStorage (même onglet, même session)
    if (getStoredModules() !== null) {
      setVisible(SECTIONS.filter(s => canAccess(s.module)));
    } else {
      // Nouvel onglet ou refresh : recharger depuis l'API puis filtrer
      fetchAndStoreModules().then(() => {
        setVisible(SECTIONS.filter(s => canAccess(s.module)));
      }).catch(() => {
        // Fallback si l'API échoue
        setVisible(SECTIONS.filter(s => canAccess(s.module)));
      });
    }
  }, []);

  // ── Compteurs des cartes (TanStack Query) ────────────────────────────────
  // Professeurs/Étudiants : totaux (non liés à l'année). Emplois/Vacations :
  // scopés sur l'année du contexte (+ institution, automatique côté backend).
  // En cas d'absence de droits ou d'erreur réseau → null → la carte affiche « — ».
  const annee = user?.annee_universitaire ?? '';
  const countOf = (p: Promise<{ count: number }>) => p.then(r => r.count).catch(() => null);

  const qProfs = useQuery({
    queryKey: ['dashboard', 'count', 'profs'] as const,
    queryFn:  () => countOf(profsApi.list({ page_size: 1 })),
    enabled:  !!user,
  });
  const qEtudiants = useQuery({
    queryKey: ['dashboard', 'count', 'etudiants'] as const,
    queryFn:  () => countOf(etudiantsApi.list({ page_size: 1 })),
    enabled:  !!user,
  });
  // « Emplois du temps » = nombre de GRILLES HEBDOMADAIRES distinctes
  // (groupe × semestre × semaine) présentes dans le pointage (SuiviePointage)
  // pour l'année + la parité de la session du contexte.
  const tsContexte = user?.semestre === 'Pairs' ? 'P' : 'I';
  const qEmplois = useQuery({
    queryKey: ['dashboard', 'count', 'emplois-grilles', annee, tsContexte] as const,
    queryFn:  () => apiFetch<{ count: number }>(
      `/api/v1/suivi/pointages/emplois-actifs/?annee_universitaire=${encodeURIComponent(annee)}&type_semestre=${tsContexte}`,
    ).then(r => r.count ?? 0).catch(() => null),
    enabled:  !!user && !!annee,
  });
  // « Vacations » = MONTANT global à payer pour l'année du contexte. On somme la
  // MÊME source que la page Statistiques > Vacations (/avancement/vacations/),
  // qui n'inclut QUE les profs payés à l'heure (vacataire + personnel admin +
  // militaire), pas les permanents.
  const qVacations = useQuery({
    queryKey: ['dashboard', 'montant', 'vacations', annee] as const,
    queryFn:  () => apiFetch<{ labels: string[]; values: number[] }>(
      `/api/v1/avancement/vacations/?annee_universitaire=${encodeURIComponent(annee)}`,
    ).then(r => (r.values ?? []).reduce((s, v) => s + (v || 0), 0)).catch(() => null),
    enabled:  !!user && !!annee,
  });

  const statValue = (q: { isLoading: boolean; data: number | null | undefined }) =>
    q.isLoading ? '…' : (q.data === null || q.data === undefined ? '—' : q.data.toLocaleString('fr-FR'));
  const montantValue = (q: { isLoading: boolean; data: number | null | undefined }) =>
    q.isLoading ? '…' : (q.data === null || q.data === undefined ? '—' : `${Math.round(q.data).toLocaleString('fr-FR')} MRU`);

  if (!user) return null;
  const initials = user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="space-y-8 max-w-5xl">

      {/* Welcome banner */}
      <div className="rounded-2xl p-6 lg:p-8 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #004d24 0%, #006633 60%, #008844 100%)' }}>
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, #E5C018, rgba(229,192,24,0.3))' }} />
        <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl"
          style={{ background: 'linear-gradient(90deg, transparent 50%, rgba(200,32,32,0.5) 80%, #C82020 100%)' }} />
        <div className="absolute -top-10 -right-10 w-48 h-48 rounded-full opacity-15"
          style={{ background: '#E5C018' }} />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-xl font-bold shrink-0 border-2"
            style={{ background: 'rgba(255,255,255,0.2)', borderColor: '#E5C018' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/70 text-sm mb-1">Bienvenue,</p>
            <h1 className="text-2xl lg:text-3xl font-bold text-white truncate">{user.name}</h1>
            <p className="text-white/60 text-sm mt-1">
              Gérez les activités pédagogiques et administratives depuis ce tableau de bord.
            </p>
          </div>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Professeurs',  value: statValue(qProfs),     icon: Users,    color: '#006633' },
          { label: 'Emplois',      value: statValue(qEmplois),   icon: Calendar, color: '#006633' },
          { label: 'Étudiants',    value: statValue(qEtudiants),    icon: UserX,    color: '#B8960C' },
          { label: 'Vacations',    value: montantValue(qVacations), icon: Banknote, color: '#006633' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-4 shadow-card border border-gray-100">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-iss-gray">{label}</p>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center" style={{ background: `${color}15` }}>
                <Icon size={13} style={{ color }} />
              </div>
            </div>
            <p className="text-2xl font-bold text-iss-dark">{value}</p>
          </div>
        ))}
      </div>

      {/* Sections grid */}
      <div>
        <h2 className="text-base font-semibold text-iss-dark mb-4 flex items-center gap-2">
          <span className="flex flex-col gap-0.5 shrink-0">
            <span className="w-1 h-1.5 rounded-full" style={{ background: '#006633' }} />
            <span className="w-1 h-1.5 rounded-full" style={{ background: '#E5C018' }} />
            <span className="w-1 h-1.5 rounded-full" style={{ background: '#C82020' }} />
          </span>
          <Activity size={16} className="text-iss-primary" />
          Modules disponibles
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {visible.map(({ href, icon: Icon, label, desc, color }) => (
            <Link key={href} href={href}
              className="group bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:border-transparent hover:shadow-card-lg transition-all duration-300 hover:-translate-y-0.5 relative overflow-hidden"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ background: `${color}12` }}>
                  <Icon size={18} style={{ color }} />
                </div>
              </div>
              <h3 className="font-semibold text-iss-dark text-sm mb-1">{label}</h3>
              <p className="text-xs text-iss-gray leading-relaxed">{desc}</p>
              <div className="mt-4 flex items-center gap-1 text-xs font-medium" style={{ color }}>
                Accéder <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
