# Changelog

Tous les changements notables de ce projet sont documentés ici.
Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/)
et le versionnage suit [SemVer](https://semver.org/lang/fr/).

## [0.2.0] — 2026-11-14

### Ajouté

- **Tarification TPV** (CAT 04) : page dédiée taxis / minicars / autocars,
  alignée sur la grille Cat. 4 et le Pool TPV (surprimes par places,
  Individuelle Conducteur, carte brune 300).
- **Tarification** : prime de base ASS récupérée en direct, arrondis exacts
  au pair alignés sur les décomptes ASS.
- **Vérification** : détail de souscription AAS affiché.
- Navigation mobile et écran de connexion améliorés.

### Modifié

- **Tarification TPV** : le taux de commission n'est plus figé à 8 %. Il se
  saisit sur la page TPV (8 % par défaut, 8 / 9 / 10 % suggérés selon
  l'apporteur, au dixième de point près) ; `computeTarif` accepte un
  `tauxCommission` optionnel et refuse un taux hors 0–100 %.

### Corrigé

- Surprime minicar relevée sur le Pool TPV.
- Durée de couverture de la vérification calculée sur les dates.
- Sauvegarde : copies de base via un dossier temporaire privé.

### Sécurité

- Le mot de passe admin généré n'apparaît plus dans les logs.
- Conteneur Docker exécuté avec l'utilisateur `node`.
- CI : Gitleaks (pre-commit et workflow) et Trivy, actions épinglées par SHA,
  jeton GitHub restreint à `contents: read`.
- Dépendances mises à jour pour corriger les avis de sécurité (Tauri, Vite,
  Playwright, hono, seroval, zod, vitest, undici, rustls…).

## [0.1.0] — 2026-04-18

Première version publique. L'application couvre l'ensemble du cycle métier
courtage (client → véhicule → police → paiement → échéance) avec rappels,
exports et sauvegarde.

### Ajouté

- **Gestion clients** : CRUD complet avec recherche, vue maître-détail
  affichant les véhicules rattachés.
- **Gestion véhicules** : CRUD avec immatriculation, marque/modèle, genre,
  type, puissance et places. Rattachement obligatoire à un client.
- **Gestion polices d'assurance** : cartes VERTE / JAUNE, dates d'effet et
  d'échéance calculées automatiquement, renouvellement en un clic, suivi des
  statuts (active / expirée / annulée / renouvelée), rattachement à un assureur.
- **Gestion paiements** : montant dû, payé, avance, reste calculé, modes de
  paiement multiples, recherche sur numéro de police / nom client /
  immatriculation / référence.
- **Échéances** : calendrier avec 5 presets (J-7 expirées, J+30, J+60, J+90,
  EXPIRÉES), exports PDF (pdfmake) et XLSX (ExcelJS) en lazy-load.
- **Dashboard** : 4 KPI (polices actives, échéances 30j, impayés en FCFA,
  nouveaux clients du mois), liste des échéances urgentes et des impayés
  alimentée par des vues SQL dédiées.
- **Paramètres** :
  - CRUD assureurs.
  - Sauvegarde / restauration de la base SQLite (magic header validé,
    backup `.bak` automatique avant restauration).
  - Import CSV pour migration depuis `.accdb` Access (clients, véhicules,
    polices, paiements) avec normalisation des dates, résolution de clés
    étrangères et détection des doublons.
  - Sélecteur de langue FR / EN (persisté dans `localStorage`).
  - Sélecteur de thème clair / sombre / système (class-based Tailwind v4,
    anti-flash au démarrage).
- **Dark mode** complet sur toutes les vues (layout, header, sidebar,
  dialogues, tables de données, formulaires).
- **i18n** FR / EN exhaustif (nav, CRUD, dashboard, paramètres).
- **Tests** :
  - 38 tests unitaires Vitest sur les utilitaires, schémas Zod et hooks.
  - 8 tests E2E Playwright (navigation, dialogs, thème, langue).
- **CI GitHub Actions** : lint + TypeScript + tests unitaires + E2E sur
  Ubuntu, Rust clippy + tests sur Windows.
- **Release automatisée** : bundles Windows MSI et NSIS via
  `tauri-apps/tauri-action` sur tag `v*.*.*`.

### Technique

- Tauri 2 + React 19 + TypeScript 6 (strict + `exactOptionalPropertyTypes`).
- TanStack Router / Query v5 / Table v8.
- `react-hook-form` + Zod v4 pour les formulaires.
- SQLite via `tauri-plugin-sql` avec vues `v_echeances_30j` et `v_impayes`.
- Biome 2.4 pour le lint et le formatage.
- Logger Rust via `tauri-plugin-log` + Pino côté front.
