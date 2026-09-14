# Barème de tarification auto — Sénégal (référence ASS)

> **Référence unique** du barème à appliquer à l'identique sur :
> - Horus Assurances Manager (`src/lib/tarification-bareme.ts` + `src/lib/tarification.ts`)
> - Horus Assurances Digital (`C:\Users\TBE\PycharmProjects\HorusAssurancesDigital`)
> - Fichier Excel `Tarification_Horus.xlsx`
>
> Toute modification se fait **d'abord ici**, puis est reportée dans les trois supports.
> Montants en FCFA, arrondis à l'entier le plus proche.

**Méthode (14/09/2026)** : analyse en lecture seule des 2 000 dernières propositions ASS
(manager.ass-assurances.sn, Odoo 16 — modèle `wizard.calcul.prime.assurance.auto` + lignes `decompte.prime`).
Statut : ✅ vérifié sur les données ASS · ⚠️ incohérent ou trop peu de cas.

---

## 1. Formules de calcul

| Étape | Formule | Statut |
|---|---|---|
| RC annuelle | tables §2 selon genre + puissance (CV) / places / cylindrée | ✅ |
| Coefficient durée — **mois** (1 à 11) | `8,75 % × mois` (12 mois = 100 %) | ✅ 1,2,3,4,6,9 mois |
| Coefficient durée — **jours** (prorata) | `ROUND(jours / 365 ; 3)` — ex. 10 j = 0,027 · 15 j = 0,041 · 20 j = 0,055 · 30 j = 0,082 | ✅ |
| RC prorata (champ ASS « prime_rc ») | `ROUND(RC annuelle × coefficient)` | ✅ |
| **Prime RC nette** | `ROUND(RC prorata × coef. réduction)` — voir §3 | ✅ |
| Réduction (affichée) | `RC prorata − Prime RC nette` | ✅ |
| Prime A.G (garanties annexes) | somme des garanties optionnelles (0 si RC seule) | ✅ |
| Coût de la police (frais) | saisi : 3 000 standard · TPV souvent 0 / 1 000 / 2 000 · TPC souvent 1 000 | ✅ |
| **Taxe** | `ROUND((Prime RC nette + Prime A.G + Frais) × 14 %)` | ✅ 1 958 cas |
| **FGA** | `ROUND(Prime RC nette × 2,5 %)` (pas sur A.G) | ✅ |
| **CEDEAO** | 300 hors TPV · **0 pour TPV** · compté une seule fois | ✅ |
| **Prime Totale** | `Prime RC nette + Prime A.G + Frais + Taxe + FGA + CEDEAO` | ✅ 1 958 cas |
| Commission | TPV : 8 %, 9 % ou 10 % de la Prime RC nette (selon apporteur) · hors TPV : variable (≈ 20–22 % du net), règle non déterminée | ⚠️ |

---

## 2. Tables RC annuelle (genres ASS)

Bornes CV inclusives. « et + » = sans plafond.

### CAT 01 — Véhicule Particulier (VP) ✅
| CV | RC annuelle |
|---|---|
| 1 – 6 | 45 181 |
| 7 – 10 | 51 078 |
| 11 – 14 | 65 677 |
| 15 – 23 | 86 456 |
| 24 et + | 104 143 |

### CAT 02 — TPC · Utilitaire carrosserie tourisme (Break / Fourgonnette) — code `TPC` ✅
| CV | RC annuelle |
|---|---|
| 5 – 7 | 78 974 |
| 8 – 10 | 113 944 |
| 11 – 16 | 146 969 |
| 17 et + | 174 491 |

### CAT 02 — TPC · Autres carrosseries jusqu'à 3T500 — code `TPC3T500` ✅
| CV | RC annuelle |
|---|---|
| 5 – 7 | 127 880 |
| 8 – 10 | 168 085 |
| 11 – 16 | 206 063 |
| 17 et + | 237 710 |

### CAT 02 — TPC · Autres carrosseries au-delà de 3T500 — code `TPC3T500P` ✅
| CV | RC annuelle |
|---|---|
| 5 – 7 | 130 415 |
| 8 – 10 | 170 617 |
| 11 – 16 | 208 597 |
| 17 et + | 240 245 |

> ⚠️ Quelques propositions ASS ont des puissances hors tranche (ex. 17–19 CV à 208 597) — saisies modifiées après calcul ; la majorité confirme les tranches ci-dessus.

### CAT 03 — TPM · Marchandises jusqu'à 3T500 ✅ (8 CV = 222 270 confirmé)
| CV | RC annuelle |
|---|---|
| 5 – 7 | 165 601 |
| 8 – 10 | 222 270 |
| 11 – 16 | 283 130 |
| 17 et + | 328 955 |

### CAT 03 — TPM · Marchandises au-delà de 3T500 ⚠️ (aucun cas ASS)
| CV | RC annuelle |
|---|---|
| 5 – 7 | 167 982 |
| 8 – 10 | 224 650 |
| 11 – 16 | 285 510 |
| 17 et + | 331 336 |

### CAT 04 — TPV · Transport de personnes 0 à 8 places (Taxi) — code `TPV8`
| CV | RC annuelle | Statut |
|---|---|---|
| 5 – 7 | 145 960 | ✅ |
| 8 – 10 | 196 133 | ✅ |
| 11 – 16 | 252 483 | ⚠️ |
| Taxi inter-urbain 7/8 places, 5 – 7 CV | 216 139 (Horus) · **191 651 vu une fois dans ASS** | ⚠️ |
| 8 – 10 / 11 – 16 inter-urbain | 266 312 / 322 662 | ⚠️ |

> ⚠️ 9 propositions taxi 6 CV à 128 938 : tarif spécial non identifié.

