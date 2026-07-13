/**
 * Page d'administration (super admin, mode web) :
 * créer un compte, modifier le profil, réinitialiser un mot de passe,
 * suspendre / réactiver, supprimer.
 */

import { Navigate, useNavigate } from "@tanstack/react-router";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from "react";
import { Header } from "../components/layout";
import { Dialog } from "../components/ui/Dialog";
import { Spinner } from "../components/ui/Spinner";
import { useToast } from "../components/ui/Toast";
import { useImpersonation } from "../lib/admin-impersonation";
import { useAuth } from "../lib/auth";
import { csrfHeaders } from "../lib/csrf";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface AdminUser {
  id: number;
  login: string;
  nom: string;
  prenom: string | null;
  adresse: string | null;
  telephone1: string | null;
  telephone2: string | null;
  email: string | null;
  role: "ADMIN" | "USER";
  actif: 0 | 1;
  approved: 0 | 1;
  created_at: string;
  last_login_at: string | null;
  db_size_bytes: number | null;
  clients_count: number | null;
  vehicules_count: number | null;
  polices_count: number | null;
  paiements_count: number | null;
}

async function adminFetch<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers = {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...csrfHeaders(method),
  };
  const res = await fetch(`${BASE}/api/admin${path}`, {
    method,
    credentials: "include",
    ...(body !== undefined
      ? { headers, body: JSON.stringify(body) }
      : Object.keys(headers).length > 0
        ? { headers }
        : {}),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Erreur ${res.status}`);
  }
  return (await res.json()) as T;
}

function formatSize(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

function formatDateTime(value: string | null): string {
  return value ? new Date(value).toLocaleString("fr-FR") : "jamais";
}

export function AdminPage() {
  const { user, refresh } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<{ users: AdminUser[] }>("/users");
      setUsers(data.users);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (user?.role !== "ADMIN") {
    return <Navigate to="/profil" replace />;
  }

  const adminCount = users.filter((u) => u.role === "ADMIN").length;
  const pendingCount = users.filter((u) => !u.approved).length;
  const suspendedCount = users.filter((u) => !u.actif).length;

  return (
    <>
      <Header title="Administration des comptes" />
      <div className="space-y-6 overflow-auto p-6">
        <CreateUserForm onCreated={reload} />

        <section className="rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-700">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                Profils et comptes ({users.length})
              </h3>
              {!loading && (
                <p className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">
                  {adminCount} admin{adminCount > 1 ? "s" : ""} · {pendingCount} en attente ·{" "}
                  {suspendedCount} suspendu{suspendedCount > 1 ? "s" : ""}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={reload}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-50 dark:border-slate-600 dark:hover:bg-slate-700"
            >
              Rafraîchir
            </button>
          </header>

          {error && <p className="px-4 py-3 text-sm text-red-600">{error}</p>}
          {loading ? (
            <Spinner logoWidth={0} size={28} className="py-6" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1060px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-4 py-2 font-medium">Utilisateur</th>
                    <th className="px-4 py-2 font-medium">Accès</th>
                    <th className="px-4 py-2 font-medium">Données</th>
                    <th className="px-4 py-2 font-medium">Activité</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow
                      key={u.id}
                      user={u}
                      currentUserId={user.id}
                      onChanged={reload}
                      onCurrentUserChanged={refresh}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

type CreateUserFormState = {
  nom: string;
  prenom: string;
  adresse: string;
  telephone1: string;
  telephone2: string;
  email: string;
  password: string;
  passwordConfirm: string;
  role: AdminUser["role"];
};

type EditUserFormState = {
  nom: string;
  prenom: string;
  adresse: string;
  telephone1: string;
  telephone2: string;
  email: string;
};

const initialCreateUserForm: CreateUserFormState = {
  nom: "",
  prenom: "",
  adresse: "",
  telephone1: "",
  telephone2: "",
  email: "",
  password: "",
  passwordConfirm: "",
  role: "USER",
};

function editUserFormFromUser(user: AdminUser): EditUserFormState {
  return {
    nom: user.nom,
    prenom: user.prenom ?? "",
    adresse: user.adresse ?? "",
    telephone1: user.telephone1 ?? "",
    telephone2: user.telephone2 ?? "",
    email: user.email ?? user.login,
  };
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CreateUserFormState>(initialCreateUserForm);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  const updateField =
    (field: keyof CreateUserFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = field === "role" ? (e.target.value as AdminUser["role"]) : e.target.value;
      setForm((current) => ({ ...current, [field]: value }) as CreateUserFormState);
    };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.passwordConfirm) {
      setError("La confirmation du mot de passe ne correspond pas.");
      return;
    }
    setSubmitting(true);
    try {
      await adminFetch("/users", "POST", {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        adresse: form.adresse.trim(),
        telephone1: form.telephone1.trim(),
        telephone2: form.telephone2.trim(),
        email: form.email.trim(),
        password: form.password,
        passwordConfirm: form.passwordConfirm,
        role: form.role,
      });
      showToast({
        title: "Compte créé",
        message: `Le compte ${form.email.trim()} est prêt.`,
        variant: "success",
      });
      setForm(initialCreateUserForm);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-slate-400";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex flex-col gap-1">
        <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
          Créer un compte utilisateur
        </h3>
        <p className="text-sm text-gray-500 dark:text-slate-400">
          Renseignez l'identité, les coordonnées et les accès du nouveau profil.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Identité
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="new-prenom" className={labelClass}>
                Prénom
              </label>
              <input
                id="new-prenom"
                type="text"
                value={form.prenom}
                onChange={updateField("prenom")}
                required
                maxLength={200}
                className={inputClass}
                placeholder="Aminata"
              />
            </div>
            <div>
              <label htmlFor="new-nom" className={labelClass}>
                Nom
              </label>
              <input
                id="new-nom"
                type="text"
                value={form.nom}
                onChange={updateField("nom")}
                required
                minLength={2}
                maxLength={200}
                className={inputClass}
                placeholder="Diop"
              />
            </div>
            <div>
              <label htmlFor="new-email" className={labelClass}>
                Email
              </label>
              <input
                id="new-email"
                type="email"
                data-no-upper
                value={form.email}
                onChange={updateField("email")}
                required
                maxLength={200}
                className={inputClass}
                placeholder="aminata.diop@example.com"
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Coordonnées
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="new-telephone1" className={labelClass}>
                Téléphone 1
              </label>
              <input
                id="new-telephone1"
                type="tel"
                value={form.telephone1}
                onChange={updateField("telephone1")}
                required
                maxLength={50}
                className={inputClass}
                placeholder="771234567"
              />
            </div>
            <div>
              <label htmlFor="new-telephone2" className={labelClass}>
                Téléphone 2
              </label>
              <input
                id="new-telephone2"
                type="tel"
                value={form.telephone2}
                onChange={updateField("telephone2")}
                maxLength={50}
                className={inputClass}
                placeholder="optionnel"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="new-adresse" className={labelClass}>
                Adresse
              </label>
              <textarea
                id="new-adresse"
                value={form.adresse}
                onChange={updateField("adresse")}
                rows={2}
                required
                maxLength={500}
                className={`${inputClass} resize-y`}
                placeholder="Adresse complète"
              />
            </div>
          </div>
        </div>

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400">
            Accès
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label htmlFor="new-role" className={labelClass}>
                Rôle
              </label>
              <select
                id="new-role"
                value={form.role}
                onChange={updateField("role")}
                className={inputClass}
              >
                <option value="USER">Utilisateur</option>
                <option value="ADMIN">Administrateur</option>
              </select>
            </div>
            <div>
              <label htmlFor="new-password" className={labelClass}>
                Mot de passe
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={updateField("password")}
                required
                minLength={8}
                maxLength={200}
                className={inputClass}
                placeholder="8 caractères minimum"
              />
            </div>
            <div>
              <label htmlFor="new-password-confirm" className={labelClass}>
                Confirmation
              </label>
              <input
                id="new-password-confirm"
                type="password"
                autoComplete="new-password"
                value={form.passwordConfirm}
                onChange={updateField("passwordConfirm")}
                required
                minLength={8}
                maxLength={200}
                className={inputClass}
                placeholder="Confirmer le mot de passe"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-[#614e1a] px-4 py-2 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
          >
            {submitting ? "Création..." : "Créer le compte"}
          </button>
        </div>
      </form>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </section>
  );
}

function UserRow({
  user,
  currentUserId,
  onChanged,
  onCurrentUserChanged,
}: {
  user: AdminUser;
  currentUserId: number;
  onChanged: () => void;
  onCurrentUserChanged: () => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<EditUserFormState>(() => editUserFormFromUser(user));
  const [editError, setEditError] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { actingUser, startActing, stopActing } = useImpersonation();
  const { showToast } = useToast();

  useEffect(() => {
    if (!editing) setEditForm(editUserFormFromUser(user));
  }, [editing, user]);

  const updateEditField =
    (field: keyof EditUserFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setEditForm((current) => ({ ...current, [field]: e.target.value }));
    };

  const openPasswordDialog = () => {
    setNewPassword("");
    setPasswordError(null);
    setPasswordDialogOpen(true);
  };

  const closePasswordDialog = () => {
    if (busy) return;
    setPasswordDialogOpen(false);
    setNewPassword("");
    setPasswordError(null);
  };

  const resetPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setPasswordError("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    setPasswordError(null);
    try {
      await adminFetch(`/users/${user.id}/password`, "POST", { password: newPassword });
      setPasswordDialogOpen(false);
      setNewPassword("");
      showToast({
        title: "Mot de passe réinitialisé",
        message: "L'utilisateur devra se reconnecter avec son nouveau mot de passe.",
        variant: "success",
      });
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      await adminFetch(`/users/${user.id}/active`, "POST", { actif: user.actif === 0 });
      showToast({
        title: user.actif ? "Compte suspendu" : "Compte réactivé",
        message: `${fullName || user.login} a été ${user.actif ? "suspendu" : "réactivé"}.`,
        variant: "success",
      });
      onChanged();
    } catch (err) {
      showToast({
        title: "Action impossible",
        message: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const toggleApproved = async () => {
    setBusy(true);
    try {
      await adminFetch(`/users/${user.id}/approve`, "POST", { approved: user.approved === 0 });
      showToast({
        title: user.approved ? "Validation retirée" : "Compte validé",
        message: `${fullName || user.login} est maintenant ${
          user.approved ? "en attente" : "validé"
        }.`,
        variant: "success",
      });
      onChanged();
    } catch (err) {
      showToast({
        title: "Action impossible",
        message: err instanceof Error ? err.message : "Erreur",
        variant: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const actAsUser = () => {
    startActing({ id: user.id, label: fullName || user.login });
    navigate({ to: "/" });
  };

  const openDeleteDialog = () => {
    setDeleteError(null);
    setDeleteDialogOpen(true);
  };

  const closeDeleteDialog = () => {
    if (busy) return;
    setDeleteDialogOpen(false);
    setDeleteError(null);
  };

  const deleteAccount = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setDeleteError(null);
    try {
      await adminFetch(`/users/${user.id}`, "DELETE");
      if (actingUser?.id === user.id) stopActing();
      setDeleteDialogOpen(false);
      showToast({
        title: "Compte supprimé",
        message: `${fullName || user.login} et sa base métier ont été supprimés.`,
        variant: "success",
      });
      onChanged();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setEditError(null);
    try {
      await adminFetch(`/users/${user.id}`, "PATCH", {
        nom: editForm.nom.trim(),
        prenom: editForm.prenom.trim(),
        adresse: editForm.adresse.trim(),
        telephone1: editForm.telephone1.trim(),
        telephone2: editForm.telephone2.trim(),
        email: editForm.email.trim(),
      });
      if (user.id === currentUserId) await onCurrentUserChanged();
      showToast({
        title: "Profil mis à jour",
        message: `Les informations de ${fullName || user.login} ont été enregistrées.`,
        variant: "success",
      });
      onChanged();
      setEditing(false);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const isSelf = user.id === currentUserId;
  const hasStats =
    user.clients_count != null &&
    user.vehicules_count != null &&
    user.polices_count != null &&
    user.paiements_count != null;
  const fullName = [user.prenom, user.nom].filter(Boolean).join(" ") || user.nom;
  const phones = [user.telephone1, user.telephone2].filter(Boolean).join(" · ");
  const actionButtonClass =
    "rounded px-2 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50";
  const neutralActionClass = `${actionButtonClass} text-gray-700 hover:bg-gray-100 dark:text-slate-200 dark:hover:bg-slate-700`;
  const primaryActionClass = `${actionButtonClass} text-[#614e1a] hover:bg-[#614e1a]/10`;
  const dangerActionClass = `${actionButtonClass} text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-900/20`;
  const modalInputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  return (
    <>
      <tr className="border-b border-gray-100 last:border-0 dark:border-slate-700/60">
        <td className="max-w-sm px-4 py-3 align-top">
          <div className="flex items-center gap-2">
            <span className="font-medium text-gray-900 dark:text-slate-100">{fullName}</span>
            {isSelf && (
              <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-600 dark:bg-slate-700 dark:text-slate-300">
                Vous
              </span>
            )}
          </div>
          <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{user.login}</div>
          <div className="mt-2 text-xs text-gray-700 dark:text-slate-300">{user.email ?? "—"}</div>
          {phones && (
            <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{phones}</div>
          )}
          {user.adresse && (
            <div className="mt-0.5 max-w-xs text-xs text-gray-500 dark:text-slate-400">
              {user.adresse}
            </div>
          )}
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex max-w-[150px] flex-wrap items-start gap-1">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                user.role === "ADMIN"
                  ? "bg-[#614e1a]/10 text-[#614e1a]"
                  : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {user.role === "ADMIN" ? "Admin" : "Utilisateur"}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                user.actif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
              }`}
            >
              {user.actif ? "Actif" : "Suspendu"}
            </span>
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                user.approved
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
              }`}
            >
              {user.approved ? "Validé" : "En attente"}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 align-top text-gray-500 dark:text-slate-400">
          <div className="font-medium text-gray-700 dark:text-slate-300">
            {formatSize(user.db_size_bytes)}
          </div>
          {hasStats ? (
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-gray-400 dark:text-slate-500">
              <span>{user.clients_count} clients</span>
              <span>{user.vehicules_count} véhicules</span>
              <span>{user.polices_count} polices</span>
              <span>{user.paiements_count} paiements</span>
            </div>
          ) : (
            <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">Aucune base active</div>
          )}
        </td>
        <td className="px-4 py-3 align-top text-xs text-gray-500 dark:text-slate-400">
          <div>
            <span className="block text-gray-400 dark:text-slate-500">Dernière connexion</span>
            <span className="text-gray-700 dark:text-slate-300">
              {formatDateTime(user.last_login_at)}
            </span>
          </div>
          <div className="mt-2">
            <span className="block text-gray-400 dark:text-slate-500">Créé le</span>
            <span>{formatDateTime(user.created_at)}</span>
          </div>
        </td>
        <td className="px-4 py-3 align-top">
          <div className="flex min-w-[250px] flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setEditing((current) => !current);
                  setEditError(null);
                }}
                disabled={busy}
                className={primaryActionClass}
              >
                Modifier
              </button>
              <button
                type="button"
                onClick={openPasswordDialog}
                disabled={busy}
                className={primaryActionClass}
              >
                Mot de passe
              </button>
            </div>
            {!isSelf && (
              <div className="flex flex-wrap justify-end gap-1.5">
                <button
                  type="button"
                  onClick={toggleApproved}
                  disabled={busy}
                  className={
                    user.approved
                      ? neutralActionClass
                      : `${actionButtonClass} bg-green-600 text-white hover:bg-green-700`
                  }
                >
                  {user.approved ? "Retirer validation" : "Valider"}
                </button>
                <button
                  type="button"
                  onClick={actAsUser}
                  disabled={busy}
                  className={`${actionButtonClass} text-blue-700 hover:bg-blue-50 dark:text-blue-300 dark:hover:bg-blue-900/20`}
                >
                  Données
                </button>
                <button
                  type="button"
                  onClick={toggleActive}
                  disabled={busy}
                  className={
                    user.actif
                      ? dangerActionClass
                      : `${actionButtonClass} text-green-700 hover:bg-green-50 dark:text-green-300 dark:hover:bg-green-900/20`
                  }
                >
                  {user.actif ? "Suspendre" : "Réactiver"}
                </button>
                <button
                  type="button"
                  onClick={openDeleteDialog}
                  disabled={busy}
                  className={dangerActionClass}
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </td>
      </tr>
      {editing && (
        <tr className="border-b border-gray-100 bg-gray-50 dark:border-slate-700/60 dark:bg-slate-900/40">
          <td colSpan={5} className="px-4 py-3">
            <form onSubmit={saveProfile} className="space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor={`edit-prenom-${user.id}`}
                    className="block text-xs font-medium text-gray-600 dark:text-slate-400"
                  >
                    Prénom
                  </label>
                  <input
                    id={`edit-prenom-${user.id}`}
                    type="text"
                    value={editForm.prenom}
                    onChange={updateEditField("prenom")}
                    maxLength={200}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`edit-nom-${user.id}`}
                    className="block text-xs font-medium text-gray-600 dark:text-slate-400"
                  >
                    Nom
                  </label>
                  <input
                    id={`edit-nom-${user.id}`}
                    type="text"
                    value={editForm.nom}
                    onChange={updateEditField("nom")}
                    required
                    minLength={2}
                    maxLength={200}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`edit-email-${user.id}`}
                    className="block text-xs font-medium text-gray-600 dark:text-slate-400"
                  >
                    Email de connexion
                  </label>
                  <input
                    id={`edit-email-${user.id}`}
                    type="email"
                    data-no-upper
                    value={editForm.email}
                    onChange={updateEditField("email")}
                    required
                    maxLength={200}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label
                    htmlFor={`edit-telephone1-${user.id}`}
                    className="block text-xs font-medium text-gray-600 dark:text-slate-400"
                  >
                    Téléphone 1
                  </label>
                  <input
                    id={`edit-telephone1-${user.id}`}
                    type="tel"
                    value={editForm.telephone1}
                    onChange={updateEditField("telephone1")}
                    maxLength={50}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`edit-telephone2-${user.id}`}
                    className="block text-xs font-medium text-gray-600 dark:text-slate-400"
                  >
                    Téléphone 2
                  </label>
                  <input
                    id={`edit-telephone2-${user.id}`}
                    type="tel"
                    value={editForm.telephone2}
                    onChange={updateEditField("telephone2")}
                    maxLength={50}
                    className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label
                    htmlFor={`edit-adresse-${user.id}`}
                    className="block text-xs font-medium text-gray-600 dark:text-slate-400"
                  >
                    Adresse
                  </label>
                  <textarea
                    id={`edit-adresse-${user.id}`}
                    value={editForm.adresse}
                    onChange={updateEditField("adresse")}
                    rows={2}
                    maxLength={500}
                    className="mt-1 block w-full resize-y rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
              {editError && <p className="text-sm text-red-600">{editError}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditForm(editUserFormFromUser(user));
                    setEditError(null);
                  }}
                  disabled={busy}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-[#614e1a] px-3 py-1.5 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
                >
                  {busy ? "Enregistrement..." : "Enregistrer"}
                </button>
              </div>
            </form>
          </td>
        </tr>
      )}
      <Dialog
        open={passwordDialogOpen}
        onClose={closePasswordDialog}
        title={`Réinitialiser le mot de passe`}
        maxWidth="max-w-md"
      >
        <form onSubmit={resetPassword} className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 dark:text-slate-300">
              Définissez un nouveau mot de passe pour{" "}
              <span className="font-semibold text-gray-900 dark:text-slate-100">{user.login}</span>.
            </p>
            <label
              htmlFor={`reset-password-${user.id}`}
              className="mt-3 block text-xs font-medium text-gray-600 dark:text-slate-400"
            >
              Nouveau mot de passe
            </label>
            <input
              id={`reset-password-${user.id}`}
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                setPasswordError(null);
              }}
              minLength={8}
              maxLength={200}
              className={modalInputClass}
              placeholder="8 caractères minimum"
              autoFocus
            />
          </div>
          {passwordError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {passwordError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closePasswordDialog}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-[#614e1a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#8b7335] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Enregistrement..." : "Réinitialiser"}
            </button>
          </div>
        </form>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onClose={closeDeleteDialog}
        title="Supprimer le compte"
        maxWidth="max-w-md"
      >
        <form onSubmit={deleteAccount} className="space-y-4">
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-100">
            Suppression définitive du compte <span className="font-semibold">{user.login}</span> et
            de sa base métier.
          </div>
          {deleteError && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-200">
              {deleteError}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={closeDeleteDialog}
              disabled={busy}
              className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Suppression..." : "Supprimer"}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
