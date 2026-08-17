'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Star, Save, ExternalLink, Loader2 } from 'lucide-react';
import { evaluationsStageApi } from '@/lib/api/stages';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import DataTable from '@/components/ui/DataTable';
import Badge from '@/components/ui/Badge';
import { Pagination } from '@/components/Pagination';
import { formatNote } from '@/lib/formatters';
import { canAccess } from '@/lib/auth';
import type { EvaluationStage } from '@/types/stages';
import type { Column } from '@/components/ui/DataTable';

function EvaluationsStagesContent() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const toast        = useToast();

  const conventionFilter = searchParams.get('convention');

  const [items, setItems]   = useState<EvaluationStage[]>([]);
  const [count, setCount]   = useState(0);
  const [pages, setPages]   = useState(1);
  const [page, setPage]     = useState(1);
  const [loading, setLoading] = useState(true);

  /* inline-edit state */
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft]     = useState<Partial<EvaluationStage>>({});
  const [saving, setSaving]   = useState(false);

  const canEdit = canAccess('stages', 'modifier');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p };
      if (conventionFilter) params.convention = conventionFilter;
      const data = await evaluationsStageApi.list(params);
      setItems(data.results);
      setCount(data.count);
      setPages(data.pages);
      setPage(p);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [conventionFilter]);

  useEffect(() => { load(); }, [load]);

  function startEdit(ev: EvaluationStage) {
    setEditing(ev.id);
    setDraft({
      note_entreprise: ev.note_entreprise,
      note_rapport:    ev.note_rapport,
      note_soutenance: ev.note_soutenance,
      date_soutenance: ev.date_soutenance ?? '',
      observations:    ev.observations ?? '',
    });
  }

  async function saveEdit(id: number) {
    setSaving(true);
    try {
      const updated = await evaluationsStageApi.update(id, draft);
      setItems(prev => prev.map(i => i.id === id ? updated : i));
      setEditing(null);
      toast.success('Évaluation enregistrée');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const columns: Column<EvaluationStage>[] = [
    { key: 'convention', header: 'Convention',
      render: r => (
        <Link href={`/dashboard/stages/conventions/${r.convention}`}
          className="flex items-center gap-1 text-iss-primary hover:underline text-sm">
          #{r.convention} <ExternalLink size={11} />
        </Link>
      )
    },
    { key: 'note_entreprise', header: 'Ent.', align: 'center', width: 'w-20',
      render: r => editing === r.id
        ? <NoteInput value={draft.note_entreprise} onChange={v => setDraft(d => ({ ...d, note_entreprise: v }))} />
        : <span>{formatNote(r.note_entreprise)}</span>
    },
    { key: 'note_rapport', header: 'Rapp.', align: 'center', width: 'w-20',
      render: r => editing === r.id
        ? <NoteInput value={draft.note_rapport} onChange={v => setDraft(d => ({ ...d, note_rapport: v }))} />
        : <span>{formatNote(r.note_rapport)}</span>
    },
    { key: 'note_soutenance', header: 'Sout.', align: 'center', width: 'w-20',
      render: r => editing === r.id
        ? <NoteInput value={draft.note_soutenance} onChange={v => setDraft(d => ({ ...d, note_soutenance: v }))} />
        : <span>{formatNote(r.note_soutenance)}</span>
    },
    { key: 'note_finale', header: 'Finale', align: 'center', width: 'w-20',
      render: r => (
        <span className={`font-bold text-sm ${r.note_finale !== null && r.note_finale < 10 ? 'text-red-600' : 'text-emerald-600'}`}>
          {formatNote(r.note_finale)}
        </span>
      )
    },
    { key: 'est_valide_pfe', header: 'PFE', align: 'center', width: 'w-16',
      render: r => r.est_valide_pfe ? <Badge label="Validé" variant="success" /> : null },
    { key: 'date_soutenance', header: 'Soutenance',
      render: r => editing === r.id
        ? <input type="date" value={draft.date_soutenance as string}
            onChange={e => setDraft(d => ({ ...d, date_soutenance: e.target.value }))}
            className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-36" />
        : <span className="text-xs">{r.date_soutenance ?? '—'}</span>
    },
    ...(canEdit ? [{
      key: '_actions' as keyof EvaluationStage,
      header: '',
      width: 'w-24',
      render: (r: EvaluationStage) => editing === r.id
        ? (
          <button onClick={() => saveEdit(r.id)} disabled={saving}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-white bg-iss-primary hover:bg-iss-primary/90 disabled:opacity-60">
            <Save size={11} />
            {saving ? '…' : 'OK'}
          </button>
        ) : (
          <button onClick={() => startEdit(r)}
            className="text-xs text-iss-gray hover:text-iss-primary px-2 py-1 rounded-lg hover:bg-gray-50">
            Saisir
          </button>
        ),
    }] : []),
  ];

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
            <Star size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-iss-dark">Évaluations de stage</h1>
            <p className="text-sm text-iss-gray">{count} évaluation{count !== 1 ? 's' : ''}</p>
          </div>
        </div>
        {conventionFilter && (
          <Link href="/dashboard/stages/evaluations"
            className="text-sm text-iss-gray hover:text-iss-primary hover:underline">
            ← Toutes les évaluations
          </Link>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">
        <DataTable
          columns={columns}
          data={items}
          loading={loading}
          emptyTitle="Aucune évaluation"
          emptyDesc="Les évaluations apparaîtront ici une fois les conventions terminées"
        />
        {pages > 1 && (
          <div className="px-4 pb-4 border-t border-gray-100 pt-3">
            <Pagination page={page} pages={pages} count={count} onPage={p => load(p)} />
          </div>
        )}
      </div>
    </div>
  );
}

function NoteInput({ value, onChange }: { value: number | null | undefined; onChange: (v: number | null) => void }) {
  return (
    <input type="number" min={0} max={20} step={0.25}
      value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="border border-gray-200 rounded-lg px-2 py-1 text-xs w-16 text-center" />
  );
}

export default function EvaluationsStagesPage() {
  return (
    <Suspense fallback={
      <div className="p-6 flex items-center justify-center">
        <Loader2 size={20} className="animate-spin text-iss-primary" />
      </div>
    }>
      <EvaluationsStagesContent />
    </Suspense>
  );
}
