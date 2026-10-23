import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Expand, Info, X } from "lucide-react";
import type { ProductSnapshot } from "./models/Product";
import {
  addDays,
  dayNumber,
  isoDay,
  metrics,
  metricValue,
  periodBuckets,
  precedingPeriod,
  valueSummary,
  type Metric,
} from "./chartData";
import "./AnalyticsChart.css";
export interface ChartSource {
  id: string;
  label: string;
  history: ProductSnapshot[];
}
const palette = ["#3697ff", "#29d4a2", "#b49aff"];
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "short",
  });
const format = (value: number | null, unit: string) =>
  value === null
    ? "Нет данных"
    : `${value.toLocaleString("ru-RU", { maximumFractionDigits: 2 })} ${unit}`;
export function PriceChart({
  history,
  initialMetric = "price",
}: {
  history: ProductSnapshot[];
  initialMetric?: Metric;
}) {
  return (
    <AnalyticsChart
      sources={[{ id: "product", label: "Товар", history }]}
      initialMetric={initialMetric}
    />
  );
}
export function AnalyticsChart({
  sources,
  initialMetric = "price",
}: {
  sources: ChartSource[];
  initialMetric?: Metric;
}) {
  const today = isoDay(new Date());
  const [metric, setMetric] = useState<Metric>(initialMetric);
  const [range, setRange] = useState("7");
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [weekly, setWeekly] = useState(false);
  const [compare, setCompare] = useState(sources.length === 1);
  const [card, setCard] = useState(false);
  const [active, setActive] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState(700);
  const root = useRef<HTMLDivElement>(null);
  const modal = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  const gradient = useId().replace(/:/g, "");
  const info = metrics.find((item) => item.id === metric)!;
  useEffect(() => {
    const element = root.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(270, entries[0].contentRect.width)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [expanded]);
  useEffect(() => {
    if (expanded) modal.current?.showModal();
    else if (modal.current?.open) {
      modal.current.close();
      expandButton.current?.focus();
    }
  }, [expanded]);
  useEffect(() => setActive(null), [from, to, metric, weekly, compare, card]);
  const data = useMemo(() => {
    const previous = precedingPeriod(from, to);
    return sources.map((source) => ({
      ...source,
      buckets: periodBuckets(source.history, from, to, weekly),
      previous: periodBuckets(
        source.history,
        previous.from,
        previous.to,
        weekly,
      ),
    }));
  }, [sources, from, to, weekly]);
  const buckets = data[0]?.buckets ?? [];
  const lines = data.flatMap((source, index) => {
    const color = palette[index % palette.length];
    const current = {
      key: source.id,
      label: sources.length > 1 ? source.label : info.label,
      color,
      previous: false,
      values: source.buckets.map((b) => metricValue(b, metric)),
      buckets: source.buckets,
    };
    const result = [current];
    if (compare)
      result.push({
        ...current,
        key: source.id + "-previous",
        previous: true,
        values: source.previous.map((b) => metricValue(b, metric)),
        buckets: source.previous,
      });
    if (card && metric === "price" && sources.length === 1) {
      const cardLine = {
        ...current,
        key: "card",
        label: "Цена по карте",
        color: palette[1],
        values: source.buckets.map((b) => metricValue(b, "ozonCardPrice")),
      };
      result.push(cardLine);
      if (compare)
        result.push({
          ...cardLine,
          key: "card-previous",
          previous: true,
          values: source.previous.map((b) => metricValue(b, "ozonCardPrice")),
          buckets: source.previous,
        });
    }
    return result;
  });
  const all = lines
    .flatMap((line) => line.values)
    .filter((value): value is number => value !== null);
  const rawMin = all.length ? Math.min(...all) : 0,
    rawMax = all.length ? Math.max(...all) : 1;
  const padding = Math.max(
    (rawMax - rawMin) * 0.16,
    rawMax * 0.025,
    metric === "rating" ? 0.05 : 1,
  );
  const paddedMin =
    metric === "stocks" || metric === "sales" || metric === "reviewCount"
      ? 0
      : Math.max(0, rawMin - padding);
  const paddedMax = rawMax + padding;
  const roughStep = Math.max((paddedMax - paddedMin) / 4, 0.0001);
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / magnitude;
  const niceStep =
    (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) *
    magnitude;
  const tickStep = ["stocks", "sales", "reviewCount"].includes(metric)
    ? Math.max(1, niceStep)
    : niceStep;
  const min = Math.floor(paddedMin / tickStep) * tickStep;
  const domainMax = Math.max(
    min + tickStep,
    Math.ceil(paddedMax / tickStep) * tickStep,
  );
  const max = metric === "rating" ? Math.min(5, domainMax) : domainMax;
  const ticks = Array.from(
    { length: Math.floor((max - min) / tickStep) + 1 },
    (_, index) => min + index * tickStep,
  );
  if (ticks.at(-1)! < max - tickStep * 0.001) ticks.push(max);
  const left = 66,
    right = 22,
    top = 26,
    bottom = 262;
  const x = (index: number) =>
    left +
    (width - left - right) *
      (buckets.length <= 1 ? 0.5 : index / (buckets.length - 1));
  const y = (value: number) =>
    bottom - ((value - min) / Math.max(max - min, 0.001)) * (bottom - top);
  const path = (values: (number | null)[]) => {
    let connected = false;
    return values
      .map((value, index) => {
        if (value === null) {
          connected = false;
          return "";
        }
        const text = `${connected ? "L" : "M"}${x(index)},${y(value)}`;
        connected = true;
        return text;
      })
      .join(" ");
  };
  const periodError =
    !Number.isFinite(dayNumber(from)) ||
    !Number.isFinite(dayNumber(to)) ||
    dayNumber(to) < dayNumber(from) ||
    dayNumber(to) - dayNumber(from) > 365;
  const observed = sources.flatMap((source) =>
    source.history.filter((point) => {
      const day = isoDay(new Date(point.capturedAt));
      return !periodError && day >= from && day <= to;
    }),
  );
  const stats = valueSummary(
    metric === "sales"
      ? data.flatMap((source) =>
          source.buckets.map((bucket) => metricValue(bucket, metric)),
        )
      : observed.map((point) => point[metric]),
  );
  const singleChange =
    sources.length === 1 ? valueSummary(lines[0]?.values ?? []).change : null;
  function preset(value: string) {
    setRange(value);
    if (value !== "custom") {
      setFrom(addDays(today, -Number(value) + 1));
      setTo(today);
    }
  }

  const activeIndex =
    active === null ? null : Math.min(active, buckets.length - 1);
  const content = (
    <section className="analytics-widget">
      <div className="analytics-toolbar">
        <div>
          <span className="panel-kicker">
            {sources.length > 1 ? "Сравнение товаров" : "Аналитика товара"}
          </span>
          <h2>Динамика показателей</h2>
        </div>
        <div className="analytics-toolbar-actions">
          <label>
            Период
            <select
              aria-label="Период графика"
              value={range}
              onChange={(e) => preset(e.target.value)}
            >
              <option value="7">7 дней</option>
              <option value="14">14 дней</option>
              <option value="30">30 дней</option>
              <option value="custom">Свой период</option>
            </select>
          </label>
          <button
            ref={!expanded ? expandButton : undefined}
            type="button"
            className="button secondary"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? <X size={16} /> : <Expand size={16} />}{" "}
            {expanded ? "Закрыть график" : "Развернуть график"}
          </button>
        </div>
      </div>
      {range === "custom" && (
        <div className="chart-date-range">
          <label>
            С
            <input
              aria-label="График: дата начала"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            По
            <input
              aria-label="График: дата окончания"
              type="date"
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <small>До 366 дней</small>
        </div>
      )}
      <div className="analytics-layout">
        <fieldset className="metric-selector">
          <legend>
            Показатели <Info size={14} />
          </legend>
          {metrics.map((item) => (
            <label className={metric === item.id ? "active" : ""} key={item.id}>
              <input
                type="radio"
                name={gradient + "-metric"}
                checked={metric === item.id}
                onChange={() => setMetric(item.id)}
              />
              <span className="metric-radio" />
              <span>
                {item.label}
                <small>{item.unit}</small>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="analytics-main">
          <div className="chart-options">
            <span>
              {info.label}, {info.unit}
            </span>
            <div className="segmented">
              <button
                aria-pressed={!weekly}
                className={!weekly ? "active" : ""}
                onClick={() => setWeekly(false)}
              >
                День
              </button>
              <button
                aria-pressed={weekly}
                className={weekly ? "active" : ""}
                onClick={() => setWeekly(true)}
              >
                Неделя
              </button>
            </div>
          </div>
          <div className="chart-toggles">
            <label>
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
              />{" "}
              Сравнить с предыдущим периодом
            </label>
            {metric === "price" && sources.length === 1 && (
              <label>
                <input
                  type="checkbox"
                  checked={card}
                  onChange={(e) => setCard(e.target.checked)}
                />{" "}
                Показать цену по карте
              </label>
            )}
          </div>
          <div className="interactive-chart" ref={root}>
            {periodError ? (
              <div className="chart-no-data">
                Выберите корректный период длиной не более 366 дней.
              </div>
            ) : !all.length ? (
              <div className="chart-no-data">
                За выбранный период нет срезов. Выберите другой период или
                запустите демосценарий.
              </div>
            ) : (
              <>
                <svg
                  viewBox={`0 0 ${width} 310`}
                  role="img"
                  tabIndex={0}
                  aria-label={`Интерактивный график: ${info.label}. Стрелки влево и вправо выбирают дату.`}
                  onFocus={() => setActive(buckets.length - 1)}
                  onBlur={() => setActive(null)}
                  onKeyDown={(event) => {
                    if (
                      event.key === "ArrowLeft" ||
                      event.key === "ArrowRight"
                    ) {
                      event.preventDefault();
                      setActive((current) =>
                        Math.max(
                          0,
                          Math.min(
                            buckets.length - 1,
                            (current ?? 0) +
                              (event.key === "ArrowRight" ? 1 : -1),
                          ),
                        ),
                      );
                    }
                  }}
                  onPointerMove={(event) => {
                    const box = event.currentTarget.getBoundingClientRect();
                    const position =
                      ((event.clientX - box.left) / box.width) * width;
                    setActive(
                      Math.max(
                        0,
                        Math.min(
                          buckets.length - 1,
                          Math.round(
                            ((position - left) / (width - left - right)) *
                              (buckets.length - 1),
                          ),
                        ),
                      ),
                    );
                  }}
                  onPointerLeave={(event) => {
                    if (event.pointerType !== "touch") setActive(null);
                  }}
                >
                  <defs>
                    {lines
                      .filter((line) => !line.previous)
                      .map((line, index) => (
                        <linearGradient
                          id={`${gradient}-${index}`}
                          key={line.key}
                          x1="0"
                          x2="0"
                          y1="0"
                          y2="1"
                        >
                          <stop
                            offset="0%"
                            stopColor={line.color}
                            stopOpacity=".2"
                          />
                          <stop
                            offset="100%"
                            stopColor={line.color}
                            stopOpacity="0"
                          />
                        </linearGradient>
                      ))}
                  </defs>
                  {ticks.map((value) => (
                    <g key={value}>
                      <line
                        x1={left}
                        x2={width - right}
                        y1={y(value)}
                        y2={y(value)}
                        className="analytics-gridline"
                      />
                      <text
                        x={left - 12}
                        y={y(value) + 4}
                        textAnchor="end"
                        className="analytics-axis"
                      >
                        {value.toLocaleString("ru-RU", {
                          notation: "compact",
                          maximumFractionDigits: 1,
                        })}
                      </text>
                    </g>
                  ))}
                  {buckets.map((bucket, index) =>
                    index %
                      Math.max(
                        1,
                        Math.ceil(
                          buckets.length / Math.max(2, Math.floor(width / 100)),
                        ),
                      ) ===
                      0 || index === buckets.length - 1 ? (
                      <g key={bucket.from}>
                        <text
                          x={x(index)}
                          y={286}
                          textAnchor="middle"
                          className="analytics-axis"
                        >
                          {dateLabel(bucket.from)}
                        </text>
                        {compare && data[0]?.previous[index] && (
                          <text
                            x={x(index)}
                            y={303}
                            textAnchor="middle"
                            className="analytics-axis"
                            opacity={0.55}
                          >
                            {dateLabel(data[0].previous[index].from)}
                          </text>
                        )}
                      </g>
                    ) : null,
                  )}
                  {lines.map((line, lineIndex) => (
                    <g key={line.key}>
                      {!line.previous &&
                        sources.length === 1 &&
                        line.values.every((value) => value !== null) && (
                          <path
                            d={`${path(line.values)} L${x(buckets.length - 1)},${bottom} L${x(0)},${bottom} Z`}
                            fill={`url(#${gradient}-${lines.slice(0, lineIndex).filter((item) => !item.previous).length})`}
                          />
                        )}
                      <path
                        d={path(line.values)}
                        fill="none"
                        stroke={line.color}
                        strokeWidth={line.previous ? 2 : 2.6}
                        strokeDasharray={line.previous ? "5 6" : undefined}
                        opacity={line.previous ? 0.55 : 1}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {line.values.map((value, index) =>
                        value === null ? null : (
                          <circle
                            key={index}
                            className="chart-data-point"
                            cx={x(index)}
                            cy={y(value)}
                            r={activeIndex === index ? 5.5 : 3.2}
                            fill={
                              activeIndex === index
                                ? "var(--panel-solid)"
                                : line.color
                            }
                            stroke={line.color}
                            strokeWidth="2"
                            opacity={line.previous ? 0.6 : 1}
                            onPointerDown={() => setActive(index)}
                          />
                        ),
                      )}
                    </g>
                  ))}
                  {activeIndex !== null && activeIndex >= 0 && (
                    <line
                      x1={x(activeIndex)}
                      x2={x(activeIndex)}
                      y1={top}
                      y2={bottom}
                      className="chart-crosshair"
                    />
                  )}
                </svg>
                {activeIndex !== null && activeIndex >= 0 && (
                  <div
                    className="chart-tooltip"
                    role="tooltip"
                    style={{
                      left: Math.min(
                        width - 120,
                        Math.max(120, x(activeIndex)),
                      ),
                    }}
                  >
                    <strong>{info.label}</strong>
                    {lines.map((line) => {
                      const bucket = line.buckets[activeIndex];
                      return (
                        <div key={line.key}>
                          <i
                            style={{
                              background: line.color,
                              opacity: line.previous ? 0.6 : 1,
                            }}
                          />
                          <span>
                            {sources.length > 1 ? line.label + " · " : ""}
                            {line.previous ? "Прошлый: " : ""}
                            {bucket
                              ? dateLabel(bucket.from) +
                                (bucket.from !== bucket.to
                                  ? " – " + dateLabel(bucket.to)
                                  : "")
                              : "—"}
                          </span>
                          <b>
                            {format(
                              line.values[activeIndex] ?? null,
                              info.unit,
                            )}
                          </b>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
          <div className="analytics-legend">
            {lines.map((line) => (
              <span key={line.key}>
                <i
                  style={{
                    borderColor: line.color,
                    borderTopStyle: line.previous ? "dashed" : "solid",
                    opacity: line.previous ? 0.6 : 1,
                  }}
                />
                {line.label} ·{" "}
                {line.previous ? "прошлый период" : "текущий период"}
                {line.values.every((value) => value === null)
                  ? " · нет данных"
                  : ""}
              </span>
            ))}
          </div>
          <p className="chart-footnote">
            {metric === "sales"
              ? "Продажи — разница накопленных счётчиков. Без предыдущего среза значение не рассчитывается."
              : "Для каждого дня или недели берётся последний срез. Пропуски не заменяются нулями."}{" "}
            Наведите на точку, коснитесь графика или используйте стрелки
            клавиатуры.
          </p>
        </div>
      </div>
      <div className="chart-summary">
        <div>
          <span>
            {metric === "price" ? "Минимальная цена" : "Минимальное значение"}
          </span>
          <strong>{format(stats.min, info.unit)}</strong>
        </div>
        <div>
          <span>
            {metric === "price" ? "Максимальная цена" : "Максимальное значение"}
          </span>
          <strong>{format(stats.max, info.unit)}</strong>
        </div>
        <div>
          <span>
            {sources.length === 1
              ? "Изменение за период"
              : "Товаров в сравнении"}
          </span>
          <strong
            className={
              singleChange !== null &&
              singleChange < 0 &&
              (metric === "price" || metric === "ozonCardPrice")
                ? "decrease"
                : ""
            }
          >
            {sources.length > 1 ? (
              sources.length
            ) : singleChange === null ? (
              "—"
            ) : (
              <>
                {singleChange < 0 ? (
                  <ArrowDownRight size={18} />
                ) : (
                  <ArrowUpRight size={18} />
                )}{" "}
                {singleChange > 0 ? "+" : ""}
                {singleChange.toFixed(1)}%
              </>
            )}
          </strong>
        </div>
      </div>
    </section>
  );
  return (
    <>
      {!expanded && content}
      <dialog
        className="chart-modal"
        ref={modal}
        onCancel={() => setExpanded(false)}
        onClose={() => setExpanded(false)}
        aria-label="Развёрнутый график"
      >
        {expanded && content}
      </dialog>
    </>
  );
}
