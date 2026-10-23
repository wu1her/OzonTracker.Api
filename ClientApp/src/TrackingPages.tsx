import { useState } from "react";
import { Bell, Check, Heart, Target, ArrowRight } from "lucide-react";
import type { Product } from "./models/Product";
import type {
  NotificationInbox,
  PriceNotification,
} from "./models/Notification";
import { setPreferences } from "./api/trackingApi";
import { AnalyticsChart } from "./AnalyticsChart";
import "./Tracking.css";
const money = (price: number) =>
  price.toLocaleString("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  });
export function ProductTools({
  product,
  onUpdated,
}: {
  product: Product;
  onUpdated: (product: Product) => void;
}) {
  const [target, setTarget] = useState(product.targetPrice?.toString() ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function save(
    favorite = product.isFavorite,
    price: number | null = target.trim() ? Number(target) : null,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      onUpdated(await setPreferences(product, favorite, price));
      setMessage(
        price === null
          ? "Настройки сохранены."
          : "Целевая цена сохранена. При её достижении появится уведомление.",
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Не удалось сохранить.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="settings-card product-tools">
      <div>
        <h2>
          <Target size={19} /> Целевая цена
        </h2>
        <p>Сообщим, когда обычная цена станет равна цели или опустится ниже.</p>
      </div>
      <button
        className={`button secondary favorite-button ${product.isFavorite ? "selected" : ""}`}
        disabled={busy}
        aria-pressed={product.isFavorite}
        onClick={() => void save(!product.isFavorite, product.targetPrice)}
      >
        <Heart size={17} fill={product.isFavorite ? "currentColor" : "none"} />
        {product.isFavorite ? "В избранном" : "В избранное"}
      </button>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label>
          Целевая цена, ₽
          <input
            aria-label="Целевая цена, ₽"
            type="number"
            min="0.01"
            max="9999999999999999"
            step="0.01"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="Например, 4000"
            disabled={busy}
          />
        </label>
        <button className="button primary" disabled={busy}>
          Сохранить цель
        </button>
        {product.targetPrice !== null && (
          <button
            className="button secondary"
            type="button"
            disabled={busy}
            onClick={async () => {
              setTarget("");
              await save(product.isFavorite, null);
            }}
          >
            Убрать цель
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="tracking-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {product.targetPrice !== null && (
        <small>
          Сейчас: {money(product.price)} · Цель: {money(product.targetPrice)}
          {product.price <= product.targetPrice ? " · Цель достигнута" : ""}
        </small>
      )}
    </section>
  );
}
export function ComparisonPage({
  products,
  selected,
  onSelect,
}: {
  products: Product[];
  selected: string[];
  onSelect: (id: string) => void;
}) {
  const chosen = products.filter((p) => selected.includes(p.id));
  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <span className="page-eyebrow">Выбор товаров</span>
          <h1>Сравнение товаров</h1>
          <p>
            Выберите от двух до трёх товаров и сравните цены, остатки и
            изменения за период.
          </p>
        </div>
        <span className="tag neutral">{chosen.length} из 3</span>
      </section>
      <section className="comparison-picker">
        {products.map((product) => (
          <label
            key={product.id}
            className={selected.includes(product.id) ? "selected" : ""}
          >
            <input
              type="checkbox"
              checked={selected.includes(product.id)}
              disabled={chosen.length >= 3 && !selected.includes(product.id)}
              onChange={() => onSelect(product.id)}
            />
            <span>
              {product.name}
              <small>{money(product.price)}</small>
            </span>
          </label>
        ))}
        {!products.length && <p>Добавьте товары из каталога для сравнения.</p>}
      </section>
      {chosen.length < 2 ? (
        <section className="settings-card comparison-empty">
          <h2>
            Выберите ещё {2 - chosen.length}{" "}
            {chosen.length === 0 ? "товара" : "товар"}
          </h2>
          <p>
            На графике появится отдельная линия для каждого товара. Показатель
            можно переключать.
          </p>
        </section>
      ) : (
        <>
          <AnalyticsChart
            sources={chosen.map((p) => ({
              id: p.id,
              label: p.name,
              history: p.history,
            }))}
          />
          <div className="snapshot-table-wrap">
            <table className="snapshot-table comparison-table">
              <caption>Текущие показатели</caption>
              <thead>
                <tr>
                  <th>Показатель</th>
                  {chosen.map((p) => (
                    <th key={p.id}>{p.name}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Цена", value: (p: Product) => money(p.price) },
                  {
                    label: "Цена по карте",
                    value: (p: Product) => money(p.ozonCardPrice),
                  },
                  {
                    label: "Остаток",
                    value: (p: Product) => `${p.stocks} шт.`,
                  },
                  {
                    label: "Продано всего",
                    value: (p: Product) => p.soldUnits.toString(),
                  },
                  {
                    label: "Рейтинг",
                    value: (p: Product) => p.rating.toFixed(1),
                  },
                  {
                    label: "Минимум за всю историю",
                    value: (p: Product) =>
                      money(Math.min(...p.history.map((s) => s.price))),
                  },
                  {
                    label: "Максимум за всю историю",
                    value: (p: Product) =>
                      money(Math.max(...p.history.map((s) => s.price))),
                  },
                ].map((row) => (
                  <tr key={row.label}>
                    <td>{row.label}</td>
                    {chosen.map((p) => (
                      <td key={p.id}>{row.value(p)}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
export function NotificationList({
  inbox,
  onOpen,
  compact = false,
}: {
  inbox: NotificationInbox;
  onOpen: (notification: PriceNotification) => void;
  compact?: boolean;
}) {
  return (
    <div className="price-notifications">
      {(compact ? inbox.items.slice(0, 4) : inbox.items).map((item) => (
        <button
          className={`price-notification ${item.readAt ? "" : "unread"}`}
          key={item.id}
          onClick={() => onOpen(item)}
        >
          <span className="notice-icon">
            {item.readAt ? <Check size={16} /> : <Bell size={16} />}
          </span>
          <span>
            <strong>{item.productName}</strong>
            <span>
              Цена {money(item.price)} — цель {money(item.targetPrice)}{" "}
              достигнута
            </span>
            <time>{new Date(item.createdAt).toLocaleString("ru-RU")}</time>
          </span>
          <ArrowRight size={15} />
        </button>
      ))}
      {!inbox.items.length && (
        <div className="notification-empty">
          <Bell size={27} />
          <p>Уведомлений пока нет</p>
          <small>
            Задайте целевую цену в карточке товара, затем запустите сценарий
            «Распродажа».
          </small>
        </div>
      )}
    </div>
  );
}
export function NotificationsPage({
  inbox,
  onOpen,
  onReadAll,
}: {
  inbox: NotificationInbox;
  onOpen: (notification: PriceNotification) => void;
  onReadAll: () => void;
}) {
  return (
    <main className="page">
      <section className="page-heading">
        <div>
          <span className="page-eyebrow">Целевые цены</span>
          <h1>Уведомления</h1>
          <p>
            Срабатывания ваших ценовых целей. Непрочитанных: {inbox.unreadCount}
            .
          </p>
        </div>
        <button
          className="button secondary"
          disabled={!inbox.unreadCount}
          onClick={onReadAll}
        >
          Прочитать все
        </button>
      </section>
      <section className="settings-card">
        <NotificationList inbox={inbox} onOpen={onOpen} />
      </section>
    </main>
  );
}
