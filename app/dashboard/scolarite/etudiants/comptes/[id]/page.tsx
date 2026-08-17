'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, KeyRound, Save, AlertCircle, CheckCircle2, UserPlus } from 'lucide-react';
import { etudiantsApi } from '@/lib/api/scolarite';
import FormField from '@/components/ui/FormField';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { useToast, ToastContainer } from '@/components/ui/Toast';
import { ConfirmModal } from '@/components/ConfirmModal';
import { canAccess } from '@/lib/auth';
import type { Etudiant } from '@/types/scolarite';

export default function CompleterEtudiantComptePage() {
  const params  = useParams();
  const router  = useRouter();
  const toast   = useToast();
  const id      = Number(params.id);

  const [etudiant, setEtudiant] = useState<Etudiant | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  const [cni, setCni]               = useState('');
  const [nbac, setNbac]             = useState('');
  const [telephone, setTelephone]   = useState('');
  const [email, setEmail]           = useState('');

  const [creerApresSave, setCreerApresSave] = useState(true);
  const [confirmCreerOpen, setConfirmCreerOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const canEdit  = canAccess('scolarite_etudiants', 'modifier');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const e = await etudiantsApi.get(id);
      setEtudiant(e);
      setCni(e.cni ?? '');
      setNbac(e.nbac ?? '');
      setTelephone(e.telephone ?? '');
      setEmail(e.email ?? '');
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const cniValide  = cni.trim().length > 0;
  const nbacValide = nbac.trim().length > 0;
  const peutCreerCompte = cniValide && nbacValide;

  async function handleSave() {
    if (!etudiant) return;
    setSaving(true);
    try {
      await etudiantsApi.update(id, {
        cni:       cni.trim() || null,
        nbac:      nbac.trim() || null,
        telephone: telephone.trim(),
        email:     email.trim(),
      });
      toast.success('Données enregistrées');
      // Recharger pour avoir l'etat a jour
      await load();
      // Si l'utilisateur veut creer le compte dans la foulee
      if (creerApresSave && peutCreerCompte) {
        setConfirmCreerOpen(true);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreerCompte() {
    setCreating(true);
    try {
      const data = await etudiantsApi.creerComptes({ etudiant_ids: [id] });
      if (data.crees_count > 0) {
        toast.success(`Compte créé pour ${etudiant?.matricule}`);
        setConfirmCreerOpen(false);
        // Retour vers la liste des comptes
        setTimeout(() => router.push('/dashboard/scolarite/etudiants/comptes'), 600);
      } else {
        const raison = data.ignores[0]?.raison ?? 'Inconnu';
        toast.error(`Compte non créé : ${raison}`);
        setConfirmCreerOpen(false);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  if (loading) return <LoadingSkeleton rows={6} cols={2} className="p-6" />;
  if (!etudiant) return <p className="text-iss-gray p-6">Étudiant introuvable.</p>;

  const fullName = `${etudiant.prenom_fr} ${etudiant.nom_fr || etudiant.nom}`;
  const emailPropose = `${etudiant.matricule}@isms.esp.mr`;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <ToastContainer toasts={toast.toasts} onClose={toast.removeToast} />

      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard/scolarite/etudiants/comptes"
          className="p-2 rounded-xl text-iss-gray hover:bg-gray-50 hover:text-iss-primary transition-colors">
          <ArrowLeft size={18} />
        </Link>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg, #004d24, #006633)' }}>
          <KeyRound size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-iss-dark">Compléter pour création de compte</h1>
          <p className="text-sm text-iss-gray">{fullName} — <span className="font-mono">{etudiant.matricule}</span></p>
        </div>
      </div>

      {/* Statut actuel */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5">
        <p className="text-xs font-bold text-iss-gray uppercase tracking-wide mb-3">État actuel</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <StatusRow label="CNI / NNI"      ok={cniValide}  value={cni  || '— manquant —'} />
          <StatusRow label="N° BAC"         ok={nbacValide} value={nbac || '— manquant —'} />
        </div>
        <p className="text-[11px] text-iss-gray mt-4">
          Une fois le CNI et le N° BAC renseignés, le compte sera créable avec :
          <br />
          • <strong>Login</strong> = NNI ({cni || '?'}) — au 1<sup>er</sup> login il devient automatiquement le matricule <strong>{etudiant.matricule}</strong>
          <br />
          • <strong>Mot de passe initial</strong> = N° BAC ({nbac || '?'}) — devra être changé au 1<sup>er</sup> login
          <br />
          • <strong>Email</strong> = <span className="font-mono">{emailPropose}</span>
        </p>
      </div>

      {/* Formulaire */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-card p-5 space-y-4">
        <p className="text-xs font-bold text-iss-gray uppercase tracking-wide">Données à compléter</p>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="CNI / NNI *" value={cni}
            onChange={e => setCni(e.target.value)}
            placeholder="Ex : 5662025219"
            disabled={!canEdit}
          />
          <FormField label="N° BAC *" value={nbac}
            onChange={e => setNbac(e.target.value)}
            placeholder="Ex : 39796"
            disabled={!canEdit}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Téléphone (optionnel)" value={telephone}
            onChange={e => setTelephone(e.target.value)}
            disabled={!canEdit}
          />
          <FormField label="Email perso (optionnel)" type="email" value={email}
            onChange={e => setEmail(e.target.value)}
            disabled={!canEdit}
          />
        </div>

        <label className="flex items-center gap-2 pt-2 cursor-pointer">
          <input type="checkbox" checked={creerApresSave}
            onChange={e => setCreerApresSave(e.target.checked)}
            disabled={!canEdit}
            className="rounded border-gray-300"
          />
          <span className="text-sm text-iss-dark">Créer le compte portail tout de suite après l&apos;enregistrement</span>
        </label>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Link href="/dashboard/scolarite/etudiants/comptes"
          className="px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-iss-gray hover:bg-gray-50">
          Annuler
        </Link>
        <button onClick={handleSave}
          disabled={saving || !canEdit || (!cniValide && !nbacValide)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #006633, #008844)' }}>
          {saving
            ? <>Enregistrement…</>
            : creerApresSave && peutCreerCompte
              ? <><UserPlus size={15} /> Enregistrer et créer le compte</>
              : <><Save size={15} /> Enregistrer</>
          }
        </button>
      </div>

      <ConfirmModal
        open={confirmCreerOpen}
        title="Créer le compte"
        message={`Créer le compte portail pour ${etudiant.matricule} ? Login = ${cni}, mot de passe initial = ${nbac}.`}
        confirmLabel="Créer le compte"
        variant="success"
        onConfirm={handleCreerCompte}
        onCancel={() => setConfirmCreerOpen(false)}
        loading={creating}
      />
    </div>
  );
}

function StatusRow({ label, ok, value }: { label: string; ok: boolean; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <div className={`mt-0.5 ${ok ? 'text-emerald-600' : 'text-red-500'}`}>
        {ok ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
      </div>
      <div>
        <div className="text-[11px] font-bold text-iss-gray uppercase tracking-wide">{label}</div>
        <div className={`text-sm font-medium mt-0.5 ${ok ? 'text-iss-dark font-mono' : 'text-red-500 italic'}`}>{value}</div>
      </div>
    </div>
  );
}
