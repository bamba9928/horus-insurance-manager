/**
 * Page profil utilisateur (mode web) : informations du compte en lecture seule
 * et changement du mot de passe.
 */

import { Link } from "@tanstack/react-router";
import { type FormEvent, useState } from "react";
import { Header } from "../components/layout";
import { type AuthUser, isWebMode, useAuth } from "../lib/auth";
import { csrfHeaders } from "../lib/csrf";

const BASE = import.meta.env.VITE_API_BASE_URL ?? "";

async function profileFetch<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const headers = {
    ...(body !== undefined ? { "content-type": "application/json" } : {}),
    ...csrfHeaders(method),
  };
  const res = await fetch(`${BASE}/api/profile${path}`, {
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

function roleLabel(role: AuthUser["role"]): string {
  return role === "ADMIN" ? "Administrateur" : "Utilisateur";
}

function displayValue(value: string | null | undefined): string {
  return value?.trim() ? value : "—";
}

export function ProfilePage() {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittingPassword, setSubmittingPassword] = useState(false);

  const updatePassword = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPasswordMessage(null);
    if (password !== confirmPassword) {
      setError("Les deux nouveaux mots de passe ne correspondent pas.");
      return;
    }
    setSubmittingPassword(true);
    try {
      await profileFetch("/password", "POST", { currentPassword, password });
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setPasswordMessage("Mot de passe mis à jour.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSubmittingPassword(false);
    }
  };

  if (!isWebMode) {
    return (
      <>
        <Header title="Profil" />
        <div className="p-6">
          <p className="text-sm text-gray-600 dark:text-slate-300">
            Le profil utilisateur est disponible en mode web avec authentification.
          </p>
        </div>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Header title="Profil" />
        <div className="p-6">
          <p className="text-sm text-red-600">Session introuvable.</p>
        </div>
      </>
    );
  }

  const inputClass =
    "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100";
  const labelClass = "block text-xs font-medium text-gray-600 dark:text-slate-400";
  const valueClass = "mt-1 text-sm font-medium text-gray-900 dark:text-slate-100";
  const fullName = [user.prenom, user.nom].filter(Boolean).join(" ") || user.nom;

  return (
    <>
      <Header title="Profil" />
      <div className="space-y-6 overflow-auto p-6">
        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-slate-100">
                Mon compte
              </h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">
                {fullName} · {user.login} · {roleLabel(user.role)}
              </p>
              {user.email && (
                <p className="mt-0.5 text-sm text-gray-500 dark:text-slate-500">{user.email}</p>
              )}
            </div>
            {user.role === "ADMIN" && (
              <Link
                to="/admin"
                className="inline-flex items-center justify-center rounded-lg border border-[#614e1a]/30 px-3 py-1.5 text-sm font-medium text-[#614e1a] hover:bg-[#614e1a]/10"
              >
                Gérer les profils
              </Link>
            )}
          </div>
        </section>

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">
            Informations du profil
          </h3>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <div className={labelClass}>Prénom</div>
                <div className={valueClass}>{displayValue(user.prenom)}</div>
              </div>
              <div>
                <div className={labelClass}>Nom</div>
                <div className={valueClass}>{displayValue(user.nom)}</div>
              </div>
              <div>
                <div className={labelClass}>Email de connexion</div>
                <div className={valueClass}>{displayValue(user.email)}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className={labelClass}>Téléphone 1</div>
                <div className={valueClass}>{displayValue(user.telephone1)}</div>
              </div>
              <div>
                <div className={labelClass}>Téléphone 2</div>
                <div className={valueClass}>{displayValue(user.telephone2)}</div>
              </div>
              <div className="sm:col-span-2">
                <div className={labelClass}>Adresse</div>
                <div className={valueClass}>{displayValue(user.adresse)}</div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-3 text-base font-semibold text-gray-900 dark:text-slate-100">
            Sécurité
          </h3>
          <form onSubmit={updatePassword} className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="current-password"
                className="block text-xs font-medium text-gray-600 dark:text-slate-400"
              >
                Mot de passe actuel
              </label>
              <input
                id="current-password"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="new-password"
                className="block text-xs font-medium text-gray-600 dark:text-slate-400"
              >
                Nouveau mot de passe
              </label>
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium text-gray-600 dark:text-slate-400"
              >
                Confirmation
              </label>
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={submittingPassword}
                className="rounded-lg bg-[#614e1a] px-4 py-1.5 text-sm font-medium text-white hover:bg-[#8b7335] disabled:opacity-50"
              >
                {submittingPassword ? "Mise à jour..." : "Changer le mot de passe"}
              </button>
            </div>
          </form>
          {passwordMessage && <p className="mt-2 text-sm text-green-700">{passwordMessage}</p>}
        </section>
      </div>
    </>
  );
}
