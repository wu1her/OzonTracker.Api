import type { ProductSnapshot } from "./models/Product";
export type Metric =
  | "price"
  | "ozonCardPrice"
  | "stocks"
  | "sales"
  | "rating"
  | "reviewCount";
export const metrics: { id: Metric; label: string; unit: string }[] = [
  { id: "price", label: "Цена товара", unit: "₽" },
  { id: "ozonCardPrice", label: "Цена по карте", unit: "₽" },
  { id: "stocks", label: "Остатки", unit: "шт." },
  { id: "sales", label: "Продажи между срезами", unit: "шт." },
  { id: "rating", label: "Рейтинг", unit: "из 5" },
  { id: "reviewCount", label: "Количество отзывов", unit: "шт." },
];
export const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
export const dayNumber = (day: string) =>
  Date.parse(`${day}T00:00:00Z`) / 86400000;
export const addDays = (day: string, count: number) =>
  new Date((dayNumber(day) + count) * 86400000).toISOString().slice(0, 10);
export interface Bucket {
  from: string;
  to: string;
  snapshot: ProductSnapshot | null;
  previous: ProductSnapshot | null;
}
export function periodBuckets(
  history: ProductSnapshot[],
  from: string,
  to: string,
  weekly: boolean,
): Bucket[] {
  const start = dayNumber(from),
    end = dayNumber(to);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end < start ||
    end - start > 365
  )
    return [];
  const sorted = [...history].sort(
    (a, b) =>
      new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime() ||
      a.id - b.id,
  );
  const dated = sorted.map((snapshot) => ({
    snapshot,
    day: dayNumber(isoDay(new Date(snapshot.capturedAt))),
  }));
  const result: Bucket[] = [];
  for (let day = start; day <= end; day += weekly ? 7 : 1) {
    const last = Math.min(end, day + (weekly ? 6 : 0));
    const inBucket = dated.filter((p) => p.day >= day && p.day <= last);
    result.push({
      from: addDays(from, day - start),
      to: addDays(from, last - start),
      snapshot: inBucket.at(-1)?.snapshot ?? null,
      previous: dated.filter((p) => p.day < day).at(-1)?.snapshot ?? null,
    });
  }
  return result;
}
export function metricValue(bucket: Bucket, metric: Metric): number | null {
  if (!bucket.snapshot) return null;
  if (metric !== "sales") return bucket.snapshot[metric];
  if (!bucket.previous) return null;
  const delta = bucket.snapshot.soldUnits - bucket.previous.soldUnits;
  return delta < 0 ? null : delta;
}
export function precedingPeriod(from: string, to: string) {
  const length = dayNumber(to) - dayNumber(from) + 1;
  if (!Number.isFinite(length) || length <= 0 || length > 366)
    return { from, to };
  return { from: addDays(from, -length), to: addDays(from, -1) };
}
export function valueSummary(values: (number | null)[]) {
  const available = values.filter((value): value is number => value !== null);
  return {
    min: available.length ? Math.min(...available) : null,
    max: available.length ? Math.max(...available) : null,
    change:
      available.length >= 2 && available[0] !== 0
        ? ((available.at(-1)! - available[0]) / available[0]) * 100
        : null,
  };
}
