/**
 * Page d'administration (super admin, mode web) :
 * créer un compte, réinitialiser un mot de passe, suspendre / réactiver.
 */

import { Navigate, useNavigate } from "@tanstack/react-router";
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from "react";
import { Header } from "../components/layout";
import { Spinner } from "../components/ui/Spinner";
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

export function AdminPage() {
  const { user } = useAuth();
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

  return (
    <>
      <Header title="Administration des comptes" />
      <div className="space-y-6 overflow-auto p-6">
        <CreateUserForm onCreated={reload} />

        <section className="rounded-xl border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
          <header className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-slate-700">
            <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
              Profils et comptes ({users.length})
            </h3>
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
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-slate-700 dark:text-slate-400">
                    <th className="px-4 py-1.5 font-medium">Profil</th>
                    <th className="px-4 py-1.5 font-medium">Coordonnées</th>
                    <th className="px-4 py-1.5 font-medium">Rôle</th>
                    <th className="px-4 py-1.5 font-medium">État</th>
                    <th className="px-4 py-1.5 font-medium">Base / données</th>
                    <th className="px-4 py-1.5 font-medium">Dernière connexion</th>
                    <th className="px-4 py-1.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <UserRow key={u.id} user={u} currentUserId={user.id} onChanged={reload} />
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

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<CreateUserFormState>(initialCreateUserForm);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateField =
    (field: keyof CreateUserFormState) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = field === "role" ? (e.target.value as AdminUser["role"]) : e.target.value;
      setForm((current) => ({ ...current, [field]: value }) as CreateUserFormState);
    };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
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
      setMessage(`Compte « ${form.email.trim()} » créé.`);
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
      {message && <p className="mt-2 text-sm text-green-700">{message}</p>}
    </section>
  );
}

function UserRow({
  user,
  currentUserId,
  onChanged,
}: {
  user: AdminUser;
  currentUserId: number;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { startActing } = useImpersonation();

  const resetPassword = async () => {
    const pwd = window.prompt(`Nouveau mot de passe pour « ${user.login} » (8 caractères min.) :`);
    if (!pwd) return;
    if (pwd.length < 8) {
      window.alert("Le mot de passe doit contenir au moins 8 caractères.");
      return;
    }
    setBusy(true);
    try {
      await adminFetch(`/users/${user.id}/password`, "POST", { password: pwd });
      window.alert("Mot de passe réinitialisé. L'utilisateur devra se reconnecter.");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async () => {
    setBusy(true);
    try {
      await adminFetch(`/users/${user.id}/active`, "POST", { actif: user.actif === 0 });
      onChanged();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const toggleApproved = async () => {
    setBusy(true);
    try {
      await adminFetch(`/users/${user.id}/approve`, "POST", { approved: user.approved === 0 });
      onChanged();
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const actAsUser = () => {
    startActing({ id: user.id, label: fullName || user.login });
    navigate({ to: "/" });
  };

  const isSelf = user.id === currentUserId;
  const hasStats =
    user.clients_count != null &&
    user.vehicules_count != null &&
    user.polices_count != null &&
    user.paiements_count != null;
  const fullName = [user.prenom, user.nom].filter(Boolean).join(" ") || user.nom;
  const phones = [user.telephone1, user.telephone2].filter(Boolean).join(" · ");

  return (
    <tr className="border-b border-gray-100 last:border-0 dark:border-slate-700/60">
      <td className="px-4 py-2 align-top">
        <div className="font-medium text-gray-900 dark:text-slate-100">{fullName}</div>
        <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{user.login}</div>
      </td>
      <td className="px-4 py-2 align-top text-gray-700 dark:text-slate-300">
        <div>{user.email ?? "—"}</div>
        {phones && <div className="mt-0.5 text-xs text-gray-500 dark:text-slate-400">{phones}</div>}
        {user.adresse && (
          <div className="mt-0.5 max-w-xs text-xs text-gray-500 dark:text-slate-400">
            {user.adresse}
          </div>
        )}
      </td>
      <td className="px-4 py-1.5">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            user.role === "ADMIN"
              ? "bg-[#614e1a]/10 text-[#614e1a]"
              : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300"
          }`}
        >
          {user.role === "ADMIN" ? "Admin" : "Utilisateur"}
        </span>
      </td>
      <td className="px-4 py-1.5">
        <div className="flex flex-col items-start gap-1">
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
      <td className="px-4 py-1.5 text-gray-500 dark:text-slate-400">
        <div>{formatSize(user.db_size_bytes)}</div>
        {hasStats ? (
          <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">
            {user.clients_count} clients · {user.vehicules_count} véhicules · {user.polices_count}{" "}
            polices · {user.paiements_count} paiements
          </div>
        ) : (
          <div className="mt-1 text-xs text-gray-400 dark:text-slate-500">Aucune base active</div>
        )}
      </td>
      <td className="px-4 py-1.5 text-gray-500 dark:text-slate-400">
        {user.last_login_at ? new Date(user.last_login_at).toLocaleString("fr-FR") : "jamais"}
      </td>
      <td className="px-4 py-1.5">
        <div className="flex flex-wrap gap-2">
          {!isSelf && (
            <button
              type="button"
              onClick={toggleApproved}
              disabled={busy}
              className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${
                user.approved
                  ? "text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700"
                  : "bg-green-600 text-white hover:bg-green-700"
              }`}
            >
              {user.approved ? "Retirer la validation" : "Valider le compte"}
            </button>
          )}
          {!isSelf && (
            <button
              type="button"
              onClick={actAsUser}
              disabled={busy}
              className="rounded px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50 dark:text-blue-300 dark:hover:bg-blue-900/20"
            >
              Voir / modifier les données
            </button>
          )}
          <button
            type="button"
            onClick={resetPassword}
            disabled={busy}
            className="rounded px-2 py-1 text-xs text-[#614e1a] hover:bg-[#614e1a]/10 disabled:opacity-50"
          >
            Mot de passe
          </button>
          {!isSelf && (
            <button
              type="button"
              onClick={toggleActive}
              disabled={busy}
              className={`rounded px-2 py-1 text-xs disabled:opacity-50 ${
                user.actif ? "text-red-600 hover:bg-red-50" : "text-green-700 hover:bg-green-50"
              }`}
            >
              {user.actif ? "Suspendre" : "Réactiver"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
