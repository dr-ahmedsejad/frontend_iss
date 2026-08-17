'use client';

import Link from 'next/link';
import {
  Settings, Calendar, BookOpen, DollarSign,
  Building, Layers, Clock, MapPin, ArrowRight,
  Sun, CalendarDays, Moon, CalendarRange,
} from 'lucide-react';

const PARAM_SECTIONS = [
  {
    href: '/dashboard/parametres/annees',
    icon: Calendar,
    label: 'Années universitaires',
    desc: 'Gérer les années académiques',
    color: '#006633',
  },
  {
    href: '/dashboard/parametres/niveaux',
    icon: Layers,
    label: 'Niveaux',
    desc: 'Configurer les niveaux d\'études',
    color: '#006633',
  },
  {
    href: '/dashboard/parametres/semestres',
    icon: CalendarRange,
    label: 'Semestres',
    desc: 'Gérer les semestres par niveau',
    color: '#006633',
  },
  {
    href: '/dashboard/parametres/seances',
    icon: BookOpen,
    label: 'Types de séance',
    desc: 'CM, TD, TP et autres types',
    color: '#006633',
  },
  {
    href: '/dashboard/parametres/creneaux',
    icon: Clock,
    label: 'Créneaux horaires',
    desc: 'Définir les plages horaires de cours',
    color: '#006633',
  },
  {
    href: '/dashboard/parametres/jours',
    icon: Sun,
    label: 'Jours',
    desc: 'Jours de la semaine travaillés',
    color: '#B8960C',
  },
  {
    href: '/dashboard/parametres/semaines',
    icon: CalendarDays,
    label: 'Semaines',
    desc: 'Générer et gérer les semaines',
    color: '#006633',
  },
  {
    href: '/dashboard/parametres/departements',
    icon: Building,
    label: 'Départements',
    desc: 'Configurer les départements',
    color: '#006633',
  },
  {
    href: '/dashboard/parametres/salles',
    icon: MapPin,
    label: 'Salles',
    desc: 'Gérer les salles et amphithéâtres',
    color: '#006633',
  },
  {
    href: '/dashboard/parametres/paiements',
    icon: DollarSign,
    label: 'Taux de paiement',
    desc: 'Taux des vacations (CM, TD, TP)',
    color: '#C82020',
  },
  {
    href: '/dashboard/parametres/ramadan',
    icon: Moon,
    label: 'Périodes Ramadan',
    desc: 'Configurer les périodes Ramadan',
    color: '#006633',
  },
];

export default function ParametresPage() {
  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #64748b, #94a3b8)' }}>
            <Settings size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Paramètres</h1>
        </div>
        <p className="text-sm text-iss-gray ml-10">Configuration des données de référence du système</p>
      </div>

      {/* Warning banner */}
      <div className="rounded-2xl p-5 border flex items-start gap-3"
        style={{ background: 'rgba(229,192,24,0.07)', borderColor: 'rgba(229,192,24,0.3)' }}>
        <Settings size={18} style={{ color: '#E5C018' }} className="shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-iss-dark">Zone d&apos;administration</p>
          <p className="text-xs text-iss-gray mt-0.5 leading-relaxed">
            Les modifications apportées ici affectent l&apos;ensemble du système. Procédez avec précaution.
          </p>
        </div>
      </div>

      {/* Sections grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {PARAM_SECTIONS.map(({ href, icon: Icon, label, desc, color }) => (
          <Link key={href} href={href}
            className="group bg-white rounded-2xl p-5 shadow-card border border-gray-100 hover:border-transparent hover:shadow-card-lg transition-all duration-300 hover:-translate-y-0.5">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110"
              style={{ background: `${color}12` }}>
              <Icon size={18} style={{ color }} />
            </div>
            <h3 className="font-semibold text-iss-dark text-sm mb-1">{label}</h3>
            <p className="text-xs text-iss-gray leading-relaxed mb-4">{desc}</p>
            <div className="flex items-center gap-1 text-xs font-medium" style={{ color }}>
              Gérer <ArrowRight size={12} className="transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
