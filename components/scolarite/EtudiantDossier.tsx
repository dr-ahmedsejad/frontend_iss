'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  X, User, BookOpen, FileText, Briefcase, UserX, Download,
  ChevronRight, ExternalLink, Camera,
} from 'lucide-react';
import { inscriptionsAdminApi, inscriptionsPedaApi } from '@/lib/api/inscriptions';
import { notesApi } from '@/lib/api/evaluations';
import { conventionsApi } from '@/lib/api/stages';
import { documentsApi } from '@/lib/api/documents';
import { etudiantsApi } from '@/lib/api/scolarite';
import { apiFetch, API_BASE_URL as API } from '@/lib/api';
import { validateUpload } from '@/lib/file-validation';
import StatusPill from '@/components/ui/StatusPill';
import Badge from '@/components/ui/Badge';
import LoadingSkeleton from '@/components/ui/LoadingSkeleton';
import { formatDate, formatNote, formatMontant } from '@/lib/formatters';
import { TYPE_DOCUMENT_LABELS } from '@/types/documents';
import type { Etudiant } from '@/types/scolarite';
import type { InscriptionAdministrative, InscriptionPedagogique } from '@/types/inscriptions';
import type { Note } from '@/types/evaluations';
import type { ConventionStage } from '@/types/stages';
import type { DocumentOfficiel } from '@/types/documents';
type Tab = 'identite' | 'inscriptions' | 'notes' | 'stages' | 'absences' | 'documents';

interface AbsenceRecord {
  date:          string;
  em_intitule?:  string;
  code_em?:      string;
  statut?:       string;
  justifiee?:    boolean;
  type_seance?:  string;
}

interface EtudiantDossierProps {
  etudiant: Etudiant;
  onClose:  () => void;
}

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: 'identite',     label: 'Identité',     icon: User      },
  { key: 'inscriptions', label: 'Inscriptions',  icon: BookOpen  },
  { key: 'notes',        label: 'Notes',         icon: FileText  },
  { key: 'stages',       label: 'Stages',        icon: Briefcase },
  { key: 'absences',     label: 'Absences',      icon: UserX     },
  { key: 'documents',    label: 'Documents',     icon: FileText  },
];

function InfoCell({ label, value, rtl }: { label: string; value?: string | null; rtl?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm text-iss-dark font-medium" dir={rtl ? 'rtl' : undefined}>{value || '—'}</p>
    </div>
  );
}

function TabSkeleton() {
  return <div className="p-5"><LoadingSkeleton rows={4} cols={3} /></div>;
}

function EmptyTab({ message }: { message: string }) {
  return (
    <div className="py-12 text-center text-iss-gray text-sm">{message}</div>
  );
}

