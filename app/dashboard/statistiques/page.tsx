'use client';

import { BarChart2, TrendingUp, Users, Calendar, Banknote, ClipboardList } from 'lucide-react';

const STAT_CARDS = [
  { label: 'Professeurs vacataires', value: '—', sub: 'Actifs ce semestre',    icon: Users,        color: '#006633' },
  { label: 'Séances planifiées',     value: '—', sub: 'Total sur le semestre', icon: Calendar,     color: '#006633' },
  { label: 'Séances effectuées',     value: '—', sub: 'Taux de réalisation',   icon: ClipboardList,color: '#B8960C' },
  { label: 'Vacations calculées',    value: '—', sub: 'Ce semestre (MRU)',     icon: Banknote,     color: '#C82020' },
];

export default function StatistiquesPage() {
  return (
    <div className="space-y-8 max-w-5xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
            <BarChart2 size={16} className="text-white" />
          </div>
          <h1 className="text-xl font-bold text-iss-dark">Statistiques</h1>
        </div>
        <p className="text-sm text-iss-gray ml-10">Vue d&apos;ensemble des indicateurs pédagogiques et administratifs</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, sub, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 shadow-card border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-medium text-iss-gray">{label}</p>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ background: `${color}12` }}>
                <Icon size={16} style={{ color }} />
              </div>
            </div>
            <p className="text-3xl font-bold text-iss-dark mb-1">{value}</p>
            <p className="text-xs text-iss-gray">{sub}</p>
          </div>
        ))}
      </div>

      {/* Avancement chart placeholder */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <TrendingUp size={16} className="text-iss-primary" />
            <h3 className="font-semibold text-iss-dark text-sm">Avancement par département</h3>
          </div>
          <div className="space-y-4">
            {['Informatique', 'Mathématiques', 'Physique', 'Économie'].map((dept, i) => {
              const pct = [75, 60, 82, 45][i];
              return (
                <div key={dept}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-iss-dark-soft font-medium">{dept}</span>
                    <span className="text-xs font-bold text-iss-gray">{pct}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: 'linear-gradient(90deg, #006633, #008844)' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-card border border-gray-100">
          <div className="flex items-center gap-2 mb-5">
            <Users size={16} className="text-iss-primary" />
            <h3 className="font-semibold text-iss-dark text-sm">Absences ce mois</h3>
          </div>
          <div className="flex items-center justify-center h-32 text-iss-gray/40 flex-col gap-2">
            <BarChart2 size={40} />
            <p className="text-xs">Les données s&apos;afficheront ici après connexion à l&apos;API</p>
          </div>
        </div>
      </div>
    </div>
  );
}
