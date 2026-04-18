/**
 * Configuration du routeur TanStack Router.
 * Toutes les routes de l'application sont déclarées ici.
 *
 * @module router
 */

import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AppLayout } from "./components/layout";
import { ClientsPage } from "./routes/clients/index";
import { EcheancesPage } from "./routes/echeances/index";
import { DashboardPage } from "./routes/index";
import { PaiementsPage } from "./routes/paiements/index";
import { ParametresPage } from "./routes/parametres/index";
import { PolicesPage } from "./routes/polices/index";
import { VehiculesPage } from "./routes/vehicules/index";

// ============ Root Route (Layout) ============

const rootRoute = createRootRoute({
  component: AppLayout,
});

// ============ Routes enfants ============

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const clientsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/clients",
  component: ClientsPage,
});

const vehiculesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/vehicules",
  component: VehiculesPage,
});

const policesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/polices",
  component: PolicesPage,
});

const paiementsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/paiements",
  component: PaiementsPage,
});

const echeancesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/echeances",
  component: EcheancesPage,
});

const parametresRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/parametres",
  component: ParametresPage,
});

// ============ Arbre de routes ============

const routeTree = rootRoute.addChildren([
  indexRoute,
  clientsRoute,
  vehiculesRoute,
  policesRoute,
  paiementsRoute,
  echeancesRoute,
  parametresRoute,
]);

// ============ Routeur ============

export const router = createRouter({ routeTree });

// ============ Type augmentation pour TanStack Router ============

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
