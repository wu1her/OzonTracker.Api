import {
  Activity,
  BarChart3,
  Bell,
  Box,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Clock3,
  Copy,
  Database,
  History,
  Home,
  Info,
  Moon,
  Package,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  TrendingUp,
  UserRound,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  addProduct,
  deleteProduct,
  getProducts,
} from "./api/productsApi";
import type { Product } from "./models/Product";
import { DemoControls, PriceChart, SnapshotTable } from "./DemoData";
import "./App.css";

type AppPage =
  | "products"
  | "statistics"
  | "history"
  | "settings"
  | "about";

type DetailTab =
  | "overview"
  | "statistics"
  | "prices"
  | "stocks"
  | "sales"
  | "reviews";

type Theme = "dark" | "light";
type ToastKind = "success" | "error" | "info";
type SortMode = "updated" | "name" | "price" | "stocks";

interface ToastState {
  id: number;
  kind: ToastKind;
  message: string;
}

const moneyFormatter = new Intl.NumberFormat("ru-RU", {
  style: "currency",
  currency: "RUB",
  maximumFractionDigits: 0,
});

const compactMoneyFormatter = new Intl.NumberFormat("ru-RU", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFormatter = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatMoney(value: number): string {
  return value > 0 ? moneyFormatter.format(value) : "—";
}

function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function formatCompactMoney(value: number): string {
  return value > 0 ? `${compactMoneyFormatter.format(value)} ₽` : "0 ₽";
}

function getInitialTheme(): Theme {
  const stored = localStorage.getItem("ozon-tracker-theme");
  return stored === "light" ? "light" : "dark";
}

const navigationItems: Array<{
  id: AppPage;
  label: string;
  icon: LucideIcon;
}> = [
  { id: "products", label: "Главная", icon: Home },
  { id: "statistics", label: "Статистика", icon: BarChart3 },
  { id: "history", label: "История изменений", icon: History },
  { id: "settings", label: "Настройки", icon: Settings },
  { id: "about", label: "О сервисе", icon: CircleHelp },
];

function Sidebar({
  page,
  refreshMinutes,
  onNavigate,
  apiError,
}: {
  page: AppPage;
  refreshMinutes: number;
  onNavigate: (page: AppPage) => void;
  apiError: string | null;
}) {
  return (
    <aside className="sidebar">
      <button
        className="brand"
        type="button"
        onClick={() => onNavigate("products")}
      >
        <span className="brand-logo">
          <Sparkles size={15} strokeWidth={2.4} />
        </span>
        <span className="brand-copy">
          <strong>OZON</strong>
          <span>Tracker</span>
        </span>
      </button>

      <nav className="navigation" aria-label="Главная навигация">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          const isActive = page === item.id;

          return (
            <button
              key={item.id}
              className={`navigation-item ${isActive ? "active" : ""}`}
              type="button"
              onClick={() => onNavigate(item.id)}
            >
              <Icon size={19} />
              <span>{item.label}</span>
              {isActive && <span className="navigation-dot" />}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-spacer" />

      <div className="sidebar-status">
        <div className="status-row">
          <span className="status-icon blue">
            <Clock3 size={17} />
          </span>
          <div>
            <span>Обновление списка</span>
            <strong>каждые {refreshMinutes} мин.</strong>
          </div>
        </div>

        <div className="status-divider" />

        <div className="status-row">
          <span className="status-icon green">
            <Activity size={17} />
          </span>
          <div>
            <span>База данных</span>
            <strong className={apiError ? "status-pending" : "status-online"}>{apiError ? "Недоступна" : "Деморежим"}</strong>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({
  theme,
  onToggleTheme,
}: {
  theme: Theme;
  onToggleTheme: () => void;
}) {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);

  return (
    <header className="topbar">
      <div className="topbar-breadcrumb">
        <span className="live-dot" />
        <span>Демонстрация · SQL Server</span>
      </div>

      <div className="topbar-actions">
        <div className="topbar-popover-wrap">
          <button
            className="icon-button"
            type="button"
            aria-label="Уведомления"
            onClick={() => {
              setIsNotificationsOpen((value) => !value);
              setIsUserMenuOpen(false);
            }}
          >
            <Bell size={17} />
            <span className="notification-dot" />
          </button>

          {isNotificationsOpen && (
            <div className="popover notification-popover">
              <div className="popover-title-row">
                <strong>Уведомления</strong>
                <button
                  type="button"
                  onClick={() => setIsNotificationsOpen(false)}
                  aria-label="Закрыть"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="notification-item">
                <span className="notification-icon success">
                  <Check size={15} />
                </span>
                <div>
                  <strong>Демонстрационные данные</strong>
                  <span>Выберите товар из каталога и смоделируйте изменения.</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          className="icon-button"
          type="button"
          aria-label="Переключить тему"
          onClick={onToggleTheme}
        >
          {theme === "dark" ? <Moon size={17} /> : <Sun size={17} />}
        </button>

        <div className="topbar-popover-wrap">
          <button
            className="user-menu-button"
            type="button"
            onClick={() => {
              setIsUserMenuOpen((value) => !value);
              setIsNotificationsOpen(false);
            }}
          >
            <span className="user-avatar">
              <UserRound size={17} />
            </span>
            <span className="user-copy">
              <strong>Пользователь</strong>
              <span>Локальный профиль</span>
            </span>
            <ChevronDown size={15} />
          </button>

          {isUserMenuOpen && (
            <div className="popover user-popover">
              <div className="user-popover-header">
                <span className="user-avatar large">
                  <UserRound size={21} />
                </span>
                <div>
                  <strong>Пользователь</strong>
                  <span>Локальный профиль</span>
                </div>
              </div>
              <button type="button">
                <Settings size={16} />
                Настройки профиля
              </button>
              <button type="button">
                <ShieldCheck size={16} />
                Безопасность
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

function PageHeader({
  title,
  description,
  eyebrow,
  action,
}: {
  title: string;
  description: string;
  eyebrow?: string;
  action?: React.ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        {eyebrow && <span className="page-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="page-heading-action">{action}</div>}
    </section>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  accent = "default",
}: {
  label: string;
  value: string;
  helper?: string;
  icon: LucideIcon;
  accent?: "default" | "green" | "blue" | "orange";
}) {
  return (
    <article className={`metric-card accent-${accent}`}>
      <div className="metric-card-top">
        <span>{label}</span>
        <span className="metric-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value}</strong>
      {helper && <small>{helper}</small>}
    </article>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span className="empty-state-icon">
        <Icon size={25} />
      </span>
      <strong>{title}</strong>
      <span>{description}</span>
    </div>
  );
}

function Toast({ toast }: { toast: ToastState }) {
  const Icon =
    toast.kind === "success"
      ? Check
      : toast.kind === "error"
        ? X
        : Info;

  return (
    <div className={`toast toast-${toast.kind}`}>
      <span className="toast-icon">
        <Icon size={17} />
      </span>
      <span>{toast.message}</span>
    </div>
  );
}

function ConfirmDialog({
  product,
  isDeleting,
  onCancel,
  onConfirm,
}: {
  product: Product;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onCancel}>
      <section
        className="confirm-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <span className="confirm-icon">
          <Trash2 size={23} />
        </span>
        <h2 id="confirm-title">Удалить товар?</h2>
        <p>
          Товар <strong>{product.name}</strong> будет удалён из списка
          отслеживания. История останется в SQL Server. Товар можно снова добавить из каталога.
        </p>
        <div className="confirm-actions">
          <button className="button secondary" type="button" onClick={onCancel}>
            Отмена
          </button>
          <button
            className="button danger"
            type="button"
            disabled={isDeleting}
            onClick={onConfirm}
          >
            {isDeleting && <RefreshCcw className="spinning" size={16} />}
            Удалить
          </button>
        </div>
      </section>
    </div>
  );
}

function ProductsPage({
  products,
  isLoading,
  isAdding,
  onAdd,
  onRefresh,
  onOpen,
  onRequestDelete,
}: {
  products: Product[];
  isLoading: boolean;
  isAdding: boolean;
  onAdd: (value: string) => Promise<boolean>;
  onRefresh: () => Promise<void>;
  onOpen: (product: Product) => void;
  onRequestDelete: (product: Product) => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("updated");

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const result = normalizedQuery
      ? products.filter((product) =>
          [
            product.name,
            product.description,
            product.ozonProductId.toString(),
          ].some((value) => value.toLowerCase().includes(normalizedQuery)),
        )
      : [...products];

    result.sort((a, b) => {
      if (sortMode === "name") {
        return a.name.localeCompare(b.name, "ru");
      }

      if (sortMode === "price") {
        return b.price - a.price;
      }

      if (sortMode === "stocks") {
        return b.stocks - a.stocks;
      }

      return (
        new Date(b.lastUpdatedAt).getTime() -
        new Date(a.lastUpdatedAt).getTime()
      );
    });

    return result;
  }, [products, query, sortMode]);

  const lastUpdate = useMemo(() => {
    if (products.length === 0) {
      return null;
    }

    return products.reduce((latest, product) => {
      const timestamp = new Date(product.lastUpdatedAt).getTime();
      return timestamp > latest ? timestamp : latest;
    }, 0);
  }, [products]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = inputValue.trim();

    if (!value) {
      return;
    }

    const added = await onAdd(value);

    if (added) {
      setInputValue("");
    }
  }

  return (
    <main className="page products-page">
      <PageHeader
        eyebrow="Рабочая область"
        title="Мои товары"
        description="Добавляйте товары по ссылке или ID, отслеживайте изменения цен, остатков и других показателей."
        action={
          <button className="button secondary" type="button" onClick={onRefresh}>
            <RefreshCcw size={16} className={isLoading ? "spinning" : ""} />
            Обновить список
          </button>
        }
      />

      <DemoControls products={products} onAdd={onAdd} onRefresh={onRefresh} />

      <section className="add-product-panel">
        <div className="add-product-panel-copy">
          <span className="panel-kicker">Новый товар</span>
          <strong>Добавить в отслеживание</strong>
          <span>Введите ID из демокаталога (100000001–100000012) или ссылку с этим ID.</span>
        </div>

        <form className="add-product-form" onSubmit={handleSubmit}>
          <div className="input-shell">
            <Search size={17} />
            <input
              type="text"
              value={inputValue}
              onChange={(event) => setInputValue(event.target.value)}
              placeholder="Например: 123456789 или ссылка на товар"
              disabled={isAdding}
            />
          </div>
          <button className="button primary" type="submit" disabled={isAdding}>
            {isAdding ? (
              <RefreshCcw className="spinning" size={17} />
            ) : (
              <Plus size={18} />
            )}
            {isAdding ? "Добавление..." : "Добавить"}
          </button>
        </form>
      </section>

      <section className="products-card">
        <header className="products-card-header">
          <div>
            <strong>Добавленные товары</strong>
            <span>{products.length} в отслеживании</span>
          </div>

          <div className="table-tools">
            <label className="search-control">
              <Search size={16} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск по товарам"
              />
            </label>

            <label className="select-control">
              <SlidersHorizontal size={15} />
              <select
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
              >
                <option value="updated">Сначала обновлённые</option>
                <option value="name">По названию</option>
                <option value="price">По цене</option>
                <option value="stocks">По остаткам</option>
              </select>
            </label>
          </div>
        </header>

        <div className="table-scroll">
          <table className="products-table">
            <thead>
              <tr>
                <th>ID товара</th>
                <th>Название</th>
                <th>Информация</th>
                <th>Цена</th>
                <th>Цена по Ozon карте</th>
                <th>Остатки</th>
                <th>Последнее обновление</th>
                <th aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="table-state-cell">
                    <div className="table-loading">
                      <RefreshCcw className="spinning" size={22} />
                      <span>Загружаем товары...</span>
                    </div>
                  </td>
                </tr>
              )}

              {!isLoading && products.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-state-cell">
                    <EmptyState
                      icon={Package}
                      title="Список пока пуст"
                      description="Добавьте первый товар по ссылке или ID в форме выше."
                    />
                  </td>
                </tr>
              )}

              {!isLoading && products.length > 0 && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={8} className="table-state-cell">
                    <EmptyState
                      icon={Search}
                      title="Ничего не найдено"
                      description="Измените поисковый запрос или сбросьте фильтр."
                    />
                  </td>
                </tr>
              )}

              {!isLoading &&
                filteredProducts.map((product) => (
                  <tr
                    key={product.id}
                    className="product-row"
                    onClick={() => onOpen(product)}
                  >
                    <td>
                      <div className="product-id-cell">
                        <span className="product-thumbnail">
                          {product.imageUrl ? (
                            <img src={product.imageUrl} alt="" />
                          ) : (
                            <Package size={20} />
                          )}
                        </span>
                        <span>{product.ozonProductId}</span>
                      </div>
                    </td>
                    <td>
                      <strong className="product-name">{product.name}</strong>
                      <span className="secondary-text">{product.description}</span>
                    </td>
                    <td>
                      <span className="tag neutral">SQL Server · Демо</span>
                    </td>
                    <td>{formatMoney(product.price)}</td>
                    <td className="ozon-price">{formatMoney(product.ozonCardPrice)}</td>
                    <td>
                      <span className={`stock-pill ${product.stocks > 0 ? "in-stock" : "empty"}`}>
                        {product.stocks} шт.
                      </span>
                    </td>
                    <td>
                      <span className="date-cell">{formatDate(product.lastUpdatedAt)}</span>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="row-action-button danger"
                          type="button"
                          aria-label={`Удалить ${product.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onRequestDelete(product);
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                        <button
                          className="row-action-button"
                          type="button"
                          aria-label={`Открыть ${product.name}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpen(product);
                          }}
                        >
                          <ChevronRight size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <footer className="products-card-footer">
          <span>
            Показано: <strong>{filteredProducts.length}</strong> из {products.length}
          </span>
          <span>
            Последнее обновление: {lastUpdate ? dateFormatter.format(lastUpdate) : "—"}
          </span>
        </footer>
      </section>
    </main>
  );
}

function ProductDetailsPage({
  product,
  onBack,
  onCopyId,
  onRequestDelete,
}: {
  product: Product;
  onBack: () => void;
  onCopyId: (product: Product) => void;
  onRequestDelete: (product: Product) => void;
}) {
  const [tab, setTab] = useState<DetailTab>("overview");

  const tabs: Array<{ id: DetailTab; label: string }> = [
    { id: "overview", label: "Обзор" },
    { id: "statistics", label: "Статистика" },
    { id: "prices", label: "Изменения цен" },
    { id: "stocks", label: "Остатки" },
    { id: "sales", label: "Продажи" },
    { id: "reviews", label: "Отзывы" },
  ];

  function renderTabContent() {
    if (tab !== "overview") {
      return <section className="dashboard-panel details-single-panel">
        <h2>{tabs.find(item => item.id === tab)?.label}</h2>
        {tab === "reviews" && <p>Демонстрационный рейтинг: {product.rating.toFixed(1)} из 5.
          Отзывов: {product.reviewCount}. В БД хранится статистика отзывов; тексты отзывов не моделируются.</p>}
        {tab === "sales" && <p>Продано всего: {product.soldUnits} шт. Счётчик накопительный; все продажи вымышлены.</p>}
        {tab === "stocks" && <p>Сейчас в наличии: {product.stocks} шт. История включает поступления и уменьшение остатков.</p>}
        {(tab === "prices" || tab === "statistics") && <PriceChart history={product.history} />}
        <SnapshotTable product={product} />
      </section>;
    }

    return (
      <>
        <section className="metric-grid product-metrics">
          <MetricCard label="Текущая цена" value={formatMoney(product.price)} icon={TrendingUp} accent="blue" />
          <MetricCard label="Цена по Ozon карте" value={formatMoney(product.ozonCardPrice)} icon={Sparkles} accent="green" />
          <MetricCard label="Остатки" value={`${product.stocks} шт.`} icon={Box} accent="orange" />
          <MetricCard label="Рейтинг товара" value={product.rating.toFixed(1)} icon={Activity} />
          <MetricCard label="Количество отзывов" value={product.reviewCount.toString()} icon={Clipboard} />
          <MetricCard label="Продано всего" value={`${product.soldUnits} шт.`} icon={Check} />
        </section>

        <section className="details-grid">
          <article className="dashboard-panel chart-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">Цена</span>
                <h2>Динамика цен</h2>
              </div>
              <span className="tag neutral">Последние 60 срезов</span>
            </div>

            <PriceChart history={product.history} />
          </article>

          <article className="dashboard-panel changes-panel">
            <div className="panel-header">
              <div>
                <span className="panel-kicker">События</span>
                <h2>Последние изменения</h2>
              </div>
            </div>

            <div className="timeline">
              {product.history.slice(-5).reverse().map(point => <div className="timeline-item" key={point.id}>
                <span className="timeline-icon blue"><History size={15} /></span>
                <div><strong>{formatMoney(point.price)} · {point.stocks} шт.</strong>
                  <span>{formatDate(point.capturedAt)} · Продано всего: {point.soldUnits}</span></div>
              </div>)}
            </div>
          </article>
        </section>
      </>
    );
  }

  return (
    <main className="page details-page">
      <button className="back-button" type="button" onClick={onBack}>
        <ChevronLeft size={17} />
        Назад к списку товаров
      </button>

      <section className="product-hero">
        <div className="product-hero-main">
          <span className="details-image">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.name} />
            ) : (
              <Package size={37} />
            )}
          </span>

          <div className="product-hero-copy">
            <span className="page-eyebrow">Карточка товара</span>
            <h1>{product.name}</h1>
            <p>{product.description}</p>
            <div className="product-hero-tags">
              <button className="copy-id-button" type="button" onClick={() => onCopyId(product)}>
                ID: {product.ozonProductId}
                <Copy size={14} />
              </button>
              <span className="tag success">Отслеживается</span>
            </div>
          </div>
        </div>

        <div className="product-summary-card">
          <div>
            <span>Дата добавления</span>
            <strong>{formatDate(product.addedAt)}</strong>
          </div>
          <div>
            <span>Последнее обновление</span>
            <strong>{formatDate(product.lastUpdatedAt)}</strong>
          </div>
          <div className="product-summary-actions">
            <button className="button secondary" type="button" onClick={() => onCopyId(product)}>
              <Copy size={15} />
              Копировать ID
            </button>
            <button className="button icon-danger" type="button" onClick={() => onRequestDelete(product)} aria-label="Удалить товар">
              <Trash2 size={16} />
            </button>
          </div>
        </div>
      </section>

      <nav className="details-tabs" aria-label="Разделы товара">
        {tabs.map((item) => (
          <button
            key={item.id}
            className={tab === item.id ? "active" : ""}
            type="button"
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {renderTabContent()}
    </main>
  );
}

function StatisticsPage({ products }: { products: Product[] }) {
  const totals = useMemo(() => {
    const totalStock = products.reduce((sum, product) => sum + product.stocks, 0);
    const totalPrice = products.reduce((sum, product) => sum + product.price, 0);
    const averagePrice = products.length > 0 ? totalPrice / products.length : 0;
    const withStock = products.filter((product) => product.stocks > 0).length;

    return { totalStock, averagePrice, withStock };
  }, [products]);

  const bars = products.slice(0, 8).map((product) => ({
    label: product.ozonProductId.toString().slice(-4),
    value: product.price,
  }));
  const maxValue = Math.max(...bars.map((bar) => bar.value), 1);

  return (
    <main className="page">
      <PageHeader
        eyebrow="Аналитика"
        title="Статистика"
        description="Сводные показатели по всем товарам, добавленным в отслеживание."
      />

      <section className="metric-grid summary-metrics">
        <MetricCard label="Всего товаров" value={products.length.toString()} icon={Package} accent="blue" />
        <MetricCard label="Суммарный остаток" value={`${totals.totalStock} шт.`} icon={Box} accent="orange" />
        <MetricCard label="Средняя цена" value={formatMoney(totals.averagePrice)} icon={TrendingUp} accent="green" />
        <MetricCard label="Есть в наличии" value={`${totals.withStock} из ${products.length}`} icon={Check} />
      </section>

      <section className="analytics-grid">
        <article className="dashboard-panel analytics-main-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Сравнение</span>
              <h2>Цены по товарам</h2>
            </div>
            <span className="tag neutral">Текущий срез</span>
          </div>

          {bars.length === 0 ? (
            <EmptyState icon={BarChart3} title="Недостаточно данных" description="Добавьте товары, чтобы увидеть сравнение цен." />
          ) : (
            <div className="bar-chart">
              {bars.map((bar) => (
                <div className="bar-column" key={bar.label}>
                  <span className="bar-value">{formatCompactMoney(bar.value)}</span>
                  <div className="bar-track">
                    <span style={{ height: `${Math.max((bar.value / maxValue) * 100, 4)}%` }} />
                  </div>
                  <span className="bar-label">…{bar.label}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article className="dashboard-panel health-panel">
          <div className="panel-header">
            <div>
              <span className="panel-kicker">Система</span>
              <h2>Состояние данных</h2>
            </div>
          </div>

          <div className="health-list">
            <div>
              <span>Backend</span>
              <strong>ASP.NET Core 10</strong>
            </div>
            <div>
              <span>Хранилище</span>
              <strong>SQL Server</strong>
            </div>
            <div>
              <span>Изменения данных</span>
              <strong>Кнопка моделирования</strong>
            </div>
            <div>
              <span>Источник данных</span>
              <strong>Демонстрационная БД</strong>
            </div>
          </div>
        </article>
      </section>
    </main>
  );
}

function HistoryPage({ products }: { products: Product[] }) {
  const events = useMemo(
    () =>
      products
        .flatMap((product) => product.history.map((point, index) => {
          const previous = product.history[index - 1];
          return {
            key: `${product.id}-${point.id}`,
            timestamp: point.capturedAt,
            title: previous
              ? `Цена: ${formatMoney(previous.price)} → ${formatMoney(point.price)} · Остаток: ${previous.stocks} → ${point.stocks}`
              : "Первый срез товара",
            description: `${product.name} · Продано: ${point.soldUnits} · Отзывов: ${point.reviewCount}`,
            icon: previous ? RefreshCcw : Plus,
            tone: previous ? "green" : "blue",
          };
        }))
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
    [products],
  );

  return (
    <main className="page">
      <PageHeader
        eyebrow="Журнал"
        title="История изменений"
        description="Сохранённые срезы из SQL Server: цены, остатки, продажи и отзывы. Все данные демонстрационные."
      />

      <section className="history-card">
        {events.length === 0 ? (
          <EmptyState icon={History} title="История пока пуста" description="Добавьте товар, чтобы появились первые события." />
        ) : (
          <div className="history-list">
            {events.map((event) => {
              const Icon = event.icon;
              return (
                <article className="history-event" key={event.key}>
                  <span className={`history-event-icon ${event.tone}`}>
                    <Icon size={16} />
                  </span>
                  <div>
                    <strong>{event.title}</strong>
                    <span>{event.description}</span>
                  </div>
                  <time>{formatDate(event.timestamp)}</time>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}

function SettingsPage({
  refreshMinutes,
  onSave,
}: {
  refreshMinutes: number;
  onSave: (refreshMinutes: number) => void;
}) {
  const [intervalValue, setIntervalValue] = useState(refreshMinutes.toString());
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [compactTable, setCompactTable] = useState(false);

  function handleSave() {
    const parsed = Number(intervalValue);
    const safeValue = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 5), 1440) : 60;
    setIntervalValue(safeValue.toString());
    onSave(safeValue);
  }

  return (
    <main className="page">
      <PageHeader
        eyebrow="Конфигурация"
        title="Настройки"
        description="Параметры обновления и поведения интерфейса."
      />

      <section className="settings-grid">
        <article className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><Clock3 size={19} /></span>
            <div>
              <strong>Интервал обновления</strong>
              <span>Как часто интерфейс перечитывает данные из БД. Демоизменения запускаются кнопкой на главной.</span>
            </div>
          </div>

          <label className="field-label">
            <span>Интервал в минутах</span>
            <input
              type="number"
              min="5"
              max="1440"
              value={intervalValue}
              onChange={(event) => setIntervalValue(event.target.value)}
            />
          </label>
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><Bell size={19} /></span>
            <div>
              <strong>Уведомления</strong>
              <span>Показывать сообщения о важных изменениях.</span>
            </div>
          </div>

          <label className="toggle-row">
            <div>
              <strong>Изменение цены</strong>
              <span>Сообщать, когда цена товара изменилась.</span>
            </div>
            <input
              type="checkbox"
              checked={notificationsEnabled}
              onChange={(event) => setNotificationsEnabled(event.target.checked)}
            />
            <span className="toggle-control" />
          </label>
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span className="settings-icon"><SlidersHorizontal size={19} /></span>
            <div>
              <strong>Отображение</strong>
              <span>Параметры плотности интерфейса.</span>
            </div>
          </div>

          <label className="toggle-row">
            <div>
              <strong>Компактная таблица</strong>
              <span>Уменьшить высоту строк списка товаров.</span>
            </div>
            <input
              type="checkbox"
              checked={compactTable}
              onChange={(event) => setCompactTable(event.target.checked)}
            />
            <span className="toggle-control" />
          </label>
        </article>
      </section>

      <div className="settings-actions">
        <button className="button primary" type="button" onClick={handleSave}>
          <Save size={17} />
          Сохранить настройки
        </button>
      </div>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="page">
      <PageHeader
        eyebrow="OZON Tracker"
        title="О сервисе"
        description="Локальный инструмент для накопления истории товара и дальнейшего построения аналитики."
      />

      <section className="about-hero">
        <div>
          <span className="about-logo"><Sparkles size={28} /></span>
          <h2>Панель мониторинга товаров Ozon</h2>
          <p>
            Демонстрационная версия хранит товары и историю в SQL Server, добавляет их по
            ссылке или ID из каталога, показывает карточки и сохраняет историю изменений.
          </p>
        </div>
        <span className="version-badge">SQL Server Demo · 1.0</span>
      </section>

      <section className="about-grid">
        <article className="feature-card">
          <Database size={21} />
          <strong>SQL Server</strong>
          <span>Каталог и срезы за 30 дней, сохранение изменений между запусками.</span>
        </article>
        <article className="feature-card">
          <Activity size={21} />
          <strong>Аналитика из БД</strong>
          <span>Цена, остатки, продажи, отзывы и история изменений.</span>
        </article>
        <article className="feature-card">
          <ShieldCheck size={21} />
          <strong>ASP.NET API</strong>
          <span>Контроллеры, параметризованные SQL-запросы и управляемая демонстрация.</span>
        </article>
      </section>

      <section className="roadmap-card">
        <div className="panel-header">
          <div>
            <span className="panel-kicker">Демонстрация</span>
            <h2>Возможности проекта</h2>
          </div>
        </div>
        <div className="roadmap-list">
          <div className="roadmap-item done"><Check size={16} /><span>Backend и SQL Server</span></div>
          <div className="roadmap-item done"><Check size={16} /><span>React-интерфейс и навигация</span></div>
          <div className="roadmap-item done"><Activity size={16} /><span>SQL Server и демонстрационные срезы</span></div>
          <div className="roadmap-item done"><Check size={16} /><span>Перечитывание БД по таймеру</span></div>
          <div className="roadmap-item done"><Check size={16} /><span>История изменений и графики из БД</span></div>
        </div>
      </section>
    </main>
  );
}

export default function App() {
  const [page, setPage] = useState<AppPage>("products");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [refreshMinutes, setRefreshMinutes] = useState(() => {
    const stored = Number(localStorage.getItem("ozon-refresh-minutes"));
    return Number.isFinite(stored) && stored >= 5 ? stored : 60;
  });

  const showToast = useCallback((kind: ToastKind, message: string) => {
    setToast({ id: Date.now(), kind, message });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("ozon-tracker-theme", theme);
  }, [theme]);

  const loadProducts = useCallback(async () => {
    setIsLoading(true);

    try {
      const result = await getProducts();
      setApiError(null);
      setProducts(result);
      setSelectedProduct((current) =>
        current
          ? result.find((product) => product.id === current.id) ?? null
          : null,
      );
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Не удалось загрузить товары.");
      showToast(
        "error",
        error instanceof Error ? error.message : "Не удалось загрузить товары.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const timer = window.setInterval(() => void loadProducts(), refreshMinutes * 60_000);
    return () => window.clearInterval(timer);
  }, [loadProducts, refreshMinutes]);

  async function handleAddProduct(value: string): Promise<boolean> {
    setIsAdding(true);

    try {
      const created = await addProduct(value);
      setProducts((current) => [created, ...current]);
      showToast("success", "Товар добавлен в отслеживание.");
      return true;
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Не удалось добавить товар.",
      );
      return false;
    } finally {
      setIsAdding(false);
    }
  }

  async function handleDeleteProduct() {
    if (!productToDelete) {
      return;
    }

    setIsDeleting(true);

    try {
      await deleteProduct(productToDelete.ozonProductId);
      setProducts((current) =>
        current.filter((product) => product.id !== productToDelete.id),
      );

      if (selectedProduct?.id === productToDelete.id) {
        setSelectedProduct(null);
        setPage("products");
      }

      setProductToDelete(null);
      showToast("success", "Товар удалён из отслеживания.");
    } catch (error) {
      showToast(
        "error",
        error instanceof Error ? error.message : "Не удалось удалить товар.",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleCopyProductId(product: Product) {
    try {
      await navigator.clipboard.writeText(product.ozonProductId.toString());
      showToast("success", "ID товара скопирован.");
    } catch {
      showToast("error", "Браузер не разрешил скопировать ID.");
    }
  }

  function handleNavigate(nextPage: AppPage) {
    setSelectedProduct(null);
    setPage(nextPage);
  }

  function renderPage() {
    if (selectedProduct) {
      return (
        <ProductDetailsPage
          product={selectedProduct}
          onBack={() => setSelectedProduct(null)}
          onCopyId={handleCopyProductId}
          onRequestDelete={setProductToDelete}
        />
      );
    }

    switch (page) {
      case "statistics":
        return <StatisticsPage products={products} />;
      case "history":
        return <HistoryPage products={products} />;
      case "settings":
        return (
          <SettingsPage
            refreshMinutes={refreshMinutes}
            onSave={(value) => {
              setRefreshMinutes(value);
              localStorage.setItem("ozon-refresh-minutes", value.toString());
              showToast("success", "Настройки сохранены.");
            }}
          />
        );
      case "about":
        return <AboutPage />;
      default:
        return (
          <ProductsPage
            products={products}
            isLoading={isLoading}
            isAdding={isAdding}
            onAdd={handleAddProduct}
            onRefresh={loadProducts}
            onOpen={(product) => setSelectedProduct(product)}
            onRequestDelete={setProductToDelete}
          />
        );
    }
  }

  return (
    <div className="app-shell">
      <Sidebar
        page={page}
        refreshMinutes={refreshMinutes}
        onNavigate={handleNavigate}
        apiError={apiError}
      />

      <div className="content-column">
        <Topbar
          theme={theme}
          onToggleTheme={() =>
            setTheme((current) => (current === "dark" ? "light" : "dark"))
          }
        />
        {apiError && <div className="database-error" role="alert">{apiError}</div>}
        {renderPage()}
      </div>

      {toast && <Toast key={toast.id} toast={toast} />}

      {productToDelete && (
        <ConfirmDialog
          product={productToDelete}
          isDeleting={isDeleting}
          onCancel={() => setProductToDelete(null)}
          onConfirm={handleDeleteProduct}
        />
      )}
    </div>
  );
}
