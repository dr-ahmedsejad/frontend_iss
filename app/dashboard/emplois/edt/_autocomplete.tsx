'use client';

/**
 * Autocomplétion de cellule d'emploi du temps.
 *
 * Même comportement que la grille « Gérer emplois » du socle
 * (l'ancien ecran du socle, depuis retire) : saisie libre filtrante, liste
 * déroulante au focus, bordure bleue quand la case est remplie.
 *
 * La liste est rendue dans un PORTAIL, à coordonnées fixes. Posée dans la
 * cellule, elle était coupée par le défilement horizontal du tableau : on n'en
 * voyait que les deux ou trois premières lignes, et rien du tout sur la
 * dernière rangée de la grille. Une liste tronquée sans le dire donne à croire
 * que le choix cherché n'existe pas.
 */
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useTimeout } from '@/hooks/useTimeout';

/** Où poser la liste : sous le champ, ou au-dessus s'il n'y a plus de place. */
interface Position { left: number; top: number; width: number; versLeHaut: boolean }
const HAUTEUR_LISTE = 160;

export interface OptionAC { id: string; label: string }

export function AC({
  value, options, onChange, placeholder, disabled, grand,
}: {
  value:       string;
  options:     OptionAC[];
  onChange:    (id: string) => void;
  placeholder: string;
  disabled?:   boolean;
  /**
   * Taille d'une barre de filtres plutôt que d'une case de grille.
   *
   * Le champ est né dans une cellule, où chaque pixel compte. Employé tel
   * quel dans un en-tête d'écran, il paraissait rabougri à côté des listes
   * déroulantes voisines.
   */
  grand?:      boolean;
}) {
  const [texte, setTexte]     = useState('');
  const [ouvert, setOuvert]   = useState(false);
  const [filtre, setFiltre]   = useState<OptionAC[]>([]);
  const [pos, setPos]         = useState<Position | null>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const blurTimer = useTimeout();

  // La position se prend juste avant la peinture : mesurée plus tôt, elle
  // ignorerait un défilement survenu entre-temps.
  useLayoutEffect(() => {
    if (!ouvert || !inputRef.current) { setPos(null); return; }
    const placer = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const dessous = window.innerHeight - r.bottom;
      setPos({
        left: r.left, width: r.width, versLeHaut: dessous < HAUTEUR_LISTE + 8,
        top: dessous < HAUTEUR_LISTE + 8 ? r.top : r.bottom,
      });
    };
    placer();
    // `true` : on écoute aussi le défilement des conteneurs internes, celui du
    // tableau au premier chef.
    window.addEventListener('scroll', placer, true);
    window.addEventListener('resize', placer);
    return () => {
      window.removeEventListener('scroll', placer, true);
      window.removeEventListener('resize', placer);
    };
  }, [ouvert]);

  /**
   * Le texte affiché suit la valeur sélectionnée.
   *
   * `options` est volontairement HORS des dépendances : les appelants la
   * construisent en ligne (`optProfs.filter(...)`), donc elle change d'identité
   * à chaque rendu. L'y laisser relançait l'effet en continu — ce qui écrasait
   * la saisie en cours dès qu'un autre champ de la grille se mettait à jour, et
   * pouvait faire boucler le rendu. Seule la valeur compte ici ; le libellé
   * s'en déduit.
   */
  useEffect(() => {
    const opt = options.find(o => o.id === value);
    setTexte(opt ? opt.label : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const saisir = (e: React.ChangeEvent<HTMLInputElement>) => {
    const q = e.target.value;
    setTexte(q);
    setFiltre(q ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase())) : options);
    setOuvert(true);
    if (!q) onChange('');
  };

  const focus = () => { setFiltre(options); setOuvert(true); };

  // Fermeture différée : sans ce délai, le blur précède le clic sur l'option et
  // la sélection ne se ferait jamais.
  const blur = () => {
    blurTimer.set(() => {
      const exact = options.find(o => o.label.toLowerCase() === texte.toLowerCase());
      if (!exact && texte) {
        const courant = options.find(o => o.id === value);
        setTexte(courant ? courant.label : '');
      }
      setOuvert(false);
    }, 180);
  };

  const choisir = (opt: OptionAC) => { setTexte(opt.label); onChange(opt.id); setOuvert(false); };

  return (
    <div style={{ position: 'relative', marginBottom: grand ? 0 : 3 }}>
      <input
        ref={inputRef} type="text" value={texte} disabled={disabled}
        onChange={saisir} onFocus={focus} onBlur={blur}
        placeholder={placeholder} spellCheck={false} autoComplete="off"
        style={{
          width: '100%',
          padding: grand ? '10px 12px' : '3px 5px',
          fontSize: grand ? 14 : 11,
          borderRadius: grand ? 12 : 4,
          // Un champ désactivé doit SE VOIR désactivé. À #f1f1f1 sur fond
          // #f8f9fa, rien ne distinguait « je ne peux pas y toucher » de
          // « c'est rempli » — on essayait, il ne se passait rien, et l'on
          // croyait à une panne.
          border: disabled ? '1px solid #d7dde3'
                           : (grand ? '1px solid #e5e7eb'
                                    : (texte ? '1px solid #3498db' : '1px solid #ccc')),
          background: disabled ? '#e9edf1'
                               : (grand ? (texte ? 'white' : '#f9fafb')
                                        : (texte ? '#f8f9fa' : 'white')),
          color: disabled ? '#6b7280' : undefined,
          cursor: disabled ? 'not-allowed' : undefined,
          outline: 'none', boxSizing: 'border-box',
        }}
      />
      {ouvert && filtre.length > 0 && pos && createPortal(
        <ul style={{
          position: 'fixed', zIndex: 9999,
          left: pos.left, width: pos.width,
          ...(pos.versLeHaut
            ? { bottom: window.innerHeight - pos.top, borderBottom: 'none',
                borderRadius: '4px 4px 0 0' }
            : { top: pos.top, borderTop: 'none', borderRadius: '0 0 4px 4px' }),
          background: 'white', border: '1px solid #ccc',
          maxHeight: HAUTEUR_LISTE, overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
          padding: 0, margin: 0, listStyle: 'none',
        }}>
          {filtre.map(opt => (
            <li key={opt.id} onMouseDown={() => choisir(opt)}
                style={{ padding: grand ? '7px 12px' : '4px 8px',
                         fontSize: grand ? 13 : 11,
                         cursor: 'pointer', borderBottom: '1px solid #f0f0f0' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#eaf4fd')}
                onMouseLeave={e => (e.currentTarget.style.background = 'white')}>
              {opt.label}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </div>
  );
}
