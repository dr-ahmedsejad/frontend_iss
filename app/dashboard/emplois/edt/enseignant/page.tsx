'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Presentation } from 'lucide-react';

import { CARTE, EnTetePage, Erreur, Vide } from '../_ui';
import { AC } from '../_autocomplete';
import { BoutonPDF, GrilleConsultation, SelecteurSemaine } from '../_consultation';
import { useReferentielsEDT } from '../_referentiels';
import { jjmmaa, useSemainesCours } from '../_semaines';
import { edtApi } from '@/lib/api/edt';

import { anneeParDefaut, libelleSemestreSession, typeSemestreSession } from '../_annee';

/**
 * Emploi du temps d'un enseignant, tous groupes confondus.
 *
 * Les séances viennent de `prof`, qui porte l'enseignant EFFECTIF : après un
 * remplacement, l'écran montre donc ce que l'intéressé assure réellement —
 * c'est aussi cette base qui sert au calcul de charge.
 */
export default function EdtParEnseignantPage() {
  // Année et période viennent de la session : elles ont été choisies à la
  // connexion, les redemander ici n'ajouterait rien et permettrait de
  // consulter une période différente de celle qu'on croit ouverte.
  const annee   = anneeParDefaut();
  const typeSem = typeSemestreSession();
  const [profId, setProfId]   = useState<number | null>(null);
  const [numero, setNumero]   = useState('');

  const { profs } = useReferentielsEDT();
  const { semaines, error: erreurSemaines } = useSemainesCours(annee, typeSem);
  const prof    = profs.find(p => p.id === profId);
  const semaine = semaines.find(s => String(s.numero_semaine) === numero);

  const { data: seances = [], isLoading, error } = useQuery({
    queryKey: ['edt', 'consultation', 'prof', annee, typeSem, numero, profId] as const,
    enabled:  !!(annee && numero && profId),
    queryFn:  () => edtApi.consultation(annee, typeSem, Number(numero), { prof: profId! }),
  });

  return (
    <div className="space-y-4">
      <EnTetePage
        icone={<Presentation size={14} className="text-white" />}
        titre="Emploi du temps par enseignant"
        actions={profId ? (
          <BoutonPDF
            actif={!!numero}
            params={{ annee_universitaire: annee, type_semestre: typeSem,
                      numero_semaine: numero, prof: String(profId) }}
            nomDefaut={`Emploi_${prof?.nom ?? ''}_S${numero}.pdf`.replace(/ /g, '_')}
          />
        ) : undefined}
      />

      <div className={`${CARTE} p-4 print:hidden`}>
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{ minWidth: 280 }}>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Enseignant</label>
            {/* Saisie filtrante : avec deux cents enseignants, une liste
                déroulante oblige à faire défiler jusqu'au bon. Trois lettres
                suffisent ici. */}
            <AC value={profId ? String(profId) : ''} grand
                placeholder="Nom de l'enseignant…"
                options={profs.map(p => ({
                  id: String(p.id),
                  label: `${p.nom}${p.type ? ` (${p.type})` : ''}`,
                }))}
                onChange={v => setProfId(v ? Number(v) : null)} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semaine</label>
            <SelecteurSemaine semaines={semaines} numero={numero} onChange={setNumero} />
          </div>
        </div>
      </div>

      <Erreur erreur={error ?? erreurSemaines} />

      {!profId ? (
        <div className={CARTE}>
          <Vide texte="Choisissez un enseignant pour afficher son emploi du temps." />
        </div>
      ) : (
        <GrilleConsultation
          seances={seances}
          axe="prof"
          isLoading={isLoading}
          titreImpression={`EMPLOI DU TEMPS — ${prof?.nom ?? ''}`}
          sousTitresImpression={[
            [libelleSemestreSession(),
             semaine && `Semaine ${semaine.numero_semaine}`,
             semaine && `du ${jjmmaa(semaine.date_debut)} au ${jjmmaa(semaine.date_fin)}`,
            ].filter(Boolean).join('  ·  '),
            `Année universitaire ${annee}`,
          ]}
          vide={`Aucune séance pour ${prof?.nom ?? 'cet enseignant'} sur cette semaine.`}
        />
      )}
    </div>
  );
}
