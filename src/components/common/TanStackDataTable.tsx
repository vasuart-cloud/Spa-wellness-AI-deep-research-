import React, { useMemo, useState } from "react";
import { flexRender } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  LegacyColumnDef,
  useLegacyTable,
} from "@tanstack/react-table/legacy";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";

export interface SimpleColumnSpec {
  key: string;
  header: string;
  align?: "left" | "right";
}

interface TanStackDataTableProps {
  columns: SimpleColumnSpec[];
  rows: Array<Record<string, string | number>>;
  searchPlaceholder?: string;
  pageSize?: number;
  compact?: boolean;
  emptyMessage?: string;
}

export const TanStackDataTable: React.FC<TanStackDataTableProps> = ({
  columns,
  rows,
  searchPlaceholder = "Filter records...",
  pageSize = 8,
  compact = false,
  emptyMessage = "No matching records in current analytical scope.",
}) => {
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<Array<{ id: string; desc: boolean }>>([]);

  const tableColumns = useMemo<
    Array<LegacyColumnDef<Record<string, string | number>>>
  >(
    () =>
      columns.map((col) => ({
        id: col.key,
        accessorFn: (row) => row[col.key],
        header: () => col.header,
        cell: (info) => {
          const val = info.getValue();
          return String(val ?? "—");
        },
        sortingFn: (
          rowA: { getValue: (id: string) => unknown },
          rowB: { getValue: (id: string) => unknown },
          columnId: string
        ) => {
          const rawA = String(rowA.getValue(columnId) ?? "");
          const rawB = String(rowB.getValue(columnId) ?? "");
          // Parse formatted currency/percent/numeric values cleanly for accurate sorting
          const numA = parseFloat(rawA.replace(/[$,%+ptsdays\s,]/g, ""));
          const numB = parseFloat(rawB.replace(/[$,%+ptsdays\s,]/g, ""));
          if (!Number.isNaN(numA) && !Number.isNaN(numB) && /\d/.test(rawA) && /\d/.test(rawB)) {
            return numA - numB;
          }
          return rawA.localeCompare(rawB);
        },
      })),
    [columns]
  );

  const table = useLegacyTable({
    data: rows,
    columns: tableColumns,
    state: {
      globalFilter,
      sorting,
    },
    initialState: {
      pagination: {
        pageIndex: 0,
        pageSize,
      },
    },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const alignByColId = useMemo(() => {
    const map: Record<string, "left" | "right"> = {};
    columns.forEach((c) => {
      map[c.key] = c.align ?? "left";
    });
    return map;
  }, [columns]);

  return (
    <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
      {rows.length > 4 && (
        <div className="px-3.5 py-2.5 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder={searchPlaceholder}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600/20 focus:border-teal-600"
            />
          </div>
          <span className="text-xs text-slate-500 font-mono tabular-nums whitespace-nowrap">
            {table.getFilteredRowModel().rows.length} row(s)
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr
                key={hg.id}
                className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600"
              >
                {hg.headers.map((header) => {
                  const align = alignByColId[header.column.id] ?? "left";
                  const sortDir = header.column.getIsSorted();
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      className={`${compact ? "px-3 py-2" : "px-4 py-2.5"} select-none cursor-pointer hover:text-slate-900 transition-colors whitespace-nowrap ${
                        align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      <span
                        className={`inline-flex items-center gap-1 ${
                          align === "right" ? "justify-end" : "justify-start"
                        }`}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {sortDir === "asc" ? (
                          <ArrowUp className="w-3 h-3 text-teal-700" />
                        ) : sortDir === "desc" ? (
                          <ArrowDown className="w-3 h-3 text-teal-700" />
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-300" />
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-50/90 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => {
                    const align = alignByColId[cell.column.id] ?? "left";
                    const text = String(cell.getValue() ?? "");
                    const isNeg =
                      text.startsWith("-") &&
                      (text.includes("%") ||
                        text.includes("pts") ||
                        text.includes("$"));
                    const isPos =
                      text.startsWith("+") &&
                      (text.includes("%") ||
                        text.includes("pts") ||
                        text.includes("$"));

                    return (
                      <td
                        key={cell.id}
                        className={`${compact ? "px-3 py-2" : "px-4 py-2.5"} whitespace-nowrap ${
                          align === "right"
                            ? "text-right font-mono tabular-nums"
                            : "text-left font-medium text-slate-800"
                        } ${
                          isNeg
                            ? "text-red-700"
                            : isPos
                              ? "text-emerald-700"
                              : ""
                        }`}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {table.getPageCount() > 1 && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs text-slate-600">
          <span className="font-mono tabular-nums">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount()}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2.5 py-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2.5 py-1 border border-slate-200 rounded bg-white hover:bg-slate-50 disabled:opacity-40 whitespace-nowrap"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
