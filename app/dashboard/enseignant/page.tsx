'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Calendar, ClipboardCheck, TrendingUp, Edit3, AlertCircle, Banknote, User,
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { getStoredUser } from '@/lib/auth';

const LIENS_RAPIDES = [
  { href: '/dashboard/enseignant/emploi',       icon: Calendar,       label: 'Emploi du temps',   color: 'text-blue-600',   bg: 'bg-blue-50' },
  { href: '/dashboard/enseignant/suivi',        icon: ClipboardCheck, label: 'Suivi des séances',  color: 'text-green-600',  bg: 'bg-green-50' },
  { href: '/dashboard/enseignant/avancement',   icon: TrendingUp,     label: 'Avancement',         color: 'text-indigo-600', bg: 'bg-indigo-50' },
  { href: '/dashboard/enseignant/notes',        icon: Edit3,          label: 'Saisie des notes',   color: 'text-amber-600',  bg: 'bg-amber-50' },
  { href: '/dashboard/enseignant/reclamations', icon: AlertCircle,    label: 'Réclamations',       color: 'text-red-600',    bg: 'bg-red-50' },
  { href: '/dashboard/enseignant/vacations',    icon: Banknote,       label: 'Vacations / Charge', color: 'text-slate-600',  bg: 'bg-slate-50' },
  { href: '/dashboard/enseignant/profil',       icon: User,           label: 'Mon profil',         color: 'text-teal-600',   bg: 'bg-teal-50' },
];

// Réponses des endpoints réels (mêmes que les sous-pages du portail)
type GrilleResponse = { grille: Record<string, Record<string, unknown[]>> };
interface AvancementRow {
  plan_CM: number; plan_TD: number; plan_TP: number; plan_PR: number;
  real_CM: number; real_TD: number; real_TP: number; real_PR: number;
}
type AvancementResponse = { items: AvancementRow[] };
type ReclamationRow = { statut: 'soumise' | 'en_cours' | 'acceptee' | 'rejetee' };

export default function EnseignantAccueilPage() {
  const user    = getStoredUser();
  const profId  = user?.prof_id ?? null;
  const annee   = user?.annee_universitaire ?? '';
  const typeSem = user?.semestre === 'Impairs' ? 'I' : 'P';

  const [nbSeances,      setNbSeances]      = useState<number | null>(null);
  const [nbReclamations, setNbReclamations] = useState<number | null>(null);
  const [avancementPct,  setAvancementPct]  = useState<number | null>(null);
  const [loading,        setLoading]        = useState(true);

  useEffect(() => {
    // Sans prof/année, pas d'appel possible : on affiche 0 plutôt que de figer.
    if (!profId || !annee) {
      setNbSeances(0); setNbReclamations(0); setAvancementPct(0); setLoading(false);
      return;
    }

    const grilleQs = new URLSearchParams({
      annee_universitaire: annee, prof: String(profId), type_semestre: typeSem,
    });

    Promise.allSettled([
      apiFetch<GrilleResponse>(`/api/v1/suivi/pointages/grille/?${grilleQs}`),
      apiFetch<ReclamationRow[]>(`/api/v1/reclamations/pour-enseignant/?annee_universitaire=${encodeURIComponent(annee)}`),
      apiFetch<AvancementResponse>(`/api/v1/avancement/profs/detail/?annee_universitaire=${encodeURIComponent(annee)}`),
    ]).then(([grilleRes, reclRes, avRes]) => {
      // Séances de la dernière semaine du prof (grille)
      if (grilleRes.status === 'fulfilled') {
        let count = 0;
        Object.values(grilleRes.value.grille ?? {}).forEach(jour =>
          Object.values(jour).forEach(cellules => { count += cellules.length; })
        );
        setNbSeances(count);
      } else {
        setNbSeances(0);
      }

      // Réclamations « en cours » = soumise + en_cours
      if (reclRes.status === 'fulfilled') {
        setNbReclamations(
          reclRes.value.filter(r => r.statut === 'soumise' || r.statut === 'en_cours').length,
        );
      } else {
        setNbReclamations(0);
      }

      // Avancement global = heures réalisées / heures planifiées (toutes familles)
      if (avRes.status === 'fulfilled') {
        const items = avRes.value.items ?? [];
        const planned  = items.reduce((s, i) => s + i.plan_CM + i.plan_TD + i.plan_TP + i.plan_PR, 0);
        const realised = items.reduce((s, i) => s + i.real_CM + i.real_TD + i.real_TP + i.real_PR, 0);
        setAvancementPct(planned > 0 ? Math.round((realised / planned) * 100) : 0);
      } else {
        setAvancementPct(0);
      }

      setLoading(false);
    });
  }, [profId, annee, typeSem]);

  const initials = (user?.name || 'EN')
    .split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  const typeLabel = user?.prof_type
    ? user.prof_type.charAt(0).toUpperCase() + user.prof_type.slice(1)
    : '—';

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Carte bienvenue */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="h-2" style={{ background: 'linear-gradient(90deg, #006633, #008844)' }} />
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="w-16 h-16 rounded-full border-2 border-[#E5C018] flex items-center justify-center text-white font-bold text-xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-slate-900 truncate">
              Bienvenue, {user?.prof_nom || user?.name || '—'}
            </h1>
            <p className="text-sm text-slate-500">{typeLabel}</p>
          </div>
        </div>
      </div>

      {/* KPI rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Séances cette semaine', value: nbSeances, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Réclamations en cours', value: nbReclamations, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Avancement global (%)', value: avancementPct !== null ? `${avancementPct}%` : null, color: 'text-green-600', bg: 'bg-green-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-lg p-4 border border-slate-200`}>
            {loading || stat.value === null
              ? <div className="h-8 w-12 bg-white/60 rounded animate-pulse mb-1" />
              : <p className={`text-3xl font-bold tabular-nums ${stat.color}`}>{stat.value}</p>
            }
            <p className="text-xs text-slate-600 font-medium">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Liens rapides */}
      <div>
        <h2 className="text-base font-semibold text-slate-700 mb-3">Accès rapide</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          {LIENS_RAPIDES.map(l => (
            <Link key={l.href} href={l.href}
              className="bg-white rounded-lg border border-slate-200 p-4 flex items-center gap-3 hover:shadow-sm hover:border-[#006633]/30 transition-all group">
              <div className={`w-9 h-9 rounded-lg ${l.bg} flex items-center justify-center shrink-0`}>
                <l.icon size={18} className={l.color} />
              </div>
              <span className="text-sm font-medium text-slate-700 group-hover:text-[#006633] truncate">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
