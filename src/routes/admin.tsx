/**
 * Page d'administration (super admin, mode web) :
 * créer un compte, réinitialiser un mot de passe, suspendre / réactiver.
 */

import { Navigate } from "@tanstack/react-router";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { Header } from "../components/layout";
import { useAuth } from "../lib/auth";
import { csrfHeaders } from "../lib/csrf";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

interface AdminUser {
  id: number;
  login: string;
  nom: string;
  role: "ADMIN" | "USER";
  actif: 0 | 1;
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
            <p className="px-4 py-6 text-sm text-gray-500">Chargement...</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs text-gray-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-4 py-1.5 font-medium">Identifiant</th>
                  <th className="px-4 py-1.5 font-medium">Nom</th>
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
          )}
        </section>
      </div>
    </>
  );
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [login, setLogin] = useState("");
  const [nom, setNom] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("USER");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);
    try {
      await adminFetch("/users", "POST", { login: login.trim(), nom: nom.trim(), password, role });
      setMessage(`Compte « ${login.trim()} » créé.`);
      setLogin("");
      setNom("");
      setPassword("");
      setRole("USER");
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">
        Créer un compte
      </h3>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-5 sm:items-end">
        <div>
          <label
            htmlFor="new-login"
            className="block text-xs font-medium text-gray-600 dark:text-slate-400"
          >
            Identifiant
          </label>
          <input
            id="new-login"
            type="text"
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            required
            className={inputClass}
            placeholder="agence.dakar"
          />
        </div>
        <div>
          <label
            htmlFor="new-nom"
            className="block text-xs font-medium text-gray-600 dark:text-slate-400"
          >
            Nom
          </label>
          <input
            id="new-nom"
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            required
            className={inputClass}
            placeholder="Agence de Dakar"
          />
        </div>
        <div>
          <label
            htmlFor="new-password"
            className="block text-xs font-medium text-gray-600 dark:text-slate-400"
          >
            Mot de passe (8+ car.)
          </label>
          <input
            id="new-password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className={inputClass}
            placeholder="mot de passe initial"
          />
        </div>
        <div>
          <label
            htmlFor="new-role"
            className="block text-xs font-medium text-gray-600 dark:text-slate-400"
          >
            Rôle
          </label>
          <select
            id="new-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminUser["role"])}
            className={inputClass}
          >
            <option value="USER">Utilisateur</option>
            <option value="ADMIN">Administrateur</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-[#614e1a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
        >
          {submitting ? "Création..." : "Créer le compte"}
        </button>
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

  const isSelf = user.id === currentUserId;
  const hasStats =
    user.clients_count != null &&
    user.vehicules_count != null &&
    user.polices_count != null &&
    user.paiements_count != null;

  return (
    <tr className="border-b border-gray-100 last:border-0 dark:border-slate-700/60">
      <td className="px-4 py-1.5 font-medium text-gray-900 dark:text-slate-100">{user.login}</td>
      <td className="px-4 py-1.5 text-gray-700 dark:text-slate-300">{user.nom}</td>
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
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            user.actif ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {user.actif ? "Actif" : "Suspendu"}
        </span>
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
        <div className="flex gap-2">
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