export default function EtudiantDossier({ etudiant, onClose }: EtudiantDossierProps) {
  const [tab, setTab] = useState<Tab>('identite');
  const [photoUrl,     setPhotoUrl]     = useState<string | null>(null);
  const [uploadingPic, setUploadingPic] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [inscAdmin,   setInscAdmin]   = useState<InscriptionAdministrative[]>([]);
  const [inscPeda,    setInscPeda]    = useState<InscriptionPedagogique[]>([]);
  const [notes,       setNotes]       = useState<Note[]>([]);
  const [conventions, setConventions] = useState<ConventionStage[]>([]);
  const [absences,    setAbsences]    = useState<AbsenceRecord[]>([]);
  const [documents,   setDocuments]   = useState<DocumentOfficiel[]>([]);

  const [loadingTab, setLoadingTab] = useState(false);

  const loadTab = useCallback(async (t: Tab) => {
    if (t === 'identite') return;
    setLoadingTab(true);
    try {
      switch (t) {
        case 'inscriptions': {
          const [admin, peda] = await Promise.all([
            inscriptionsAdminApi.list({ etudiant: etudiant.id, page_size: 50 }).then(r => r.results),
            inscriptionsPedaApi.list({ etudiant: etudiant.id, page_size: 100 }).then(r => r.results),
          ]);
          setInscAdmin(admin);
          setInscPeda(peda);
          break;
        }
        case 'notes': {
          const r = await notesApi.list({ etudiant: etudiant.id, page_size: 200 });
          setNotes(r.results);
          break;
        }
        case 'stages': {
          const r = await conventionsApi.list({ etudiant: etudiant.id, page_size: 50 });
          setConventions(r.results);
          break;
        }
        case 'absences': {
          const raw = await apiFetch<AbsenceRecord[] | { results: AbsenceRecord[] }>(
            `/api/v1/absences/etudiants/${etudiant.id}/par-etudiant/`
          );
          setAbsences(Array.isArray(raw) ? raw : raw.results ?? []);
          break;
        }
        case 'documents': {
          const raw = await documentsApi.byEtudiant(etudiant.id);
          setDocuments(Array.isArray(raw) ? raw : (raw as { results: DocumentOfficiel[] }).results ?? []);
          break;
        }
      }
    } catch {
      // ignore — empty state already shown
    } finally {
      setLoadingTab(false);
    }
  }, [etudiant.id]);

  useEffect(() => { loadTab(tab); }, [tab, loadTab]);

  const photo = photoUrl
    ?? (etudiant.photo
      ? (etudiant.photo.startsWith('http') ? etudiant.photo : `${API}${etudiant.photo}`)
      : null);

  const fullName = [etudiant.prenom_fr, etudiant.nom_fr].filter(Boolean).join(' ');

  // Inscription actuelle (filière/niveau/année RÉELS). Les champs plats filiere_nom /
  // niveau_nom reflètent la 1re année (tronc commun, ex. LPSTAT L1) → on préfère la
  // dernière inscription admin (ex. SEA L3 2025-2026), avec repli sur les champs plats.
  const insc           = etudiant.inscription_actuelle;
  const curFiliereNom  = insc?.filiere_nom  ?? etudiant.filiere_nom;
  const curFiliereCode = insc?.filiere_code ?? etudiant.filiere_code;
  const curNiveau      = insc?.niveau ?? etudiant.niveau ?? etudiant.niveau_nom;
  const curAnnee       = insc?.annee_universitaire ?? null;
  // Département = département ACADÉMIQUE de la filière actuelle (pas la classe legacy).
  const curDept        = insc?.departement_academique_nom ?? etudiant.departement_nom;

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateUpload(file, { maxSizeMb: 2, accept: 'image/jpeg,image/png,image/webp' });
    if (err) { alert(err); e.target.value = ''; return; }
    setUploadingPic(true);
    try {
      const updated = await etudiantsApi.uploadPhoto(etudiant.id, file);
      const url = updated.photo
        ? (updated.photo.startsWith('http') ? updated.photo : `${API}${updated.photo}`)
        : null;
      setPhotoUrl(url);
    } catch {
      // silently ignore — photo stays unchanged
    } finally {
      setUploadingPic(false);
      if (photoInputRef.current) photoInputRef.current.value = '';
    }
  }

  async function handleDownloadDoc(doc: DocumentOfficiel) {
    try {
      const blob = await documentsApi.telecharger(doc.id);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `${doc.type_document}_${etudiant.matricule}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* noop */ }
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-card overflow-hidden">

      {/* ── Bandeau identité rapide ─────────────────────────────────────────── */}
      <div className="flex items-start gap-4 p-5 border-b border-gray-100"
        style={{ background: 'linear-gradient(135deg, #f0fdf4, #f8fafc)' }}>

        {/* Photo — clic pour changer */}
        <div className="shrink-0 relative group">
          {photo
            ? <img src={photo} alt={fullName} className="w-16 h-16 rounded-xl object-cover border-2 border-white shadow-sm" />
            : <div className="w-16 h-16 rounded-xl flex items-center justify-center border-2 border-white shadow-sm"
                style={{ background: 'rgba(0,102,51,0.1)' }}>
                <User size={28} style={{ color: '#006633' }} />
              </div>
          }
          {/* Overlay changement */}
          <button
            type="button"
            onClick={() => photoInputRef.current?.click()}
            disabled={uploadingPic}
            className="absolute inset-0 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-100"
            style={{ background: 'rgba(0,0,0,0.45)' }}
            title="Changer la photo"
          >
            {uploadingPic
              ? <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Camera size={18} className="text-white" />
            }
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoChange}
          />
        </div>

        {/* Infos de base */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-iss-dark truncate">{fullName || '—'}</h2>
            <StatusPill statut={etudiant.statut_effectif ?? etudiant.statut} />
          </div>
          {etudiant.nom_ar && (
            <p className="text-sm text-iss-gray font-medium" dir="rtl">
              {[etudiant.prenom_ar, etudiant.nom_ar].filter(Boolean).join(' ')}
            </p>
          )}
          <p className="text-xs font-mono text-iss-gray mt-0.5">{etudiant.matricule}</p>
          <div className="flex flex-wrap gap-3 mt-2">
            {curFiliereNom && (
              <span className="text-xs bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full font-semibold">
                {curFiliereCode ? `${curFiliereCode} — ` : ''}{curFiliereNom}
              </span>
            )}
            {curNiveau && (
              <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-semibold">
                {curNiveau}
              </span>
            )}
            {curAnnee && (
              <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-semibold">
                {curAnnee}
              </span>
            )}
            {curDept && (
              <span className="text-xs bg-slate-100 text-slate-600 border border-slate-200 px-2 py-0.5 rounded-full font-semibold">
                {curDept}
              </span>
            )}
          </div>
        </div>

        {/* Fermer */}
        <button onClick={onClose}
          className="shrink-0 p-2 rounded-xl text-iss-gray hover:bg-white hover:text-iss-dark transition-colors">
          <X size={18} />
        </button>
      </div>

      {/* ── Onglets ─────────────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-4 pt-3 overflow-x-auto border-b border-gray-100">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold whitespace-nowrap rounded-t-lg border-b-2 transition-all -mb-px ${
              tab === key
                ? 'border-iss-primary text-iss-primary bg-green-50/50'
                : 'border-transparent text-iss-gray hover:text-iss-dark hover:bg-gray-50'
            }`}>
            <Icon size={13} />
            {label}
          </button>
        ))}
      </div>

      {/* ── Contenu ─────────────────────────────────────────────────────────── */}
      <div className="p-5">

        {/* IDENTITÉ */}
        {tab === 'identite' && (
          <div className="space-y-6">
            {/* État civil */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">État civil</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {/* Les noms sont stockés COMPLETS dans nom_fr/nom_ar (prenom vide) →
                    on n'affiche la cellule Prénom que si elle est réellement renseignée. */}
                <InfoCell label={etudiant.prenom_fr ? 'Nom (FR)' : 'Nom complet (FR)'} value={etudiant.nom_fr} />
                {etudiant.prenom_fr && <InfoCell label="Prénom (FR)" value={etudiant.prenom_fr} />}
                <InfoCell label={etudiant.prenom_ar ? 'Nom (AR)' : 'Nom complet (AR)'} value={etudiant.nom_ar} rtl />
                {etudiant.prenom_ar && <InfoCell label="Prénom (AR)" value={etudiant.prenom_ar} rtl />}
                <InfoCell label="Genre"       value={etudiant.genre === 'M' ? 'Masculin' : etudiant.genre === 'F' ? 'Féminin' : '—'} />
                <InfoCell label="Date de naissance"  value={formatDate(etudiant.date_naissance)} />
                <InfoCell label="Lieu de naissance"  value={etudiant.lieu_naissance_fr} />
                <InfoCell label="Lieu (AR)"           value={etudiant.lieu_naissance_ar} rtl />
                <InfoCell label="Nationalité (FR)"    value={etudiant.nationalite_fr} />
                <InfoCell label="Nationalité (AR)"    value={etudiant.nationalite_ar} rtl />
                <InfoCell label="N° CNI"      value={etudiant.cni} />
                <InfoCell label="Matricule"   value={etudiant.matricule} />
              </div>
            </section>

            {/* Contact */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Contact</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <InfoCell label="Téléphone"    value={etudiant.telephone} />
                <InfoCell label="Email"        value={etudiant.email} />
                <InfoCell label="Adresse (FR)" value={etudiant.adresse_fr} />
                <InfoCell label="Adresse (AR)" value={etudiant.adresse_ar} rtl />
              </div>
            </section>

            {/* BAC */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Baccalauréat</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <InfoCell label="N° BAC"      value={etudiant.nbac} />
                <InfoCell label="Série"        value={etudiant.serie_bac} />
                <InfoCell label="Moyenne BAC"  value={etudiant.moyenne_bac ? `${etudiant.moyenne_bac}/20` : undefined} />
              </div>
            </section>

            {/* Scolarité */}
            <section>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Scolarité (inscription actuelle)</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                <InfoCell label="Filière"      value={curFiliereNom} />
                <InfoCell label="Niveau"       value={curNiveau} />
                <InfoCell label="Année univ."  value={curAnnee} />
                <InfoCell label="Département académique" value={curDept} />
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Statut</p>
                  <StatusPill statut={etudiant.statut_effectif ?? etudiant.statut} size="md" />
                </div>
                <InfoCell label="Créé le" value={formatDate(etudiant.date_creation)} />
              </div>
            </section>
          </div>
        )}

        {/* INSCRIPTIONS */}
        {tab === 'inscriptions' && (
          loadingTab ? <TabSkeleton /> : (
            <div className="space-y-6">
              {/* Admin */}
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Inscriptions administratives ({inscAdmin.length})
                </h3>
                {inscAdmin.length === 0
                  ? <EmptyTab message="Aucune inscription administrative" />
                  : (
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="data-table w-full">
                        <thead>
                          <tr>
                            <th>Année univ.</th>
                            <th>Filière</th>
                            <th>Statut</th>
                            <th>Paiement</th>
                            <th>Montant</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inscAdmin.map(i => (
                            <tr key={i.id}>
                              <td className="font-mono text-xs">{i.annee_universitaire}</td>
                              <td>{i.filiere_nom}</td>
                              <td><StatusPill statut={i.statut} /></td>
                              <td>
                                <Badge
                                  label={i.est_payee ? 'Payée' : 'Non payée'}
                                  variant={i.est_payee ? 'success' : 'warning'}
                                />
                              </td>
                              <td className="text-right tabular-nums text-xs">
                                {i.montant_paye ? formatMontant(i.montant_paye) : '—'}
                              </td>
                              <td className="text-xs">{formatDate(i.date_inscription)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </section>

              {/* Pédagogique */}
              <section>
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                  Inscriptions pédagogiques ({inscPeda.length})
                </h3>
                {inscPeda.length === 0
                  ? <EmptyTab message="Aucune inscription pédagogique" />
                  : (
                    <div className="overflow-x-auto rounded-xl border border-gray-100">
                      <table className="data-table w-full">
                        <thead>
                          <tr>
                            <th>Semestre</th>
                            <th>Redoublant</th>
                            <th>Dette</th>
                            <th>Éléments</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {inscPeda.map(i => (
                            <tr key={i.id}>
                              <td className="font-semibold text-xs">{i.semestre_code}</td>
                              <td>
                                <Badge label={i.est_redoublant ? 'Oui' : 'Non'}
                                  variant={i.est_redoublant ? 'warning' : 'neutral'} />
                              </td>
                              <td>
                                <Badge label={i.est_dette ? 'Oui' : 'Non'}
                                  variant={i.est_dette ? 'danger' : 'neutral'} />
                              </td>
                              <td className="text-xs">{i.elements?.length ?? 0} élément(s)</td>
                              <td className="text-xs">{formatDate(i.date_inscription)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )
                }
              </section>
            </div>
          )
        )}

        {/* NOTES */}
        {tab === 'notes' && (
          loadingTab ? <TabSkeleton /> : (
            notes.length === 0
              ? <EmptyTab message="Aucune note enregistrée" />
              : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Élément</th>
                        <th className="text-right">CC</th>
                        <th className="text-right">TP</th>
                        <th className="text-right">Examen</th>
                        <th className="text-right">Finale</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notes.map(n => (
                        <tr key={n.id}>
                          <td>
                            <p className="font-semibold text-xs">{n.element_code}</p>
                            <p className="text-xs text-iss-gray">{n.element_nom}</p>
                          </td>
                          <td className="text-right tabular-nums font-mono text-sm">{formatNote(n.note_cc)}</td>
                          <td className="text-right tabular-nums font-mono text-sm">{n.has_tp ? formatNote(n.note_tp) : <span className="text-slate-300">—</span>}</td>
                          <td className="text-right tabular-nums font-mono text-sm">{formatNote(n.note_exam)}</td>
                          <td className="text-right tabular-nums font-mono text-sm font-bold">
                            {n.note_finale !== null
                              ? <span className={Number(n.note_finale) >= 10 ? 'text-emerald-600' : 'text-red-600'}>
                                  {formatNote(n.note_finale)}
                                </span>
                              : '—'
                            }
                          </td>
                          <td>
                            {n.est_absent
                              ? <Badge label="Absent" variant="danger" />
                              : n.est_valide
                              ? <Badge label="Validé" variant="success" />
                              : <Badge label="—" variant="neutral" />
                            }
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )
        )}

        {/* STAGES */}
        {tab === 'stages' && (
          loadingTab ? <TabSkeleton /> : (
            conventions.length === 0
              ? <EmptyTab message="Aucune convention de stage" />
              : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Entreprise</th>
                        <th>Sujet</th>
                        <th>Période</th>
                        <th>Type</th>
                        <th>Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {conventions.map(c => (
                        <tr key={c.id}>
                          <td className="font-semibold text-sm">{c.entreprise_nom}</td>
                          <td className="text-xs max-w-xs truncate">{c.sujet}</td>
                          <td className="text-xs whitespace-nowrap">
                            {formatDate(c.date_debut)} → {formatDate(c.date_fin)}
                          </td>
                          <td>
                            <Badge label={c.est_pfe ? 'PFE' : 'Stage'} variant={c.est_pfe ? 'primary' : 'info'} />
                          </td>
                          <td><StatusPill statut={c.statut} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )
        )}

        {/* ABSENCES */}
        {tab === 'absences' && (
          loadingTab ? <TabSkeleton /> : (
            absences.length === 0
              ? <EmptyTab message="Aucune absence enregistrée" />
              : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Élément / Cours</th>
                        <th>Type</th>
                        <th>Statut</th>
                        <th>Justifiée</th>
                      </tr>
                    </thead>
                    <tbody>
                      {absences.map((a, i) => (
                        <tr key={i}>
                          <td className="text-xs whitespace-nowrap">{formatDate(a.date)}</td>
                          <td>
                            {a.code_em && <span className="font-mono text-xs font-semibold mr-1">{a.code_em}</span>}
                            <span className="text-xs">{a.em_intitule ?? '—'}</span>
                          </td>
                          <td className="text-xs">{a.type_seance ?? '—'}</td>
                          <td>
                            <Badge
                              label={a.statut ?? '—'}
                              variant={a.statut === 'absent' ? 'danger' : a.statut === 'present' ? 'success' : 'neutral'}
                            />
                          </td>
                          <td>
                            <Badge
                              label={a.justifiee ? 'Oui' : 'Non'}
                              variant={a.justifiee ? 'success' : 'neutral'}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )
        )}

        {/* DOCUMENTS */}
        {tab === 'documents' && (
          loadingTab ? <TabSkeleton /> : (
            documents.length === 0
              ? <EmptyTab message="Aucun document officiel généré" />
              : (
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>N° série</th>
                        <th>Année univ.</th>
                        <th>Semestre</th>
                        <th>Généré le</th>
                        <th>Par</th>
                        <th>Validité</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {documents.map(d => (
                        <tr key={d.id}>
                          <td className="text-xs font-semibold">
                            {TYPE_DOCUMENT_LABELS[d.type_document] ?? d.type_document}
                          </td>
                          <td className="font-mono text-xs">{d.numero_serie}</td>
                          <td className="text-xs">{d.annee_universitaire ?? '—'}</td>
                          <td className="text-xs">{d.semestre_code ?? '—'}</td>
                          <td className="text-xs whitespace-nowrap">{formatDate(d.date_generation)}</td>
                          <td className="text-xs">{d.genere_par_nom}</td>
                          <td>
                            <Badge
                              label={d.est_valide ? 'Valide' : 'Invalidé'}
                              variant={d.est_valide ? 'success' : 'danger'}
                            />
                          </td>
                          <td>
                            {d.fichier_pdf && (
                              <button onClick={() => handleDownloadDoc(d)}
                                className="p-1.5 rounded-lg text-iss-gray hover:text-iss-primary hover:bg-green-50 transition-colors">
                                <Download size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
          )
        )}
      </div>

      {/* Lien vers le dossier complet */}
      <div className="px-5 pb-4 flex justify-end border-t border-gray-50 pt-3">
        <a href={`/dashboard/scolarite/etudiants/${etudiant.id}`}
          className="flex items-center gap-1.5 text-xs font-semibold text-iss-primary hover:underline">
          Ouvrir le dossier complet
          <ExternalLink size={12} />
        </a>
      </div>
    </div>
  );
}
