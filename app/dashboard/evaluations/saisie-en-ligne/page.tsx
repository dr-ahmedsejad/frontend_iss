'use client';

import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileSpreadsheet, Info, Loader2 } from 'lucide-react';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { downloadBlob } from '@/lib/downloadBlob';
import { formatDateTime } from '@/lib/formatters';
import {
  brouillonKeys, exporterBrouillons, fetchBrouillons, type BrouillonNote,
} from '@/lib/api/portail-en-ligne';

const VERT = 'linear-gradient(135deg,#006633,#008844)';

/** Les brouillons, groupés par session puis par élément : c'est l'unité qu'on
 *  ressaisit d'un coup sur le serveur de travail. */
function grouper(lignes: BrouillonNote[]) {
  const groupes = new Map<string, { session: string; sessionId: number; em: string; emId: number | null;
                                    intitule: string; lignes: BrouillonNote[] }>();
  for (const l of lignes) {
    const cle = `${l.session_id}|${l.em_id ?? ''}`;
    if (!groupes.has(cle)) {
      groupes.set(cle, { session: l.session_libelle, sessionId: l.session_id, em: l.em_code,
                         emId: l.em_id, intitule: l.em_intitule, lignes: [] });
    }
    groupes.get(cle)!.lignes.push(l);
  }
  return [...groupes.values()];
}

export default function SaisieEnLignePage() {
  const toast = useToast();
  const [export_, setExport] = useState<string | null>(null);
  const { data, isLoading } = useQuery({ queryKey: brouillonKeys.list(), queryFn: () => fetchBrouillons() });
  const groupes = useMemo(() => grouper(data ?? []), [data]);

  async function exporter(sessionId: number, emId: number | null, nom: string) {
    const cle = `${sessionId}|${emId ?? ''}`;
    setExport(cle);
    try {
      downloadBlob(await exporterBrouillons(sessionId, emId ?? undefined), `brouillon_${nom || 'notes'}.xlsx`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setExport(null);
    }
  }

  return (
    <div className="max-w-5xl space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: VERT }}>
          <FileSpreadsheet size={14} className="text-white" />
        </div>
        <h1 className="text-xl font-bold text-iss-dark">Saisie de notes en ligne</h1>
      </div>

      <div className="flex gap-2 rounded-2xl border px-4 py-3 text-xs text-blue-950"
        style={{ background: 'rgba(59,130,246,0.08)', borderColor: 'rgba(59,130,246,0.30)' }}>
        <Info size={14} className="shrink-0 mt-0.5 text-blue-700" />
        <p>Notes saisies par les enseignants sur le portail en ligne. Ce sont des <strong>brouillons</strong> :
          aucune n’est une note officielle. Exportez-les en tableur et <strong>ressaisissez-les</strong> sur le
          serveur de travail.</p>
      </div>

      {isLoading && <p className="text-sm text-iss-gray">Chargement…</p>}
      {data?.length === 0 && (
        <p className="text-sm text-iss-gray bg-white rounded-2xl border border-gray-100 p-6 text-center">
          Aucun brouillon de notes pour l’instant.
        </p>
      )}

      {groupes.map(g => {
        const cle = `${g.sessionId}|${g.emId ?? ''}`;
        return (
          <div key={cle} className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-iss-dark">
                  <code className="text-xs">{g.em || '—'}</code> {g.intitule}
                </p>
                <p className="text-xs text-iss-gray">{g.session} · {g.lignes.length} étudiant{g.lignes.length > 1 ? 's' : ''}</p>
              </div>
              <button onClick={() => exporter(g.sessionId, g.emId, g.em)} disabled={export_ === cle}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-60"
                style={{ background: VERT }}>
                {export_ === cle ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                Exporter
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Matricule</th><th>Nom</th><th className="text-center">CC</th><th className="text-center">TP</th>
                      <th className="text-center">Examen</th><th>Saisi par</th><th>Modifié le</th></tr>
                </thead>
                <tbody>
                  {g.lignes.map(l => (
                    <tr key={l.id}>
                      <td><code className="text-xs">{l.etudiant_matricule || '—'}</code></td>
                      <td>{l.etudiant_nom || '—'}</td>
                      <td className="text-center">{l.cc ?? '—'}</td>
                      <td className="text-center">{l.tp ?? '—'}</td>
                      <td className="text-center">{l.exam ?? '—'}</td>
                      <td className="text-xs">{l.saisi_par_nom ?? '—'}</td>
                      <td className="text-xs whitespace-nowrap">{formatDateTime(l.modifie_le)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
