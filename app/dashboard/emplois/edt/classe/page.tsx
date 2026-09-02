'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users } from 'lucide-react';

import { Badge, CARTE, EnTetePage, Erreur, Vide } from '../_ui';
import { useCoherence } from '../_coherence';
import { AC } from '../_autocomplete';
import { BoutonPDF, GrilleConsultation, SelecteurSemaine } from '../_consultation';
import { useGroupesEDT } from '../_referentiels';
import { jjmmaa, useSemainesCours } from '../_semaines';
import { edtApi } from '@/lib/api/edt';

import { anneeParDefaut, libelleSemestreSession, typeSemestreSession } from '../_annee';

/**
 * Emploi du temps d'un groupe, en lecture seule et imprimable.
 *
 * Pendant de la vue « Semaine », qui sert à éditer : celle-ci est destinée à
 * l'affichage et à la distribution aux étudiants.
 */
export default function EdtParGroupePage() {
  // Année et période viennent de la session : elles ont été choisies à la
  // connexion, les redemander ici n'ajouterait rien et permettrait de
  // consulter une période différente de celle qu'on croit ouverte.
  const annee   = anneeParDefaut();
  const typeSem = typeSemestreSession();
  const [groupeId, setGroupeId] = useState<number | null>(null);
  const [numero, setNumero]   = useState('');

  const { data: groupes = [] } = useGroupesEDT(annee);
  const { semaines, error: erreurSemaines } = useSemainesCours(annee, typeSem);
  const groupe  = groupes.find(g => g.id === groupeId);
  const semaine = semaines.find(s => String(s.numero_semaine) === numero);

  // Cet emploi du temps est-il celui sur lequel le suivi a été généré ? On
  // l'imprime et on s'y fie : le taire ici laisserait circuler une version
  // qui ne correspond plus à ce qui sera pointé et payé.
  const coherence = useCoherence(annee, typeSem);
  const etatSemaine = coherence.etat(numero ? Number(numero) : null);

  const { data: seances = [], isLoading, error } = useQuery({
    queryKey: ['edt', 'consultation', 'groupe', annee, typeSem, numero, groupeId] as const,
    enabled:  !!(annee && numero && groupeId),
    queryFn:  () => edtApi.consultation(annee, typeSem, Number(numero),
                                        { departement: groupeId! }),
  });

  return (
    <div className="space-y-4">
      <EnTetePage
        icone={<Users size={14} className="text-white" />}
        titre="Emploi du temps par groupe"
        actions={groupeId ? (
          <BoutonPDF
            actif={!!numero}
            params={{ annee_universitaire: annee, type_semestre: typeSem,
                      numero_semaine: numero, departement: String(groupeId) }}
            nomDefaut={`Emploi_${groupe?.nom ?? ''}_S${numero}.pdf`.replace(/ /g, '_')}
          />
        ) : undefined}
      />

      <div className={`${CARTE} p-4 print:hidden`}>
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{ minWidth: 240 }}>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Groupe</label>
            {/* Même saisie filtrante que sur les deux autres vues : trois
                écrans jumeaux qui se manipuleraient différemment se
                réapprennent à chaque fois. */}
            <AC value={groupeId ? String(groupeId) : ''} grand
                placeholder="Nom du groupe…"
                options={groupes.map(g => ({ id: String(g.id), label: g.nom }))}
                onChange={v => setGroupeId(v ? Number(v) : null)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semaine</label>
            <SelecteurSemaine semaines={semaines} numero={numero} onChange={setNumero} />
          </div>

          {etatSemaine && (
            <div className="print:hidden">
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Suivi
              </label>
              <div className="py-2">
                {etatSemaine === 'aligne'      && <Badge ton="vert">À jour</Badge>}
                {etatSemaine === 'divergent'   && <Badge ton="ambre">À régénérer</Badge>}
                {etatSemaine === 'previsionnel' && <Badge ton="neutre">Non généré</Badge>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Le cas qui coûte : le suivi existe, mais il ne décrit plus cette
          semaine. Le dire ici, où l'on imprime et où l'on vérifie. */}
      {etatSemaine === 'divergent' && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3
                        text-xs text-amber-900 print:hidden">
          <strong>Semaine {numero} : le suivi ne correspond plus à cet
          emploi du temps.</strong> Il a changé depuis. À régénérer avant de
          l&apos;imprimer.
        </div>
      )}

      <Erreur erreur={error ?? erreurSemaines} />

      {!groupeId ? (
        <div className={CARTE}>
          <Vide texte="Choisissez un groupe pour afficher son emploi du temps." />
        </div>
      ) : (
        <GrilleConsultation
          seances={seances}
          axe="groupe"
          isLoading={isLoading}
          titreImpression={`EMPLOI DU TEMPS — ${groupe?.nom ?? ''}`}
          sousTitresImpression={[
            [libelleSemestreSession(),
             semaine && `Semaine ${semaine.numero_semaine}`,
             semaine && `du ${jjmmaa(semaine.date_debut)} au ${jjmmaa(semaine.date_fin)}`,
            ].filter(Boolean).join('  ·  '),
            `Année universitaire ${annee}`,
          ]}
          vide={`Aucune séance pour ${groupe?.nom ?? 'ce groupe'} sur cette semaine.`}
        />
      )}
    </div>
  );
}
