/**
 * Script d'init injecté dans chaque page Playwright avant le chargement de
 * l'app. Installe `window.__TAURI_INTERNALS__` avec un `invoke` mocké qui gère
 * `tauri-plugin-sql` (en renvoyant des résultats vides), ainsi que nos
 * commandes Rust personnalisées.
 *
 * Exporté comme fonction passée à `page.addInitScript(fn)` — Playwright
 * sérialise et injecte le corps dans le navigateur.
 */

export function installTauriMock(): void {
  type InvokeArgs = Record<string, unknown> | undefined;

  function mockInvoke(cmd: string, _args?: InvokeArgs): Promise<unknown> {
    if (cmd === "plugin:sql|load") {
      return Promise.resolve("sqlite:assurauto.db");
    }
    if (cmd === "plugin:sql|execute") {
      return Promise.resolve([0, 0]);
    }
    if (cmd === "plugin:sql|select") {
      return Promise.resolve([]);
    }
    if (cmd === "plugin:sql|close") {
      return Promise.resolve(true);
    }
    if (cmd === "greet") {
      return Promise.resolve("Hello from mock");
    }
    if (cmd === "backup_database") {
      return Promise.resolve([] as number[]);
    }
    if (cmd === "restore_database") {
      return Promise.resolve("Restauration simulée (mock Playwright).");
    }
    if (cmd.startsWith("plugin:log|")) {
      return Promise.resolve(null);
    }
    // eslint-disable-next-line no-console
    console.warn(`[mock-tauri] commande non gérée : ${cmd}`);
    return Promise.resolve(null);
  }

  // biome-ignore lint/suspicious/noExplicitAny: shim navigateur
  (window as any).__TAURI_INTERNALS__ = {
    invoke: mockInvoke,
    transformCallback: () => 0,
    metadata: {
      currentWindow: { label: "main" },
      currentWebview: { label: "main" },
    },
  };
}
