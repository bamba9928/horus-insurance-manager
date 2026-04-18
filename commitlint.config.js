export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [
      2,
      "always",
      [
        "clients",
        "vehicules",
        "polices",
        "paiements",
        "echeances",
        "dashboard",
        "parametres",
        "db",
        "ipc",
        "ui",
        "i18n",
        "export",
        "backup",
        "migration",
        "ci",
        "deps",
      ],
    ],
  },
};
