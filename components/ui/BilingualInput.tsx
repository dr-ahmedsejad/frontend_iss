'use client';

import { useState } from 'react';
import type { Lang } from '@/lib/i18n';

interface BilingualInputProps {
  labelFr:      string;
  labelAr?:     string;
  valueFr:      string;
  valueAr:      string;
  onChangeFr:   (v: string) => void;
  onChangeAr:   (v: string) => void;
  required?:    boolean;
  errorFr?:     string;
  errorAr?:     string;
  readOnly?:    boolean;
  multiline?:   boolean;
  className?:   string;
}

/**
 * Couple FR/AR avec toggle de direction.
 * Affiche les deux champs côte à côte sur desktop, empilés sur mobile.
 * Le champ AR est `dir="rtl"` automatiquement.
 */
export default function BilingualInput({
  labelFr, labelAr,
  valueFr, valueAr,
  onChangeFr, onChangeAr,
  required, errorFr, errorAr,
  readOnly, multiline, className = '',
}: BilingualInputProps) {
  const [activeLang, setActiveLang] = useState<Lang>('fr');

  const base = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-iss-primary/30 focus:border-iss-primary transition-all bg-white disabled:bg-gray-50 disabled:text-gray-400';

  function renderField(lang: Lang) {
    const value  = lang === 'fr' ? valueFr : valueAr;
    const onChange = lang === 'fr' ? onChangeFr : onChangeAr;
    const label  = lang === 'fr' ? labelFr : (labelAr ?? labelFr + ' (AR)');
    const error  = lang === 'fr' ? errorFr : errorAr;
    const hasErr = !!error;

    return (
      <div key={lang} className="flex-1 min-w-0">
        <label className="flex items-center gap-1.5 text-sm font-medium text-iss-dark-soft mb-1">
          {label}
          {required && lang === 'fr' && <span className="text-iss-secondary">*</span>}
          <span className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
            lang === 'fr' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
          }`}>{lang.toUpperCase()}</span>
        </label>
        {multiline ? (
          <textarea
            value={value}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            rows={3}
            placeholder={lang === 'fr' ? 'En français…' : 'بالعربية…'}
            className={`${base} ${hasErr ? 'border-red-400 focus:ring-red-200' : ''} resize-none`}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            readOnly={readOnly}
            dir={lang === 'ar' ? 'rtl' : 'ltr'}
            placeholder={lang === 'fr' ? 'En français…' : 'بالعربية…'}
            className={`${base} ${hasErr ? 'border-red-400 focus:ring-red-200' : ''}`}
          />
        )}
        {error && <p className="text-[11px] text-red-600 font-medium mt-1">{error}</p>}
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Desktop : côte à côte / Mobile : toggle */}
      <div className="hidden sm:flex gap-3">
        {renderField('fr')}
        {renderField('ar')}
      </div>

      {/* Mobile : toggle FR/AR */}
      <div className="sm:hidden">
        <div className="flex gap-1 mb-2">
          {(['fr', 'ar'] as Lang[]).map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setActiveLang(l)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                activeLang === l
                  ? 'text-white shadow-sm'
                  : 'text-iss-gray bg-gray-100 hover:bg-gray-200'
              }`}
              style={activeLang === l ? { background: 'linear-gradient(135deg, #006633, #008844)' } : {}}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
        {renderField(activeLang)}
      </div>
    </div>
  );
}
