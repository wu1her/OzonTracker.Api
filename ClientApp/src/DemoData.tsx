import { useEffect, useState } from "react";
import { getCatalog, simulateChanges } from "./api/productsApi";
import { runScenario } from "./api/trackingApi";
import type { Product } from "./models/Product";

const money = (value: number) =>
  new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(value);
const date = (value: string) => new Date(value).toLocaleString("ru-RU");

export function DemoControls({
  products,
  onAdd,
  onRefresh,
}: {
  products: Product[];
  onAdd: (value: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
}) {
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [scenarioProduct, setScenarioProduct] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    getCatalog(controller.signal)
      .then(setCatalog)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            error instanceof Error ? error.message : "Каталог недоступен.",
          );
      });
    return () => controller.abort();
  }, [products]);

  async function simulate(scenario?: string) {
    setBusy(true);
    try {
      const count = scenario
        ? (
            await runScenario(
              scenario,
              scenarioProduct ? Number(scenarioProduct) : undefined,
            )
          ).updatedProducts
        : await simulateChanges();
      await onRefresh();
      setMessage(
        `Новый срез сохранён в SQL Server. Обновлено товаров: ${count}.`,
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Ошибка обновления.");
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    setBusy(true);
    try {
      if (await onAdd(selected)) setSelected("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="demo-controls dashboard-panel">
      <div>
        <h2>Демонстрационная база SQL Server</h2>
        <p>
          Все товары и показатели вымышлены. История уже заполнена за 30 дней.
          Кнопка обновления меняет цены, остатки, продажи и число отзывов в БД.
        </p>
      </div>
      <div className="demo-actions">
        <label htmlFor="catalog-product">Добавить из каталога</label>
        <select
          id="catalog-product"
          value={selected}
          onChange={(event) => setSelected(event.target.value)}
          disabled={busy}
        >
          <option value="">
            {catalog.length ? "Выберите товар" : "Нет новых товаров в каталоге"}
          </option>
          {catalog.map((product) => (
            <option key={product.id} value={product.ozonProductId}>
              {product.name} · {product.ozonProductId} · {money(product.price)}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="button secondary"
          disabled={!selected || busy}
          onClick={() => void add()}
        >
          Отслеживать
        </button>
        <button
          type="button"
          className="button primary"
          disabled={busy || products.length === 0}
          onClick={() => void simulate()}
        >
          {busy ? "Подождите…" : "Смоделировать изменения"}
        </button>
      </div>
      <div className="scenario-actions">
        <label className="select-control">
          <select
            aria-label="Товар для сценария"
            value={scenarioProduct}
            onChange={(e) => setScenarioProduct(e.target.value)}
            disabled={busy}
          >
            <option value="">Все отслеживаемые товары</option>
            {products.map((p) => (
              <option key={p.id} value={p.ozonProductId}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="button secondary"
          disabled={busy || !products.length}
          onClick={() => void simulate("sale")}
        >
          Началась распродажа · −20%
        </button>
        <button
          className="button secondary"
          disabled={busy || !products.length}
          onClick={() => void simulate("outOfStock")}
        >
          Товар закончился
        </button>
        <button
          className="button secondary"
          disabled={busy || !products.length}
          onClick={() => void simulate("restock")}
        >
          Поступление на склад · +50
        </button>
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}

export { PriceChart } from "./AnalyticsChart";

export function SnapshotTable({ product }: { product: Product }) {
  return (
    <div className="snapshot-table-wrap">
      <table className="snapshot-table">
        <caption>
          История {product.name} · демонстрационные данные SQL Server
        </caption>
        <thead>
          <tr>
            <th>Дата</th>
            <th>Цена</th>
            <th>По карте</th>
            <th>Изменение цены</th>
            <th>Остаток</th>
            <th>Продано всего</th>
            <th>Рейтинг</th>
            <th>Отзывы</th>
          </tr>
        </thead>
        <tbody>
          {product.history
            .map((point, index) => {
              const previous = product.history[index - 1];
              const delta = previous ? point.price - previous.price : null;
              return (
                <tr key={point.id}>
                  <td>{date(point.capturedAt)}</td>
                  <td>{money(point.price)}</td>
                  <td>{money(point.ozonCardPrice)}</td>
                  <td>
                    {delta === null
                      ? "Первый срез"
                      : `${delta > 0 ? "+" : ""}${money(delta)}`}
                  </td>
                  <td>{point.stocks}</td>
                  <td>{point.soldUnits}</td>
                  <td>{point.rating.toFixed(1)}</td>
                  <td>{point.reviewCount}</td>
                </tr>
              );
            })
            .reverse()}
        </tbody>
      </table>
    </div>
  );
}
