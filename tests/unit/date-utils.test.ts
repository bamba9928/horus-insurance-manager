import { describe, expect, it } from "vitest";
import {
  calcEcheance,
  deduireDureeMois,
  formatDateDisplay,
  formatDateISO,
  formatDateLong,
  formatFCFA,
  getUrgenceStatus,
  joursRestants,
} from "../../src/lib/date-utils";

describe("calcEcheance", () => {
  it("calcule correctement : 15/01/2025 + 12 mois = 14/01/2026", () => {
    const result = calcEcheance("2025-01-15", 12);
    expect(formatDateISO(result)).toBe("2026-01-14");
  });

  it("calcule correctement : 01/03/2025 + 1 mois = 31/03/2025", () => {
    const result = calcEcheance("2025-03-01", 1);
    expect(formatDateISO(result)).toBe("2025-03-31");
  });

  it("calcule correctement : 31/01/2025 + 1 mois = 27/02/2025", () => {
    const result = calcEcheance("2025-01-31", 1);
    expect(formatDateISO(result)).toBe("2025-02-27");
  });

  it("gère la durée de 3 mois", () => {
    const result = calcEcheance("2025-01-15", 3);
    expect(formatDateISO(result)).toBe("2025-04-14");
  });

  it("gère la durée de 6 mois", () => {
    const result = calcEcheance("2025-01-15", 6);
    expect(formatDateISO(result)).toBe("2025-07-14");
  });

  it("gère la durée de 24 mois", () => {
    const result = calcEcheance("2025-01-15", 24);
    expect(formatDateISO(result)).toBe("2027-01-14");
  });

  it("accepte un objet Date en entrée", () => {
    const result = calcEcheance(new Date(2025, 0, 15), 12);
    expect(formatDateISO(result)).toBe("2026-01-14");
  });

  it("rejette une date invalide", () => {
    expect(() => calcEcheance("invalid-date", 12)).toThrow("Date d'effet invalide");
  });

  it("rejette une durée non autorisée", () => {
    expect(() => calcEcheance("2025-01-15", 5)).toThrow("Durée invalide");
  });
});

describe("formatDateDisplay", () => {
  it("formate une date ISO en format court français", () => {
    const result = formatDateDisplay("2025-01-15");
    expect(result).toMatch(/15/);
    expect(result).toMatch(/2025/);
  });
});

describe("formatDateLong", () => {
  it("formate une date en format long français", () => {
    const result = formatDateLong("2025-01-15");
    expect(result).toContain("15");
    expect(result).toContain("janvier");
    expect(result).toContain("2025");
  });
});

describe("formatFCFA", () => {
  it("formate un montant simple", () => {
    const result = formatFCFA(1500000);
    expect(result).toContain("1");
    expect(result).toContain("500");
    expect(result).toContain("000");
    expect(result).toContain("FCFA");
  });

  it("formate zéro", () => {
    expect(formatFCFA(0)).toContain("0");
    expect(formatFCFA(0)).toContain("FCFA");
  });
});

describe("joursRestants", () => {
  it("retourne un nombre de jours", () => {
    const result = joursRestants("2099-01-01");
    expect(result).toBeGreaterThan(0);
  });

  it("retourne un nombre négatif pour une date passée", () => {
    const result = joursRestants("2020-01-01");
    expect(result).toBeLessThan(0);
  });
});

describe("getUrgenceStatus", () => {
  it("retourne EXPIREE pour jours négatifs", () => {
    expect(getUrgenceStatus(-1)).toBe("EXPIREE");
    expect(getUrgenceStatus(-30)).toBe("EXPIREE");
  });

  it("retourne URGENTE pour 0-7 jours", () => {
    expect(getUrgenceStatus(0)).toBe("URGENTE");
    expect(getUrgenceStatus(7)).toBe("URGENTE");
  });

  it("retourne PROCHAINE pour 8-30 jours", () => {
    expect(getUrgenceStatus(8)).toBe("PROCHAINE");
    expect(getUrgenceStatus(30)).toBe("PROCHAINE");
  });

  it("retourne OK pour plus de 30 jours", () => {
    expect(getUrgenceStatus(31)).toBe("OK");
    expect(getUrgenceStatus(365)).toBe("OK");
  });
});

describe("deduireDureeMois", () => {
  it("déduit 12 mois pour un écart d'environ 1 an", () => {
    expect(deduireDureeMois("2025-01-15", "2026-01-14")).toBe(12);
  });

  it("déduit 6 mois", () => {
    expect(deduireDureeMois("2025-01-15", "2025-07-14")).toBe(6);
  });

  it("déduit 3 mois", () => {
    expect(deduireDureeMois("2025-01-15", "2025-04-14")).toBe(3);
  });

  it("déduit 1 mois", () => {
    expect(deduireDureeMois("2025-01-15", "2025-02-14")).toBe(1);
  });

  it("déduit 24 mois pour un écart d'environ 2 ans", () => {
    expect(deduireDureeMois("2025-01-15", "2027-01-14")).toBe(24);
  });
});
