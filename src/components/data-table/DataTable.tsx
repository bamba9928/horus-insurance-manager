/**
 * Composant DataTable générique basé sur TanStack Table v8.
 * Tri, filtre global, pagination intégrés.
 */

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { useTranslation } from "react-i18next";

interface DataTableProps<TData> {
  /** Définition des colonnes */
  columns: ColumnDef<TData, unknown>[];
  /** Données à afficher */
  data: TData[];
  /** Texte de recherche global (contrôlé depuis le parent) */
  globalFilter?: string;
  /** Callback quand une ligne est cliquée */
  onRowClick?: (row: TData) => void;
  /** Nombre de lignes par page (défaut: 20) */
  pageSize?: number;
}

export function DataTable<TData>({
  columns,
  data,
  globalFilter = "",
  onRowClick,
  pageSize = 20,
}: DataTableProps<TData>) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize },
    },
  });

  return (
    <div className="rounded-lg border border-gray-200 bg-white dark:border-slate-700 dark:bg-slate-800">
      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm dark:text-slate-200">
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-slate-700 dark:bg-slate-900/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 font-medium text-gray-700 select-none dark:text-slate-300"
                    style={{ cursor: header.column.getCanSort() ? "pointer" : "default" }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === "asc" && " \u2191"}
                      {header.column.getIsSorted() === "desc" && " \u2193"}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-gray-500 dark:text-slate-400"
                >
                  {t("common.noData")}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={`border-b border-gray-100 transition-colors dark:border-slate-700/50 ${
                    onRowClick ? "cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50" : ""
                  }`}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3 dark:border-slate-700">
          <span className="text-sm text-gray-600 dark:text-slate-400">
            Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()} (
            {table.getFilteredRowModel().rows.length} résultats)
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Précédent
            </button>
            <button
              type="button"
              className="rounded border border-gray-300 px-3 py-1 text-sm disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Suivant
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
