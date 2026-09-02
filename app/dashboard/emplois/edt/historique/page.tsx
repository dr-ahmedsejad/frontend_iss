'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, History } from 'lucide-react';

import { CARTE, EnTetePage, Erreur, SELECT, Vide } from '../_ui';
import { BTN_FLECHE, GrilleConsultation } from '../_consultation';
import { useGroupesEDT } from '../_referentiels';
import { jjmmaa } from '../_semaines';
import { edtApi } from '@/lib/api/edt';

import { anneeParDefaut, libelleSemestreSession, typeSemestreSession } from '../_annee';

/**
 * Emplois du temps tels qu'ils étaient au moment où le suivi en a été tiré.
 *
 * Les séances vivent dans une table modifiée sur place : corriger une semaine
 * efface la version d'avant. Or c'est sur une version précise que les heures
 * ont été pointées, et parfois payées. Cet écran donne accès aux photographies
 * prises à chaque transmission au suivi — y compris à plusieurs versions d'une
 * même semaine, quand elle a été re-transmise.
 *
 * La grille est celle de « Emploi par groupe », au pixel près : une archive
 * qui s'afficherait autrement que l'original ne permettrait pas la
 * comparaison, qui est sa seule raison d'être.
 */
export default function HistoriqueEdtPage() {
  const annee   = anneeParDefaut();
  const typeSem = typeSemestreSession();

  const [groupeId, setGroupeId] = useState<number | null>(null);
  const [numero, setNumero]     = useState<number | null>(null);
  /** `null` = la dernière version de la semaine affichée. */
  const [version, setVersion]   = useState<number | null>(null);

  const { data: groupes = [] } = useGroupesEDT(annee);
  const groupe = groupes.find(g => g.id === groupeId);

  const { data: versions = [], isLoading: chargeVersions, error } = useQuery({
    queryKey: ['edt', 'archives', 'versions', annee, typeSem, groupeId] as const,
    enabled:  !!groupeId,
    queryFn:  () => edtApi.archiveVersions(annee, typeSem, groupeId!),
  });

  /**
   * Semaines archivées, dans l'ordre du calendrier.
   *
   * Les flèches défilent là-dessus : plusieurs versions d'une même semaine ne
   * doivent pas obliger à appuyer deux fois pour passer à la suivante. Choisir
   * une version reste un geste à part, et ne se pose que là où il y en a
   * plusieurs.
   */
  const semainesArchivees = useMemo(() => {
    const vues = new Map<number, { numero: number; debut: string | null }>();
    for (const v of versions) {
      if (!vues.has(v.numero_semaine)) {
        vues.set(v.numero_semaine, { numero: v.numero_semaine, debut: v.date_debut });
      }
    }
    return [...vues.values()].sort((a, b) => a.numero - b.numero);
  }, [versions]);

  /** Prises de vue de la semaine affichée, de la plus récente à la plus ancienne. */
  const versionsSemaine = useMemo(
    () => versions.filter(v => v.numero_semaine === numero),
    [versions, numero],
  );

  // S'ouvre sur la dernière semaine archivée : c'est celle qu'on vient
  // vérifier, et un écran qui s'ouvre vide coûte un clic pour rien.
  useEffect(() => {
    if (!semainesArchivees.length) { setNumero(null); return; }
    setNumero(n => (semainesArchivees.some(s => s.numero === n)
      ? n
      : semainesArchivees[semainesArchivees.length - 1].numero));
  }, [semainesArchivees]);

  // Changer de semaine ramène sur sa version la plus récente : conserver
  // « v2 » en passant à une semaine qui n'en a qu'une n'affichait rien.
  useEffect(() => {
    setVersion(v => (versionsSemaine.some(x => x.version === v) ? v : null));
  }, [versionsSemaine]);

  const index   = semainesArchivees.findIndex(s => s.numero === numero);
  const choisie = versionsSemaine.find(v => v.version === version)
    ?? versionsSemaine[0];

  const { data: archivees = [], isLoading } = useQuery({
    queryKey: ['edt', 'archives', 'grille', annee, typeSem, numero,
               groupeId, choisie?.version] as const,
    enabled:  !!(groupeId && numero && choisie),
    queryFn:  () => edtApi.archiveGrille(annee, typeSem, numero!,
                                         groupeId!, choisie!.version),
  });

  const dateDeVue = (v?: { genere_le: string }) =>
    v ? new Date(v.genere_le).toLocaleDateString('fr-FR') : '';

  return (
    <div className="space-y-4">
      <EnTetePage
        icone={<History size={14} className="text-white" />}
        titre="Historique des emplois du temps"
        sousTitre={`${annee} · ${libelleSemestreSession()}`}
      />

      <div className={`${CARTE} p-4 print:hidden`}>
        <div className="flex items-end gap-3 flex-wrap">
          <div style={{ minWidth: 240 }}>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Groupe</label>
            <select value={groupeId ?? ''} className={SELECT}
                    onChange={e => setGroupeId(e.target.value ? Number(e.target.value) : null)}>
              <option value="">— Groupe —</option>
              {groupes.map(g => (
                <option key={g.id} value={g.id}>
                  {g.nom}{g.groupe ? ` — ${g.groupe}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-iss-dark mb-1.5">Semaine</label>
            <div className="flex items-center gap-1">
              <button onClick={() => semainesArchivees[index - 1]
                        && setNumero(semainesArchivees[index - 1].numero)}
                      disabled={index <= 0} title="Semaine précédente"
                      className={BTN_FLECHE}>
                <ChevronLeft size={14} />
              </button>
              <select value={numero ?? ''} className={SELECT} style={{ minWidth: 180 }}
                      disabled={!semainesArchivees.length}
                      onChange={e => setNumero(e.target.value ? Number(e.target.value) : null)}>
                {!semainesArchivees.length && <option value="">— Aucune archive —</option>}
                {semainesArchivees.map(s => (
                  <option key={s.numero} value={s.numero}>
                    S{s.numero}{s.debut ? ` · ${jjmmaa(s.debut)}` : ''}
                  </option>
                ))}
              </select>
              <button onClick={() => semainesArchivees[index + 1]
                        && setNumero(semainesArchivees[index + 1].numero)}
                      disabled={index < 0 || index >= semainesArchivees.length - 1}
                      title="Semaine suivante"
                      className={BTN_FLECHE}>
                <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Le choix de version ne se pose que là où il y en a plusieurs :
              une liste à un seul élément fait croire à un réglage à faire. */}
          {versionsSemaine.length > 1 && (
            <div style={{ minWidth: 230 }}>
              <label className="block text-xs font-semibold text-iss-dark mb-1.5">
                Version
              </label>
              <select value={version ?? versionsSemaine[0]?.version ?? ''} className={SELECT}
                      onChange={e => setVersion(Number(e.target.value))}>
                {versionsSemaine.map(v => (
                  <option key={v.version} value={v.version}>
                    Version {v.version} · {dateDeVue(v)} · {v.nb_seances} séance
                    {v.nb_seances > 1 ? 's' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      <Erreur erreur={error} />

      {/* Le document dit ce qu'il est. Ouvert à côté de l'emploi du temps
          courant, rien ne les distinguerait sans cette mention — alors qu'ils
          diffèrent souvent, ce qui est précisément l'intérêt de l'archive. */}
      {choisie && (
        <div className={`${CARTE} px-4 py-2.5`}>
          <span style={{ fontSize: 12, color: '#4b5563' }}>
            Emploi du temps <strong>tel qu&apos;il a servi</strong> à la génération
            du suivi de la semaine {choisie.numero_semaine}, le {dateDeVue(choisie)}.
            {' '}Il n&apos;a plus bougé depuis : les modifications faites après
            cette date figurent dans l&apos;emploi du temps courant, pas ici.
          </span>
        </div>
      )}

      {!groupeId ? (
        <div className={CARTE}>
          <Vide texte="Choisissez un groupe pour consulter ses emplois du temps archivés." />
        </div>
      ) : !chargeVersions && !versions.length ? (
        <div className={CARTE}>
          <Vide texte={`Aucun emploi du temps archivé pour ${groupe?.nom ?? 'ce groupe'} : `
                     + `une archive est prise à chaque transmission au suivi.`} />
        </div>
      ) : (
        <GrilleConsultation
          seances={archivees}
          axe="groupe"
          isLoading={isLoading || chargeVersions}
          titreImpression={`EMPLOI DU TEMPS ARCHIVÉ — ${groupe?.nom ?? ''}`}
          sousTitresImpression={[
            [libelleSemestreSession(),
             choisie && `Semaine ${choisie.numero_semaine}`,
             choisie?.date_debut
               && `du ${jjmmaa(choisie.date_debut)} au ${jjmmaa(choisie.date_fin)}`,
            ].filter(Boolean).join('  ·  '),
            `Version ${choisie?.version ?? ''} · prise le ${dateDeVue(choisie)}`,
            `Année universitaire ${annee}`,
          ]}
          vide="Cette prise de vue ne contient aucune séance."
        />
      )}
    </div>
  );
}
