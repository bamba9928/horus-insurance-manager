import { RouterProvider } from "@tanstack/react-router";
import { Spinner } from "./components/ui/Spinner";
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
    return <Spinner fullScreen label="Chargement..." />;
  }

  if (!user) return <LoginPage />;

  return <RouterProvider router={router} />;
}

export default App;
