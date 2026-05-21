import type { BalticPublicationCalendar, PublicationCalendarRow } from "../types";

export function toBalticPublicationCalendar(rows: PublicationCalendarRow[]): BalticPublicationCalendar | undefined {
  if (!rows.length) return undefined;
  return {
    publishedDates: rows.filter((row) => row.is_published && !row.is_holiday).map((row) => row.date),
    holidays: rows.filter((row) => row.is_holiday || !row.is_published).map((row) => row.date),
  };
}

