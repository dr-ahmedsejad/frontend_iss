'use client';

/**
 * L'accueil du moteur hebdomadaire — même présentation que l'accueil du socle
 * (`app/dashboard/emplois/page.tsx`) : une tuile par écran, une couleur par
 * tuile. Deux emplois du temps côte à côte dans le menu doivent se ressembler
 * à l'entrée ; c'est ensuite qu'ils divergent.
 */
import Link from 'next/link';
import {
  ArrowRight, CalendarRange, ClipboardEdit, DoorOpen, History, User,
} from 'lucide-react';

const CARDS = [
  {
    href:      '/dashboard/emplois/edt/grille',
    icon:      ClipboardEdit,
    title:     'Gérer les emplois',
    desc:      'Dessiner le patron d\'un groupe, le dupliquer sur les semaines, puis ajuster chaque semaine : remplacer, permuter, annuler',
    gradient:  'linear-gradient(135deg, #6d28d9, #7c3aed)',
    light:     'rgba(124,58,237,0.08)',
    iconColor: '#7c3aed',
  },
  {
    href:      '/dashboard/emplois/edt/classe',
    icon:      CalendarRange,
    title:     'Emploi par filière',
    desc:      'Consulter et imprimer l\'emploi du temps d\'un groupe, semaine par semaine',
    gradient:  'linear-gradient(135deg, #006633, #008844)',
    light:     'rgba(0,102,51,0.08)',
    iconColor: '#006633',
  },
  {
    href:      '/dashboard/emplois/edt/enseignant',
    icon:      User,
    title:     'Emploi par enseignant',
    desc:      'Voir toutes les séances d\'un enseignant sur une semaine, tous groupes confondus',
    gradient:  'linear-gradient(135deg, #1e40af, #2563eb)',
    light:     'rgba(37,99,235,0.08)',
    iconColor: '#2563eb',
  },
  {
    href:      '/dashboard/emplois/edt/salle',
    icon:      DoorOpen,
    title:     'Occupation des salles',
    desc:      'Suivre qui occupe une salle, à quelle heure, pour quel groupe',
    gradient:  'linear-gradient(135deg, #c2410c, #ea580c)',
    light:     'rgba(234,88,12,0.08)',
    iconColor: '#ea580c',
  },
  {
    href:      '/dashboard/emplois/edt/historique',
    icon:      History,
    title:     'Historique',
    desc:      'Retrouver la version de l\'emploi du temps qui a servi à chaque génération du suivi',
    gradient:  'linear-gradient(135deg, #475569, #64748b)',
    light:     'rgba(100,116,139,0.10)',
    iconColor: '#475569',
  },
];

export default function EdtAccueilPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <CalendarRange size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Emploi du temps par semaine</h1>
          <p className="text-sm text-iss-gray">Choisissez une vue ou accédez à la saisie</p>
        </div>
      </div>

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
