'use client';

import Link from 'next/link';
import { Calendar, User, DoorOpen, ClipboardEdit, ArrowRight } from 'lucide-react';

const CARDS = [
  {
    href:      '/dashboard/emplois/filiere',
    icon:      Calendar,
    title:     'Emplois par filière',
    desc:      'Consulter la grille horaire complète d\'un département par semestre',
    gradient:  'linear-gradient(135deg, #006633, #008844)',
    light:     'rgba(0,102,51,0.08)',
    iconColor: '#006633',
  },
  {
    href:      '/dashboard/emplois/prof',
    icon:      User,
    title:     'Emplois professeur',
    desc:      'Visualiser l\'emploi du temps personnel d\'un enseignant',
    gradient:  'linear-gradient(135deg, #1e40af, #2563eb)',
    light:     'rgba(37,99,235,0.08)',
    iconColor: '#2563eb',
  },
  {
    href:      '/dashboard/emplois/salle',
    icon:      DoorOpen,
    title:     'Emplois par salle',
    desc:      'Suivre l\'occupation d\'une salle sur toute la semaine',
    gradient:  'linear-gradient(135deg, #c2410c, #ea580c)',
    light:     'rgba(234,88,12,0.08)',
    iconColor: '#ea580c',
  },
  {
    href:      '/dashboard/emplois/gerer',
    icon:      ClipboardEdit,
    title:     'Gérer les emplois',
    desc:      'Saisir, modifier et supprimer les séances d\'un département',
    gradient:  'linear-gradient(135deg, #6d28d9, #7c3aed)',
    light:     'rgba(124,58,237,0.08)',
    iconColor: '#7c3aed',
  },
];

export default function EmploisPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Calendar size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Emplois du temps</h1>
          <p className="text-sm text-iss-gray">Choisissez un type de vue ou accédez à la saisie</p>
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map(({ href, icon: Icon, title, desc, gradient, light, iconColor }) => (
          <Link key={href} href={href}
            className="group bg-white rounded-2xl shadow-card border border-gray-100 p-6 flex flex-col gap-4 hover:shadow-lg transition-all hover:-translate-y-0.5">
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                style={{ background: light }}>
                <Icon size={22} style={{ color: iconColor }} />
              </div>
              <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-gray-50 group-hover:bg-gray-100 transition-colors">
                <ArrowRight size={14} className="text-iss-gray group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>
            <div>
              <h2 className="font-bold text-iss-dark mb-1">{title}</h2>
              <p className="text-sm text-iss-gray leading-relaxed">{desc}</p>
            </div>
            <div className="h-1 rounded-full mt-auto" style={{ background: gradient }} />
          </Link>
        ))}
      </div>
    </div>
  );
}
