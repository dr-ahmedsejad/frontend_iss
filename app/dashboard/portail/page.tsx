'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { User, Calendar, UserX, ClipboardList, FileBadge, AlertCircle } from 'lucide-react';
import { useMonProfil, useMesAbsences, useMesReclamations } from '@/lib/api/portail-hooks';
import { getStoredUser } from '@/lib/auth';
const LIENS_RAPIDES = [
  { href: '/dashboard/portail/emploi',       icon: Calendar,       label: 'Emploi du temps',   color: 'text-blue-600',   bg: 'bg-blue-50' },
  { href: '/dashboard/portail/absences',     icon: UserX,          label: 'Mes absences',       color: 'text-red-600',    bg: 'bg-red-50' },
  { href: '/dashboard/portail/notes',        icon: ClipboardList,  label: 'Mes notes',          color: 'text-green-600',  bg: 'bg-green-50' },
  { href: '/dashboard/portail/documents',    icon: FileBadge,      label: 'Documents',          color: 'text-amber-600',  bg: 'bg-amber-50' },
  { href: '/dashboard/portail/reclamations', icon: AlertCircle,    label: 'Réclamations',       color: 'text-slate-600',  bg: 'bg-slate-50' },
];

export default function PortailAccueilPage() {
  const [matricule, setMatricule] = useState<string>(() => getStoredUser()?.matricule ?? '');
  const user = getStoredUser();

  const { data: profil, isLoading: lp }       = useMonProfil();
  const { data: absencesData, isLoading: la } = useMesAbsences();
  const { data: reclamations = [], isLoading: lr } = useMesReclamations();

  const loading = lp || la || lr;

  // Sync matricule depuis profil API quand chargé
  useEffect(() => {
    if (profil?.matricule) setMatricule(profil.matricule);
  }, [profil]);

  const absences = Array.isArray(absencesData) ? absencesData : [];
  const nbAbsences    = absences.filter(a => a.statut === 1).length;
  const nbSanctions   = absences.filter(a => a.statut === 2).length;
  const nbReclamEnCours = reclamations.filter(r => r.statut === 'soumise' || r.statut === 'en_cours').length;

  const photoUrl = profil?.photo
    ? (profil.photo.startsWith('http') ? profil.photo : `${API}${profil.photo}`)
    : null;

  const initials = (user?.name || 'ET')
    .split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Carte bienvenue */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
        <div className="h-2" style={{ background: 'linear-gradient(90deg, #006633, #008844)' }} />
        <div className="p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-16 h-16 rounded-full border-2 border-[#E5C018] overflow-hidden flex items-center justify-center text-white font-bold text-xl shrink-0"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            {photoUrl
              ? <img src={photoUrl} alt="Photo" className="w-full h-full object-cover" />
              : initials}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            {loading
              ? <div className="h-5 w-48 bg-slate-100 rounded animate-pulse mb-2" />
              : <h1 className="text-xl font-bold text-slate-900 truncate">
                  Bienvenue, {profil ? `${profil.prenom_fr || ''} ${profil.nom_fr || profil.nom}`.trim() : user?.name}
                </h1>
            }
            {loading
              ? <div className="h-3 w-32 bg-slate-100 rounded animate-pulse" />
              : <p className="text-sm text-slate-500">
                  Matricule : <span className="font-semibold text-[#006633]">{matricule || '—'}</span>
                  {profil?.filiere_nom && <> · <span>{profil.filiere_nom}</span></>}
                </p>
            }
          </div>
        </div>
      </div>

      {/* Statistiques rapides */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Absences',       value: nbAbsences,    color: 'text-red-600',    bg: 'bg-red-50' },
          { label: 'Sanctions',      value: nbSanctions,   color: 'text-orange-600', bg: 'bg-orange-50' },
          { label: 'Réclamations',   value: nbReclamEnCours, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(stat => (
          <div key={stat.label} className={`${stat.bg} rounded-lg p-4 border border-slate-200`}>
            {loading
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
