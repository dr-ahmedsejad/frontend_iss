'use client';

import Link from 'next/link';
import { TrendingUp, BookOpen, Users, Award, ClipboardList } from 'lucide-react';
import { getStoredUser } from '@/lib/auth';

const CARDS = [
  {
    href:  '/dashboard/avancement/em',
    icon:  BookOpen,
    label: 'Avancement EMs',
    desc:  'Heures effectuées par élément de module et par type de séance',
    color: '#006633',
  },
  {
    href:  '/dashboard/avancement/profs',
    icon:  Users,
    label: 'Avancement profs',
    desc:  'Heures et montants par professeur et par type de séance',
    color: '#006633',
  },
  {
    href:  '/dashboard/avancement/permanents',
    icon:  Award,
    label: 'Charge profs permanents',
    desc:  'Suivi de la charge réglementaire des professeurs permanents',
    color: '#B8960C',
  },
  {
    href:  '/dashboard/avancement/details',
    icon:  ClipboardList,
    label: 'Détails des enseignements',
    desc:  'Détail séance par séance pour chaque professeur',
    color: '#1a5c8f',
  },
];

export default function AvancementPage() {
  const user  = getStoredUser();
  const annee = user?.annee_universitaire ?? '';

  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #B8960C, #E5C018)' }}>
          <TrendingUp size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Avancement</h1>
          <p className="text-xs text-iss-gray">
            {annee ? `Année universitaire ${annee}` : 'Suivi de l\'avancement des cours'}
          </p>
        </div>
      </div>

      {/* Navigation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(({ href, icon: Icon, label, desc, color }) => (
          <Link
            key={href}
            href={href}
            className="bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all group flex gap-4 items-start"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${color}, ${color}cc)` }}
            >
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
