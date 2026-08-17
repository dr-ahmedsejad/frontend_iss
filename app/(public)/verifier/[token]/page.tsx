'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import { Shield, Loader2 } from 'lucide-react';
import { documentsApi } from '@/lib/api/documents';
import { API_BASE_URL as API } from '@/lib/api';
import { safeImageSrc } from '@/lib/safe-image';
import QrVerifyCard from '@/components/scolarite/QrVerifyCard';
import type { DocumentVerification } from '@/types/documents';

type VerifyResult = DocumentVerification;
interface ActiveInstitution { nom_fr: string; acronyme: string; logo_url: string | null; }

export default function VerifierDocumentPage() {
  const { token } = useParams<{ token: string }>();

  const [loading, setLoading]   = useState(true);
  const [result, setResult]     = useState<VerifyResult | null>(null);
  const [error, setError]       = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [institution, setInstitution] = useState<ActiveInstitution | null>(null);

  useEffect(() => {
    fetch(`${API}/api/v1/parametres/institutions/active/`)
      .then(r => r.ok ? r.json() : null)
      .then((data: ActiveInstitution | null) => { if (data) setInstitution(data); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    async function verify() {
      setLoading(true);
      try {
        const data = await documentsApi.verifier(token);
        setResult(data);
      } catch (e) {
        const err = e as Error;
        if (err.message.includes('429') || err.message.toLowerCase().includes('trop de requêtes')) {
          setRateLimited(true);
        } else if (err.message.includes('404') || err.message.toLowerCase().includes('not found')) {
          setError('Aucun document ne correspond à ce token de vérification.');
        } else {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }
    if (token) verify();
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4"
      style={{ background: 'linear-gradient(135deg, #f0f7f3 0%, #e8f4ec 100%)' }}>

      {/* Branding — logo de l'institution principale */}
      <div className="flex flex-col items-center text-center mb-8">
        {(() => {
          const safe = safeImageSrc(institution?.logo_url);
          return safe ? (
            <Image src={safe} alt={institution?.nom_fr || 'Logo'} width={72} height={72}
              unoptimized className="h-16 w-auto object-contain mb-3 drop-shadow-sm" />
          ) : (
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
              <span className="text-white font-bold text-lg">{institution?.acronyme ?? '…'}</span>
            </div>
          );
        })()}
        {institution?.nom_fr && <p className="text-base font-bold text-iss-dark">{institution.nom_fr}</p>}
        <p className="text-sm text-iss-gray">Vérification de document</p>
      </div>

      <div className="w-full max-w-md">
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-10 shadow-card flex flex-col items-center gap-4">
            <Loader2 size={36} className="text-iss-primary animate-spin" />
            <p className="text-sm text-iss-gray">Vérification en cours…</p>
          </div>
        )}

        {!loading && rateLimited && (
          <div className="bg-white rounded-2xl border border-orange-200 p-8 shadow-card text-center">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-orange-500" />
            </div>
            <h2 className="text-lg font-bold text-iss-dark mb-2">Trop de tentatives</h2>
            <p className="text-sm text-iss-gray">
              Vous avez effectué trop de vérifications. Veuillez réessayer dans quelques minutes.
            </p>
          </div>
        )}

        {!loading && error && !rateLimited && (
          <div className="bg-white rounded-2xl border border-red-200 p-8 shadow-card text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Shield size={28} className="text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-iss-dark mb-2">Document introuvable</h2>
            <p className="text-sm text-iss-gray">{error}</p>
          </div>
        )}

        {!loading && result && (
          <QrVerifyCard document={result} />
        )}
      </div>
    </div>
  );
}
