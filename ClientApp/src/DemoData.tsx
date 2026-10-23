import { useEffect, useState } from "react";
import { getCatalog, simulateChanges } from "./api/productsApi";
import type { Product, ProductSnapshot } from "./models/Product";

const money = (value: number) => new Intl.NumberFormat("ru-RU", {
  style: "currency", currency: "RUB", maximumFractionDigits: 2,
}).format(value);
const date = (value: string) => new Date(value).toLocaleString("ru-RU");

export function DemoControls({ products, onAdd, onRefresh }: {
  products: Product[];
  onAdd: (value: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getCatalog(controller.signal).then(setCatalog).catch((error: unknown) => {
      if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Каталог недоступен.");
    });
    return () => controller.abort();
  }, [products]);

  async function simulate() {
    setBusy(true);
    try {
      const count = await simulateChanges();
      await onRefresh();
      setMessage(`Новый срез сохранён в SQL Server. Обновлено товаров: ${count}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка обновления.");
    } finally { setBusy(false); }
  }

  async function add() {
    setBusy(true);
    try {
      if (await onAdd(selected)) setSelected("");
    } finally { setBusy(false); }
  }

  return <section className="demo-controls dashboard-panel">
    <div>
      <h2>Демонстрационная база SQL Server</h2>
      <p>Все товары и показатели вымышлены. История уже заполнена за 30 дней.
        Кнопка обновления меняет цены, остатки, продажи и число отзывов в БД.</p>
    </div>
    <div className="demo-actions">
      <label htmlFor="catalog-product">Добавить из каталога</label>
      <select id="catalog-product" value={selected} onChange={event => setSelected(event.target.value)} disabled={busy}>
        <option value="">{catalog.length ? "Выберите товар" : "Нет новых товаров в каталоге"}</option>
        {catalog.map(product => <option key={product.id} value={product.ozonProductId}>
          {product.name} · {product.ozonProductId} · {money(product.price)}
        </option>)}
      </select>
      <button type="button" className="button secondary" disabled={!selected || busy} onClick={() => void add()}>Отслеживать</button>
      <button type="button" className="button primary" disabled={busy || products.length === 0} onClick={() => void simulate()}>
        {busy ? "Подождите…" : "Смоделировать изменения"}
      </button>
    </div>
    {message && <p role="status">{message}</p>}
  </section>;
}

export function PriceChart({ history }: { history: ProductSnapshot[] }) {
  if (!history.length) return <p>История ещё не накоплена.</p>;
  const points = history.slice(-60);
  const min = Math.min(...points.map(point => point.ozonCardPrice)) * 0.97;
  const max = Math.max(...points.map(point => point.price)) * 1.03;
  const firstTime = new Date(points[0].capturedAt).getTime();
  const duration = Math.max(new Date(points.at(-1)!.capturedAt).getTime() - firstTime, 1);
  const x = (point: ProductSnapshot) => 70 + (new Date(point.capturedAt).getTime() - firstTime) / duration * 600;
  const y = (value: number) => 170 - ((value - min) / Math.max(max - min, 1)) * 145;
  const line = (field: "price" | "ozonCardPrice") => points.map(point => `${x(point)},${y(point[field])}`).join(" ");
  return <>
    <svg className="price-history-chart" viewBox="0 0 700 215" role="img" aria-label="Цены и цены по карте из истории SQL Server">
      {[0, 1, 2, 3].map(index => {
        const value = min + (max - min) * index / 3;
        return <g key={index}>
          <line x1="70" x2="675" y1={y(value)} y2={y(value)} stroke="currentColor" opacity=".15" />
          <text x="65" y={y(value) + 4} textAnchor="end" fill="currentColor" fontSize="10">{Math.round(value).toLocaleString("ru-RU")}</text>
        </g>;
      })}
      <polyline points={line("price")} className="chart-line blue" fill="none" />
      <polyline points={line("ozonCardPrice")} className="chart-line green" fill="none" />
      {points.map(point => <circle key={point.id} cx={x(point)} cy={y(point.price)} r="3" fill="#2389ff">
        <title>{date(point.capturedAt)}: {money(point.price)}; по карте {money(point.ozonCardPrice)}</title>
      </circle>)}
      <text x="70" y="205" fill="currentColor" fontSize="11">{new Date(points[0].capturedAt).toLocaleDateString("ru-RU")}</text>
      <text x="675" y="205" textAnchor="end" fill="currentColor" fontSize="11">{new Date(points.at(-1)!.capturedAt).toLocaleDateString("ru-RU")}</text>
    </svg>
    <div className="chart-legend"><span><i className="legend-dot blue" />Цена</span><span><i className="legend-dot green" />Цена по карте</span></div>
  </>;
}

export function SnapshotTable({ product }: { product: Product }) {
  return <div className="snapshot-table-wrap"><table className="snapshot-table">
    <caption>История {product.name} · демонстрационные данные SQL Server</caption>
    <thead><tr><th>Дата</th><th>Цена</th><th>По карте</th><th>Изменение цены</th><th>Остаток</th><th>Продано всего</th><th>Рейтинг</th><th>Отзывы</th></tr></thead>
    <tbody>{product.history.map((point, index) => {
      const previous = product.history[index - 1];
      const delta = previous ? point.price - previous.price : null;
      return <tr key={point.id}>
        <td>{date(point.capturedAt)}</td><td>{money(point.price)}</td><td>{money(point.ozonCardPrice)}</td>
        <td>{delta === null ? "Первый срез" : `${delta > 0 ? "+" : ""}${money(delta)}`}</td>
        <td>{point.stocks}</td><td>{point.soldUnits}</td><td>{point.rating.toFixed(1)}</td><td>{point.reviewCount}</td>
      </tr>;
    }).reverse()}</tbody>
  </table></div>;
}
