import { RouterProvider } from "@tanstack/react-router";
import { AuthProvider, isWebMode, useAuth } from "./lib/auth";
import { router } from "./router";
import { LoginPage } from "./routes/login";

function App() {
  // Mode desktop (Tauri) : pas d'authentification, app directe.
  if (!isWebMode) return <RouterProvider router={router} />;

  // Mode web : porte d'authentification.
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

/** Affiche la page de connexion tant qu'aucune session valide n'existe. */
function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f6f2e8] dark:bg-slate-900">
        <p className="text-sm text-gray-500 dark:text-slate-400">Chargement...</p>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return <RouterProvider router={router} />;
}

export default App;
