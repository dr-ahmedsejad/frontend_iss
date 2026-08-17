'use client';

import Link from 'next/link';
import { Banknote, Plus, List, FileText, BarChart2, BookOpen, Award, ArrowRight } from 'lucide-react';

const CARDS = [
  {
    href:      '/dashboard/payement/ajouter',
    icon:      Plus,
    title:     'Ajouter vacation',
    desc:      'Enregistrer une nouvelle séance de vacation pour un enseignant',
    gradient:  'linear-gradient(135deg, #006633, #008844)',
    light:     'rgba(0,102,51,0.08)',
    iconColor: '#006633',
  },
  {
    href:      '/dashboard/payement/liste',
    icon:      List,
    title:     'Liste des vacations',
    desc:      'Consulter, modifier et supprimer les vacations enregistrées',
    gradient:  'linear-gradient(135deg, #1a5c8f, #2176ae)',
    light:     'rgba(26,92,143,0.08)',
    iconColor: '#1a5c8f',
  },
  {
    href:      '/dashboard/payement/fiches',
    icon:      FileText,
    title:     'Fiches vacataires',
    desc:      'Fiche de paiement individuelle par professeur avec détail par type de séance',
    gradient:  'linear-gradient(135deg, #6d28d9, #7c3aed)',
    light:     'rgba(124,58,237,0.08)',
    iconColor: '#7c3aed',
  },
  {
    href:      '/dashboard/payement/etat',
    icon:      BarChart2,
    title:     'État de vacation',
    desc:      'Récapitulatif des heures et montants par département et par professeur',
    gradient:  'linear-gradient(135deg, #B8960C, #E5C018)',
    light:     'rgba(184,150,12,0.08)',
    iconColor: '#B8960C',
  },
  {
    href:      '/dashboard/payement/details',
    icon:      BookOpen,
    title:     'Détails de vacation',
    desc:      'Détail séance par séance pour chaque vacataire avec pagination',
    gradient:  'linear-gradient(135deg, #c2410c, #ea580c)',
    light:     'rgba(234,88,12,0.08)',
    iconColor: '#ea580c',
  },
  {
    href:      '/dashboard/payement/attestation',
    icon:      Award,
    title:     'Attestation',
    desc:      "Générer une attestation d'enseignement en vacation au format PDF",
    gradient:  'linear-gradient(135deg, #006633, #008844)',
    light:     'rgba(0,102,51,0.08)',
    iconColor: '#006633',
  },
];

export default function PayementPage() {
  return (
    <div className="space-y-6 max-w-4xl">

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          <Banknote size={18} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Vacations</h1>
          <p className="text-sm text-iss-gray">Gestion et paiement des enseignants vacataires</p>
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
