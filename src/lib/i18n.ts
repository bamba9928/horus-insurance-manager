/**
 * Configuration i18next pour l'internationalisation.
 * Français par défaut, anglais secondaire.
 *
 * @module i18n
 */

import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const LANG_STORAGE_KEY = "ham-lang";

const resources = {
  fr: {
    translation: {
      app: {
        title: "Horus Assurances Manager",
        subtitle: "Gestion de courtage en assurance auto",
      },
      nav: {
        dashboard: "Tableau de bord",
        verification: "Vérification",
        clients: "Clients",
        vehicules: "Véhicules",
        polices: "Polices",
        paiements: "Paiements",
        echeances: "Échéances",
        parametres: "Paramètres",
        admin: "Administration",
      },
      common: {
        create: "Créer",
        edit: "Modifier",
        delete: "Supprimer",
        save: "Enregistrer",
        cancel: "Annuler",
        search: "Rechercher",
        filter: "Filtrer",
        export: "Exporter",
        import: "Importer",
        loading: "Chargement...",
        noData: "Aucune donnée",
        confirm: "Confirmer",
        yes: "Oui",
        no: "Non",
        close: "Fermer",
        actions: "Actions",
        all: "Tous",
        none: "Aucun",
        date: "Date",
      },
      clients: {
        title: "Clients",
        nomPrenom: "Nom & Prénom",
        telephone: "Téléphone",
        email: "Email",
        adresse: "Adresse",
        notes: "Notes",
      },
      vehicules: {
        title: "Véhicules",
        immatriculation: "Immatriculation",
        marque: "Marque",
        modele: "Modèle",
        genre: "Catégorie",
        categorie: "Catégorie",
        puissance: "Puissance (CV)",
        places: "Places",
        typeVehicule: "Type de véhicule",
        client: "Client",
        selectClient: "— Sélectionner un client —",
      },
      polices: {
        title: "Polices",
        numero: "N° Police",
        typeCarte: "Type carte",
        dateEffet: "Date d'effet",
        dureeMois: "Durée (mois)",
        dateEcheance: "Date d'échéance",
        assureur: "Assureur",
        statut: "Statut",
        renouveler: "Renouveler",
        verte: "VERTE",
        jaune: "JAUNE",
        active: "Active",
        expiree: "Expirée",
        annulee: "Annulée",
        renouvelee: "Renouvelée",
      },
      paiements: {
        title: "Paiements",
        montantDu: "Montant dû",
        paye: "Payé",
        avance: "Avance",
        reste: "Reste",
        mode: "Mode",
        reference: "Référence",
        solde: "Soldé",
        partiel: "Partiel",
        impaye: "Impayé",
      },
      echeances: {
        title: "Échéances",
        joursRestants: "Jours restants",
        urgente: "Urgente",
        prochaine: "Prochaine",
        expiree: "Expirée",
      },
      dashboard: {
        title: "Accueil",
        policesActives: "Polices actives",
        echeances30j: "Échéances 30j",
        impayes: "Impayés",
        nouveauxClients: "Nouveaux clients",
        echeancesUrgentes: "Échéances",
        parSemaine: "Par semaine",
      },
      dossier: {
        title: "Nouveau dossier",
        bouton: "Nouveau dossier",
        steps: {
          client: "Client",
          vehicule: "Véhicule",
          police: "Police",
          paiement: "Paiement",
        },
        clientExistant: "Client existant",
        nouveauClient: "Nouveau client",
        vehiculeExistant: "Véhicule existant",
        nouveauVehicule: "Nouveau véhicule",
        clientRequis: "Veuillez sélectionner un client",
        vehiculeRequis: "Veuillez sélectionner un véhicule",
        aucunVehiculeClient: "Aucun véhicule pour ce client",
        clientDoublon: "Ce client existe déjà ({{nom}}). Utilisez « Client existant ».",
        telephoneDoublon:
          "Ce téléphone est déjà enregistré pour {{nom}}. Utilisez « Client existant ».",
        vehiculeDoublon:
          "Cette immatriculation existe déjà ({{immatriculation}}). Utilisez « Véhicule existant ».",
        enregistrerPaiement: "Enregistrer un paiement maintenant",
        precedent: "Précédent",
        suivant: "Suivant",
        enregistrerDossier: "Enregistrer le dossier",
      },
      encaissement: {
        title: "Encaisser un versement",
        bouton: "Encaisser",
        montant: "Montant encaissé",
        resteActuel: "Reste à payer",
        nouveauReste: "Nouveau reste",
      },
      tarification: {
        title: "Tarification",
        button: "TARIFICATION",
      },
      parametres: {
        assureurs: {
          title: "Gestion des compagnies",
          description: "Ajouter, modifier ou supprimer des compagnies d'assurance.",
          nouveau: "Ajouter une compagnie",
        },
        backup: {
          title: "Sauvegarde & Restauration",
          description:
            "Télécharger la base de données complète ou la restaurer depuis un fichier .db.",
          sauvegarder: "Sauvegarder maintenant",
          restaurer: "Restaurer depuis un fichier",
          confirmTitle: "Confirmer la restauration",
        },
        import: {
          title: "Import de données (.accdb → CSV)",
          description:
            "Ouvrez votre base .accdb dans Microsoft Access, exportez chaque table en CSV, puis chargez-les ci-dessous dans l'ordre.",
          selectFile: "Sélectionner un CSV",
          inProgress: "Import en cours...",
          reports: "Rapports d'import",
          clear: "Effacer",
          read: "Lues",
          inserted: "Insérées",
          skipped: "Ignorées (doublons)",
          errors: "Erreurs",
        },
        theme: {
          title: "Thème",
          light: "Clair",
          dark: "Sombre",
          system: "Système",
        },
        language: {
          title: "Apparence & Langue",
          label: "Langue",
        },
      },
    },
  },
  en: {
    translation: {
      app: {
        title: "Horus Insurance Manager",
        subtitle: "Auto insurance brokerage management",
      },
      nav: {
        dashboard: "Dashboard",
        verification: "Verification",
        clients: "Clients",
        vehicules: "Vehicles",
        polices: "Policies",
        paiements: "Payments",
        echeances: "Deadlines",
        parametres: "Settings",
        admin: "Administration",
      },
      common: {
        create: "Create",
        edit: "Edit",
        delete: "Delete",
        save: "Save",
        cancel: "Cancel",
        search: "Search",
        filter: "Filter",
        export: "Export",
        import: "Import",
        loading: "Loading...",
        noData: "No data",
        confirm: "Confirm",
        yes: "Yes",
        no: "No",
        close: "Close",
        actions: "Actions",
        all: "All",
        none: "None",
        date: "Date",
      },
      clients: {
        title: "Clients",
        nomPrenom: "Full name",
        telephone: "Phone",
        email: "Email",
        adresse: "Address",
        notes: "Notes",
      },
      vehicules: {
        title: "Vehicles",
        immatriculation: "License plate",
        marque: "Make",
        modele: "Model",
        genre: "Category",
        categorie: "Category",
        puissance: "Horsepower (HP)",
        places: "Seats",
        typeVehicule: "Vehicle type",
        client: "Client",
        selectClient: "— Select a client —",
      },
      polices: {
        title: "Policies",
        numero: "Policy #",
        typeCarte: "Card type",
        dateEffet: "Effective date",
        dureeMois: "Duration (months)",
        dateEcheance: "Expiry date",
        assureur: "Insurer",
        statut: "Status",
        renouveler: "Renew",
        verte: "GREEN",
        jaune: "YELLOW",
        active: "Active",
        expiree: "Expired",
        annulee: "Cancelled",
        renouvelee: "Renewed",
      },
      paiements: {
        title: "Payments",
        montantDu: "Amount due",
        paye: "Paid",
        avance: "Advance",
        reste: "Balance",
        mode: "Method",
        reference: "Reference",
        solde: "Settled",
        partiel: "Partial",
        impaye: "Unpaid",
      },
      echeances: {
        title: "Deadlines",
        joursRestants: "Days remaining",
        urgente: "Urgent",
        prochaine: "Upcoming",
        expiree: "Expired",
      },
      dashboard: {
        title: "Home",
        policesActives: "Active policies",
        echeances30j: "Deadlines 30d",
        impayes: "Unpaid",
        nouveauxClients: "New clients",
        echeancesUrgentes: "Deadlines",
        parSemaine: "Per week",
      },
      dossier: {
        title: "New case file",
        bouton: "New case file",
        steps: {
          client: "Client",
          vehicule: "Vehicle",
          police: "Policy",
          paiement: "Payment",
        },
        clientExistant: "Existing client",
        nouveauClient: "New client",
        vehiculeExistant: "Existing vehicle",
        nouveauVehicule: "New vehicle",
        clientRequis: "Please select a client",
        vehiculeRequis: "Please select a vehicle",
        aucunVehiculeClient: "No vehicle for this client",
        clientDoublon: "This client already exists ({{nom}}). Use “Existing client”.",
        telephoneDoublon:
          "This phone number is already registered for {{nom}}. Use “Existing client”.",
        vehiculeDoublon:
          "This license plate already exists ({{immatriculation}}). Use “Existing vehicle”.",
        enregistrerPaiement: "Record a payment now",
        precedent: "Back",
        suivant: "Next",
        enregistrerDossier: "Save case file",
      },
      encaissement: {
        title: "Record a payment",
        bouton: "Collect",
        montant: "Amount received",
        resteActuel: "Outstanding balance",
        nouveauReste: "New balance",
      },
      tarification: {
        title: "Pricing",
        button: "PRICING",
      },
      parametres: {
        assureurs: {
          title: "Companies",
          description: "Add, edit or remove insurance companies.",
          nouveau: "Add a company",
        },
        backup: {
          title: "Backup & Restore",
          description: "Download the full database or restore from a .db file.",
          sauvegarder: "Backup now",
          restaurer: "Restore from file",
          confirmTitle: "Confirm restore",
        },
        import: {
          title: "Data import (.accdb → CSV)",
          description:
            "Open your .accdb database in Microsoft Access, export each table to CSV, then load them below in order.",
          selectFile: "Select a CSV",
          inProgress: "Import in progress...",
          reports: "Import reports",
          clear: "Clear",
          read: "Read",
          inserted: "Inserted",
          skipped: "Skipped (duplicates)",
          errors: "Errors",
        },
        theme: {
          title: "Theme",
          light: "Light",
          dark: "Dark",
          system: "System",
        },
        language: {
          title: "Appearance & Language",
          label: "Language",
        },
      },
    },
  },
};

/** Langue initiale : préférence localStorage > navigateur > fr. */
function getInitialLang(): string {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem(LANG_STORAGE_KEY);
  if (stored === "fr" || stored === "en") return stored;
  const navLang = window.navigator.language?.slice(0, 2);
  return navLang === "en" ? "en" : "fr";
}

i18n.use(initReactI18next).init({
  resources,
  lng: getInitialLang(),
  fallbackLng: "fr",
  interpolation: {
    escapeValue: false,
  },
});

// Persister le changement de langue
i18n.on("languageChanged", (lng) => {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(LANG_STORAGE_KEY, lng.slice(0, 2));
  }
});

export default i18n;
