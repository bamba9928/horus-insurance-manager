/**
 * Sessions par cookie httpOnly : jeton aléatoire stocké dans admin.db.
 * Durée de vie 7 jours, glissante (prolongée à chaque requête après 24 h).
 *
 * @module auth/sessions
 */

import crypto from "node:crypto";
import type Database from "better-sqlite3";
import type { UserRow } from "../db/adminDb.js";

export const SESSION_COOKIE = "horus_session";

const SESSION_TTL_MS = 7 * 24 * 3600 * 1000;
const SLIDING_THRESHOLD_MS = SESSION_TTL_MS - 24 * 3600 * 1000;

export const SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;

export function createSession(db: Database.Database, userId: number): string {
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)").run(
    token,
    userId,
    expiresAt,
  );
  return token;
}

interface SessionJoinRow extends UserRow {
  session_expires_at: string;
}

/**
 * Valide un jeton de session et renvoie l'utilisateur associé.
 * Prolonge la session si elle a plus de 24 h (expiration glissante).
 */
export function getSessionUser(db: Database.Database, token: string): UserRow | undefined {
  const row = db
    .prepare(
      `SELECT u.*, s.expires_at AS session_expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ?`,
    )
    .get(token) as SessionJoinRow | undefined;
  if (!row) return undefined;

  const nowIso = new Date().toISOString();
  if (row.session_expires_at <= nowIso) {
    deleteSession(db, token);
    return undefined;
  }

  const remainingMs = new Date(row.session_expires_at).getTime() - Date.now();
  if (remainingMs < SLIDING_THRESHOLD_MS) {
    db.prepare("UPDATE sessions SET expires_at = ? WHERE token = ?").run(
      new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      token,
    );
  }

  const { session_expires_at: _ignored, ...user } = row;
  return user;
}

export function deleteSession(db: Database.Database, token: string): void {
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

/** Détruit toutes les sessions d'un utilisateur (suspension, reset mot de passe). */
export function deleteUserSessions(db: Database.Database, userId: number): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(userId);
}

/** Détruit les autres sessions d'un utilisateur en conservant la session courante. */
export function deleteOtherUserSessions(
  db: Database.Database,
  userId: number,
  currentToken: string,
): void {
  db.prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?").run(userId, currentToken);
}

export function purgeExpiredSessions(db: Database.Database): void {
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(new Date().toISOString());
}
