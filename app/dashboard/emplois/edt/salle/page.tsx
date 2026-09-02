'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DoorOpen } from 'lucide-react';

import { CARTE, EnTetePage, Erreur, Vide } from '../_ui';
import { AC } from '../_autocomplete';
import { BoutonPDF, GrilleConsultation, SelecteurSemaine } from '../_consultation';
import { useReferentielsEDT } from '../_referentiels';
import { jjmmaa, useSemainesCours } from '../_semaines';
import { edtApi } from '@/lib/api/edt';

import { anneeParDefaut, libelleSemestreSession, typeSemestreSession } from '../_annee';

/**
 * Occupation d'une salle sur une semaine.
 *
 * L'usage courant n'est pas de lire ce qui s'y passe, mais de repérer ce qui
 * n'y est PAS : les cases vides sont les créneaux disponibles.
 */
export default function EdtParSallePage() {
  // Année et période viennent de la session : elles ont été choisies à la
  // connexion, les redemander ici n'ajouterait rien et permettrait de
  // consulter une période différente de celle qu'on croit ouverte.
  const annee   = anneeParDefaut();
  const typeSem = typeSemestreSession();
  const [salleId, setSalleId] = useState<number | null>(null);
  const [numero, setNumero]   = useState('');

  const { salles } = useReferentielsEDT();
  const { semaines, error: erreurSemaines } = useSemainesCours(annee, typeSem);
  const salle   = salles.find(s => s.id === salleId);
  const semaine = semaines.find(s => String(s.numero_semaine) === numero);

  const { data: seances = [], isLoading, error } = useQuery({
    queryKey: ['edt', 'consultation', 'salle', annee, typeSem, numero, salleId] as const,
    enabled:  !!(annee && numero && salleId),
    queryFn:  () => edtApi.consultation(annee, typeSem, Number(numero), { salle: salleId! }),
  });

  return (
    <div className="space-y-4">
      <EnTetePage
        icone={<DoorOpen size={14} className="text-white" />}
        titre="Occupation des salles"
        actions={salleId ? (
          <BoutonPDF
            actif={!!numero}
            params={{ annee_universitaire: annee, type_semestre: typeSem,
                      numero_semaine: numero, salle: String(salleId) }}
            nomDefaut={`Occupation_${salle?.nom ?? ''}_S${numero}.pdf`.replace(/ /g, '_')}
          />
        ) : undefined}
      />

      <div className={`${CARTE} p-4 print:hidden`}>
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{ minWidth: 220 }}>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Salle</label>
            {/* Saisie filtrante, comme pour l'enseignant : la liste des
                salles grandit avec l'établissement, et l'on cherche toujours
                une salle qu'on a déjà en tête. */}
            <AC value={salleId ? String(salleId) : ''} grand
                placeholder="Nom de la salle…"
                options={salles.map(s => ({
                  id: String(s.id),
                  label: `${s.nom}${s.capacite ? ` (${s.capacite} places)` : ''}`,
                }))}
                onChange={v => setSalleId(v ? Number(v) : null)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semaine</label>
            <SelecteurSemaine semaines={semaines} numero={numero} onChange={setNumero} />
          </div>
          <p className="text-xs text-iss-gray pb-3">
            Les cases vides sont les créneaux libres de cette salle.
          </p>
        </div>
      </div>

      <Erreur erreur={error ?? erreurSemaines} />

      {!salleId ? (
        <div className={CARTE}>
          <Vide texte="Choisissez une salle pour afficher son occupation." />
        </div>
      ) : (
        <GrilleConsultation
          seances={seances}
          axe="salle"
          isLoading={isLoading}
          titreImpression={`OCCUPATION DE LA SALLE — ${salle?.nom ?? ''}`}
          sousTitresImpression={[
            [libelleSemestreSession(),
             semaine && `Semaine ${semaine.numero_semaine}`,
             semaine && `du ${jjmmaa(semaine.date_debut)} au ${jjmmaa(semaine.date_fin)}`,
            ].filter(Boolean).join('  ·  '),
            `Année universitaire ${annee}`,
          ]}
          vide={`${salle?.nom ?? 'Cette salle'} est libre toute la semaine.`}
        />
      )}
    </div>
  );
}
