export type PrefillSearchTarget = "clients" | "vehicules" | "polices" | "paiements";

function getKey(target: PrefillSearchTarget) {
  return `ham-prefill-search:${target}`;
}

export function setPrefillSearch(target: PrefillSearchTarget, value: string) {
  if (typeof window === "undefined") return;

  const normalized = value.trim();
  if (!normalized) return;

  window.sessionStorage.setItem(getKey(target), normalized);
}

export function consumePrefillSearch(target: PrefillSearchTarget): string {
  if (typeof window === "undefined") return "";

  const key = getKey(target);
  const value = window.sessionStorage.getItem(key) ?? "";
  window.sessionStorage.removeItem(key);
  return value;
}