### CAT 04 — TPV · 9 places et plus (Autocar / Minicar) — code `TPV9` ✅
RC annuelle = **base (CV)** + **surprime places**

| CV | Base RC |
|---|---|
| 2 – 4 | 100 565 |
| 5 – 7 | 117 587 |
| 8 – 10 | 167 760 |
| 11 – 16 | 224 110 |
| 17 et + | 261 832 |

Surprime : `min(places − 1 ; 30) × 9 415 + max(0 ; places − 31) × 6 726`
(✅ 10 CV/30 pl = 440 795 · 9 CV/38 pl = 497 292)

### CAT 05 — Deux et trois roues ✅ (**corrigé par rapport à Horus**)
| Genre ASS | Code | RC annuelle |
|---|---|---|
| Cyclomoteurs | `2RCYC` | 18 780 |
| Scooters et vélomoteurs (≤ 125 cm³) | `2RSCO` | 29 448 |
| Motocyclettes et scooters > 125 cm³ | `2RMOT` | 34 021 |
| Side-cars / 3 roues (tricycle) | `2RSID` | 40 880 |
| Scooter usage **commercial** | `2RSCO` | 35 398 ⚠️ (1 cas) |

### Catégories ASS non couvertes par Horus (trop peu de cas)
CAT 06 Garage · CAT 07 Auto-école · CAT 08 Location · CAT 09/10 Engins de chantier, tracteurs,
collectivités publiques (vu : 120 422,5 / 262 036,5) · Bus école · Remorque.

---

## 3. Réductions ✅

| Catégorie | Réduction choisie | Coefficient appliqué à la RC prorata | Réduction réelle |
|---|---|---|---|
| CAT 01 VP, CAT 03, CAT 05 | 20 % (défaut) | × 0,80 | 20 % |
| CAT 01 VP | 40 % | × 0,60 | 40 % |
| CAT 01 VP | 10 % / 15 % / 0 % | × 0,90 / 0,85 / 1 | — |
| **CAT 02 TPC** (les 3 genres) | **40 % (défaut)** | **× 0,608** | **39,2 %** |
| CAT 04 TPV | aucune | × 1 | 0 % |

> La réduction « 40 % » des TPC donne toujours **× 0,608** dans ASS (120 cas, toutes durées) —
> soit 40 % puis +1,33 %, ou 20 % puis 24 %. On applique le coefficient 0,608 tel quel.

---

## 4. Exemples de contrôle (ASS)

### A — VP 9 CV, 3 mois, réduction 20 %
51 078 × 0,2625 = **13 408** → × 0,8 = **10 726** · Taxe (10 726 + 3 000) × 14 % = **1 922** ·
FGA **268** · CEDEAO **300** · **Total 16 216** ✅

### B — TPC autres carrosseries ≤ 3T500, 6 CV, 1 mois, réduction 40 %
127 880 × 0,0875 = **11 190** → × 0,608 = **6 804**
(la capture reçue montrait 5 443 = 11 190 × 0,8 × 0,608 : deux lignes RC, 20 % puis 40 %, cumulées)

### C — TPC > 3T500, 15 CV, 1 mois, réduction 40 %, frais 1 000
208 597 × 0,0875 = **18 252** → × 0,608 = **11 097** · Taxe (11 097 + 1 000) × 14 % = **1 694** ·
FGA **277** · CEDEAO **300** · **Total 14 368** ✅

### D — TPC > 3T500, 16 CV, 20 jours, réduction 40 %, frais 1 000
208 597 × ROUND(20/365 ; 3) = 208 597 × 0,055 = **11 473** → × 0,608 = **6 976** ✅

### E — Taxi 7 CV, 1 mois (TPV)
145 960 × 0,0875 = **12 772** · réduction 0 · CEDEAO 0 ✅

### F — VP 11 CV, 12 mois, réduction 40 %, + A.G
65 677 × 0,6 = **39 406** · A.G : personnes transportées 4 500 × 0,6 = 2 700 + bris de glace 10 000 ✅

---

## 5. Application dans les supports

| Règle | Manager | Excel | Digital |
|---|---|---|---|
| CAT 05 : 4 genres ASS (18 780 / 29 448 / 34 021 / 40 880) | ✅ | ✅ | ASS |
| CAT 02 : 3 sous-catégories aux libellés ASS | ✅ | ✅ | ASS |
| Réduction par défaut : TPV 0 %, TPC 40 % (× 0,98 → × 0,608), autres 20 % | ✅ | ✅ | ASS |
| Durée en jours `ROUND(jours/365 ; 3)` | ✅ (page Tarification) | ✅ | ASS |
| Arrondi du prorata avant réduction | ✅ | ✅ | ASS |
| Taxe incluant la Prime A.G | — (A.G non gérée) | — | ASS |

« ASS » : Horus Assurances Digital ne calcule pas la prime lui-même, il reçoit la ventilation
(`PrimeRC`, `Taxe`, `Reduction`, `Cedeao`…) directement de l'API ASS.

**Exception TPC** : l'API ASS plafonne la remise à 20 %. Digital déduit donc du net à verser une
« remise Horus » égale à l'écart avec le guichet : PrimeRC (brute × 0,608) + écart de taxe + écart de FGA
(`contract_horus_rebate`, `backend/contracts/services.py`). Ex. TPC > 3T500, 15 CV, 1 mois :
API 18 451 − remise 4 083 = **14 368** = guichet ✅

Tests : `tests/unit/tarification.test.ts` rejoue les décomptes ASS du §4.

## 6. Points encore ouverts ⚠️
- Taxi inter-urbain 7 places (191 651 vs 216 139) et taxi 6 CV à 128 938.
- Règle de commission hors TPV.
- Scooter commercial (35 398) et catégories 06 à 10.
