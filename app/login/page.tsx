'use client';

import { API_BASE_URL as API } from '@/lib/api';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, LogIn, ShieldAlert, LayoutDashboard } from 'lucide-react';
import Image from 'next/image';
import { login, getStoredUser, type SemestreType } from '@/lib/auth';
import { safeNextUrl } from '@/lib/safe-redirect';
import { safeImageSrc } from '@/lib/safe-image';
interface Year { id: number; annee: string; }
interface Institution { nom_fr: string; acronyme: string; logo_url: string | null; }

function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  // Valide ?next= pour empêcher un open redirect (S1)
  const nextUrl      = safeNextUrl(searchParams.get('next'), '/dashboard');
  const sessionExpired = searchParams.has('next');

  const [username, setUsername]       = useState('');
  const [password, setPassword]       = useState('');
  const [showPwd,  setShowPwd]        = useState(false);
  const [loading,  setLoading]        = useState(false);
  const [error,    setError]          = useState('');
  const [years,    setYears]          = useState<Year[]>([]);
  const [annee,    setAnnee]          = useState('');
  const [semestre, setSemestre]       = useState<SemestreType>('Impairs');
  const [blockedUntil, setBlockedUntil] = useState<number | null>(null);
  const [remaining,    setRemaining]   = useState(0);
  const [institution,  setInstitution] = useState<Institution | null>(null);

  useEffect(() => {
    if (!blockedUntil) return;
    const tick = setInterval(() => {
      const left = Math.ceil((blockedUntil - Date.now()) / 1000);
      if (left <= 0) { setBlockedUntil(null); setRemaining(0); clearInterval(tick); }
      else setRemaining(left);
    }, 1000);
    return () => clearInterval(tick);
  }, [blockedUntil]);

  useEffect(() => {
    if (getStoredUser() && !sessionExpired) router.replace('/dashboard');
  }, [router, sessionExpired]);

  useEffect(() => {
    fetch(`${API}/api/v1/parametres/annees/all/`)
      .then(r => r.json())
      .then((data: Year[] | { results: Year[] }) => {
        const list = Array.isArray(data) ? data : (data.results ?? []);
        setYears(list);
        if (list.length > 0) setAnnee(list[0].annee);
      })
      .catch(() => {});
  }, []);

  // Pre-cocher le semestre actif d'apres la table Semaine en BD (calendrier reel
  // de l'institution). Fallback silencieux sur 'Impairs' en cas d'echec.
  useEffect(() => {
    fetch(`${API}/api/v1/parametres/semaines/actif/`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { type_semestre?: string } | null) => {
        if (data?.type_semestre === 'P') setSemestre('Pairs');
        else if (data?.type_semestre === 'I') setSemestre('Impairs');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API}/api/v1/parametres/institutions/active/`)
      .then(r => r.ok ? r.json() : null)
      .then((data: Institution | null) => { if (data) setInstitution(data); })
      .catch(() => {});
  }, []);

  // L'utilisateur est considéré comme étudiant si son identifiant est un matricule étudiant
  // (5 à 7 chiffres uniquement — exclut les numéros de téléphone à 8 chiffres des enseignants)
  const isEtudiantMode = /^\d{5,7}$/.test(username.trim());

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (blockedUntil) return;
    // L'année est facultative : si absente, le backend utilise le contexte enregistré en base
    setError('');
    setLoading(true);
    try {
      const user = await login(
        username, password,
        isEtudiantMode ? undefined : annee,
        isEtudiantMode ? undefined : semestre,
      );
      if (user.role === 'etudiant') {
        router.push(user.doit_changer_mdp ? '/dashboard/portail/premier-acces' : '/dashboard/portail');
      } else {
        router.push(nextUrl);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de connexion';
      if (msg.toLowerCase().includes('bloqué') || msg.toLowerCase().includes('tentatives') || msg.toLowerCase().includes('réessayez')) {
        const minMatch = msg.match(/(\d+)\s*minute/i);
        const secMatch = msg.match(/(\d+)\s*seconde/i);
        const seconds  = minMatch ? parseInt(minMatch[1], 10) * 60
                       : secMatch ? parseInt(secMatch[1], 10)
                       : 15 * 60;
        setBlockedUntil(Date.now() + seconds * 1000);
        setRemaining(seconds);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // NOUVEAU DESIGN DES INPUTS (Apprenant, arrondi, bordure teintée)
  const INPUT_CLASS = "w-full px-4 py-3.5 rounded-xl border-2 border-[#006633]/15 text-sm text-gray-900 bg-white hover:border-[#006633]/40 focus:outline-none focus:border-[#006633] focus:ring-4 focus:ring-[#006633]/10 transition-all duration-200 placeholder:text-gray-400";

  return (
    <div className="min-h-screen flex w-full bg-white font-sans">
      
      {/* ========================================================= */}
      {/* PANNEAU GAUCHE : Branding SIGA (Masqué sur mobile/tablette) */}
      {/* ========================================================= */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between relative overflow-hidden"
           style={{ background: 'linear-gradient(145deg, #004d24 0%, #006633 100%)' }}>
        
        {/* Motifs de fond discrets purs (blancs) */}
        <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] opacity-[0.06] pointer-events-none rounded-full blur-[80px]"
             style={{ backgroundColor: '#ffffff' }} />
        <div className="absolute bottom-[-10%] left-[-10%] w-[300px] h-[300px] opacity-[0.04] pointer-events-none rounded-full blur-[80px]"
             style={{ backgroundColor: '#ffffff' }} />
        <div className="absolute inset-0 opacity-[0.03]"
             style={{ backgroundImage: 'linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />

        {/* Contenu centré */}
        <div className="p-8 lg:p-12 relative z-10 flex-1 flex flex-col justify-center items-center text-center">
          
          {/* Logo SIGA Abstrait épuré (Glassmorphism) */}
          <div className="mb-6 flex justify-center">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-xl relative overflow-hidden"
                 style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.02) 100%)' }}>
              <LayoutDashboard size={30} className="text-white relative z-10 drop-shadow-md" />
            </div>
          </div>
          
          <h1 className="text-5xl xl:text-6xl font-extrabold text-white tracking-tight mb-4">
            SIGA
          </h1>
          
          {/* Sous-titre avec lignes décoratives aux couleurs du logo/drapeau */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 w-full px-4">
            {/* Trait de gauche : OR */}
            <span className="w-8 sm:w-10 h-[2.5px] bg-[#E5C018] rounded-full shadow-[0_0_8px_rgba(229,192,24,0.4)] shrink-0"></span>
            
            <p className="text-white/90 text-xs sm:text-sm md:text-base font-semibold tracking-widest uppercase">
              Système Intégré de Gestion Académique
            </p>
            
            {/* Trait de droite : ROUGE */}
            <span className="w-8 sm:w-10 h-[2.5px] bg-[#C82020] rounded-full shadow-[0_0_8px_rgba(200,32,32,0.4)] shrink-0"></span>
          </div>

        </div>

        <div className="p-8 lg:p-12 relative z-10 flex justify-center items-end">
          <p className="text-white/40 text-xs sm:text-sm text-center">© {new Date().getFullYear()} SIGA. Tous droits réservés.</p>
        </div>
      </div>


      {/* ========================================================= */}
      {/* PANNEAU DROIT : Formulaire de connexion                   */}
      {/* ========================================================= */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-5 sm:p-8 lg:p-12 relative bg-gray-50/30">
        
        <div className="w-full max-w-sm sm:max-w-md">
          
          {/* Logo institution dynamique centré */}
          <div className="flex flex-col items-center mb-8 sm:mb-10 text-center">
            {(() => {
              const safe = safeImageSrc(institution?.logo_url);
              return safe ? (
                <Image src={safe} alt={institution?.nom_fr || 'Logo'}
                  width={64} height={64} unoptimized
                  className="h-14 sm:h-16 w-auto object-contain mb-5 sm:mb-6 drop-shadow-sm" />
              ) : null;
            })()}
            {!safeImageSrc(institution?.logo_url) && (
              <div className="h-14 sm:h-16 w-14 sm:w-16 rounded-2xl flex items-center justify-center mb-5 sm:mb-6"
                   style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
                <span className="text-white font-bold text-lg">{institution?.acronyme ?? '…'}</span>
              </div>
            )}
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">Espace d'authentification</h2>
            <p className="text-gray-500 mt-2 text-sm">
              Veuillez saisir vos identifiants pour accéder au portail.
            </p>
          </div>

          {/* Alertes d'erreur */}
          <div className="space-y-3 mb-6">
            {sessionExpired && !error && (
              <div className="p-4 rounded-xl bg-yellow-50 border-l-4 border-yellow-500 text-sm text-yellow-800">
                Votre session a expiré. Veuillez vous reconnecter.
              </div>
            )}

            {blockedUntil && (
              <div className="p-4 rounded-xl bg-red-50 border-l-4 border-red-600 text-sm text-red-800 flex items-start gap-3">
                <ShieldAlert size={20} className="shrink-0 text-red-600" />
                <div>
                  <p className="font-semibold">Accès temporairement bloqué</p>
                  <p className="mt-1 opacity-90">
                    Réessayez dans <strong>{Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</strong> minutes.
                  </p>
                </div>
              </div>
            )}

            {error && !blockedUntil && (
              <div className="p-4 rounded-xl bg-red-50 border-l-4 border-red-600 text-sm text-red-800 font-medium">
                {error}
              </div>
            )}
          </div>

          {/* Formulaire */}
          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            
            {/* Username */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Identifiant utilisateur</label>
              <input type="text" value={username} onChange={e => setUsername(e.target.value)}
                required autoFocus placeholder="Ex: ahmed"
                autoComplete="username"
                suppressHydrationWarning
                className={INPUT_CLASS} />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-end mb-1.5 ml-1">
                <label className="block text-sm font-semibold text-gray-700">Mot de passe</label>
              </div>
              <div className="relative">
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  autoComplete="current-password"
                  suppressHydrationWarning
                  className={INPUT_CLASS} />
                <button type="button" onClick={() => setShowPwd(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#006633] transition-colors p-1">
                  {showPwd ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Sélecteurs Année et Semestre — masqués en mode étudiant */}
            {isEtudiantMode && (
              <p className="text-xs text-[#006633] bg-[#006633]/5 rounded-lg px-3 py-2 border border-[#006633]/20">
                Connexion portail étudiant — identifiant numérique détecté.
              </p>
            )}
            <div className={`flex flex-col sm:flex-row gap-4 pt-1 sm:pt-2 ${isEtudiantMode ? 'hidden' : ''}`}>
              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Année cible</label>
                <div className="relative">
                  <select value={annee} onChange={e => setAnnee(e.target.value)}
                    className={`${INPUT_CLASS} appearance-none cursor-pointer font-medium text-gray-700`}>
                    {years.length === 0 && <option value="">Chargement…</option>}
                    {years.map(y => <option key={y.id} value={y.annee}>{y.annee}</option>)}
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <label className="block text-sm font-semibold text-gray-700 mb-1.5 ml-1">Période</label>
                <div className="relative">
                  <select value={semestre} onChange={e => setSemestre(e.target.value as SemestreType)} required 
                    className={`${INPUT_CLASS} appearance-none cursor-pointer font-medium text-gray-700`}>
                    <option value="Impairs">Semestres Impairs</option>
                    <option value="Pairs">Semestres Pairs</option>
                  </select>
                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
                    <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/></svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Bouton Connexion */}
            <button type="submit" disabled={loading || !!blockedUntil}
              className="mt-4 sm:mt-6 w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white transition-all duration-200 hover:shadow-lg hover:bg-[#004d24] active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#006633' }}>
              {loading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <><LogIn size={18} /> Se connecter</>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-white">
        <span className="w-8 h-8 border-4 border-[#006633]/30 border-t-[#006633] rounded-full animate-spin" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}