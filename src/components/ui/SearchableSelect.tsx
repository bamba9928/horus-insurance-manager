/**
 * Liste déroulante avec champ de recherche intégré.
 *
 * Remplace un `<select>` natif quand la liste est longue (ex: clients,
 * véhicules, polices). L'utilisateur tape pour filtrer, puis sélectionne
 * avec souris ou clavier (↑/↓ pour naviguer, Entrée pour valider, Échap
 * pour annuler).
 *
 * Conçu pour s'intégrer avec react-hook-form via `<Controller>`.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  /** Texte secondaire optionnel (affiché en plus petit sous le label) */
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string | number | null | undefined;
  onChange: (value: string | number | null) => void;
  options: SearchableSelectOption[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  /** Classe appliquée au bouton de déclenchement (pour matcher le style des autres inputs) */
  className?: string;
  /** id pour le label externe (htmlFor) */
  id?: string;
  /** Permet l'option "aucune sélection" */
  allowClear?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "— Sélectionner —",
  emptyText = "Aucun résultat",
  disabled,
  className,
  id,
  allowClear = true,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const autoId = useId();
  const listId = `${id ?? autoId}-list`;

  const selectedLabel = useMemo(() => {
    if (value == null || value === "") return "";
    return options.find((o) => o.value === value)?.label ?? "";
  }, [options, value]);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.sublabel?.toLowerCase().includes(q),
    );
  }, [options, search]);

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus auto sur l'input de recherche à l'ouverture
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Scroll auto vers l'item actif
  useEffect(() => {
    if (!open) return;
    const list = listRef.current;
    const active = list?.querySelector<HTMLDivElement>(`[data-index="${activeIndex}"]`);
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const commit = (v: string | number | null) => {
    onChange(v);
    setOpen(false);
    setSearch("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) commit(opt.value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      setSearch("");
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        id={id}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "mt-1 flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100",
          className,
        )}
      >
        <span className={cn("truncate", !selectedLabel && "text-gray-400 dark:text-slate-400")}>
          {selectedLabel || placeholder}
        </span>
        <span className="ml-2 text-gray-400 dark:text-slate-400">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-gray-100 p-2 dark:border-slate-700">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={onKeyDown}
              placeholder="Rechercher..."
              className="block w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900 focus:border-[#614e1a] focus:ring-1 focus:ring-[#614e1a] focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
          <div
            id={listId}
            ref={listRef}
            role="listbox"
            className="max-h-60 overflow-y-auto py-1 text-sm"
          >
            {allowClear && !search && (
              <div
                role="option"
                tabIndex={-1}
                aria-selected={value == null || value === ""}
                onClick={() => commit(null)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    commit(null);
                  }
                }}
                className={cn(
                  "cursor-pointer px-3 py-1.5 italic text-gray-500 hover:bg-gray-100 dark:text-slate-400 dark:hover:bg-slate-700",
                )}
              >
                — Aucune sélection —
              </div>
            )}
            {filtered.length === 0 && (
              <div className="px-3 py-2 text-center text-xs text-gray-500 dark:text-slate-400">
                {emptyText}
              </div>
            )}
            {filtered.map((opt, idx) => {
              const selected = opt.value === value;
              const active = idx === activeIndex;
              return (
                <div
                  key={opt.value}
                  role="option"
                  tabIndex={-1}
                  aria-selected={selected}
                  data-index={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => commit(opt.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      commit(opt.value);
                    }
                  }}
                  className={cn(
                    "cursor-pointer px-3 py-1.5",
                    active && "bg-[#614e1a]/10 dark:bg-[#614e1a]/30",
                    selected && "font-semibold text-[#614e1a] dark:text-amber-300",
                    !active &&
                      !selected &&
                      "text-gray-900 hover:bg-gray-100 dark:text-slate-100 dark:hover:bg-slate-700",
                  )}
                >
                  <div className="truncate">{opt.label}</div>
                  {opt.sublabel && (
                    <div className="truncate text-xs text-gray-500 dark:text-slate-400">
                      {opt.sublabel}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
