import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type Column<T> = {
  key: string;
  header: string;
  className?: string;
  cell: (row: T) => ReactNode;
};

/** Reusable admin table: responsive, RTL-safe, loading & empty states built in. */
export function DataTable<T>({
  columns,
  rows,
  loading,
  emptyText = "لا توجد بيانات",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  loading?: boolean;
  emptyText?: string;
  rowKey: (row: T) => string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr className="text-start">
              {columns.map((c) => (
                <th key={c.key} className={`p-3 text-start font-semibold ${c.className ?? ""}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`s${i}`} className="border-t">
                  {columns.map((c) => (
                    <td key={c.key} className="p-3">
                      <Skeleton className="h-4 w-24" />
                    </td>
                  ))}
                </tr>
              ))}
            {!loading && (rows?.length ?? 0) === 0 && (
              <tr>
                <td colSpan={columns.length} className="p-8 text-center text-muted-foreground">
                  {emptyText}
                </td>
              </tr>
            )}
            {!loading &&
              rows?.map((row) => (
                <tr key={rowKey(row)} className="border-t hover:bg-muted/30">
                  {columns.map((c) => (
                    <td key={c.key} className={`p-3 align-middle ${c.className ?? ""}`}>
                      {c.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
