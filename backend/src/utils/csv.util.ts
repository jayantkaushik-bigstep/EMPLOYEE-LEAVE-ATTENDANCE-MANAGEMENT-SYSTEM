/**
 * Utility for converting arrays of objects into formatted CSV strings.
 */

export interface CsvColumn<T = any> {
  header: string;
  accessor: (row: T) => any;
}

/**
 * Escapes a cell value for CSV (quotes if contains commas, quotes, or newlines).
 */
export const escapeCsvCell = (value: any): string => {
  if (value === null || value === undefined) {
    return "";
  }
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Converts rows to a CSV string given a column configuration.
 */
export const jsonToCsv = <T = any>(rows: T[], columns: CsvColumn<T>[]): string => {
  const headerLine = columns.map((col) => escapeCsvCell(col.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((col) => escapeCsvCell(col.accessor(row))).join(",")
  );

  return [headerLine, ...dataLines].join("\r\n");
};
