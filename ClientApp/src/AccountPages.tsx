import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  Camera,
  Check,
  Crown,
  Download,
  LockKeyhole,
  Mail,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import type { ChatMessage, DemoProfile, Subscription } from "./models/Profile";
import {
  avatarAddress,
  changeSubscription,
  clearChat,
  exportProducts,
  getChat,
  linkEmail,
  removeAvatar,
  saveProfile,
  sendChat,
  unlinkEmail,
  uploadAvatar,
} from "./api/profileApi";
import "./AccountPages.css";

const errorText = (error: unknown) =>
  error instanceof Error ? error.message : "Не удалось выполнить операцию.";

export function ProfileAvatar({
  profile,
  large = false,
}: {
  profile: DemoProfile | null;
  large?: boolean;
}) {
  return (
    <span className={`account-avatar ${large ? "account-avatar-large" : ""}`}>
      {profile?.avatarUrl ? (
        <img src={avatarAddress(profile.avatarUrl)} alt="Аватар профиля" />
      ) : (
        <UserRound size={large ? 44 : 19} />
      )}
    </span>
  );
}

function AccountHeading({ title, text }: { title: string; text: string }) {
  return (
    <section className="page-heading">
      <div>
        <span className="page-eyebrow">Личный кабинет · Демо</span>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
    </section>
  );
}

export function ProfilePage({
  profile,
  onUpdated,
  onSubscriptions,
}: {
  profile: DemoProfile;
  onUpdated: (profile: DemoProfile) => void;
  onSubscriptions: () => void;
}) {
  const [draft, setDraft] = useState({
    displayName: profile.displayName,
    fullName: profile.fullName,
    phone: profile.phone,
    about: profile.about,
  });
  const [email, setEmail] = useState(profile.email ?? "");
  const [avatar, setAvatar] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!avatar) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(avatar);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  async function update(
    operation: () => Promise<DemoProfile>,
    success: string,
  ) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await operation();
      onUpdated(result);
      setMessage(success);
      return true;
    } catch (error) {
      setError(errorText(error));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function chooseAvatar(file?: File) {
    if (!file) return;
    setError("");
    setMessage("");
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Выберите PNG, JPEG или WebP размером до 5 МБ.");
      return;
    }
    setBusy(true);
    try {
      const image = await createImageBitmap(file);
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Не удалось обработать изображение.");
      const side = Math.min(image.width, image.height);
      context.drawImage(
        image,
        (image.width - side) / 2,
        (image.height - side) / 2,
        side,
        side,
        0,
        0,
        256,
        256,
      );
      image.close();
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!blob) throw new Error("Не удалось обработать изображение.");
      setAvatar(blob);
    } catch {
      setError("Не удалось открыть изображение. Попробуйте другой файл.");
    } finally {
      setBusy(false);
    }
  }

  async function submitProfile(event: FormEvent) {
    event.preventDefault();
    if (await update(() => saveProfile(draft), "Данные профиля сохранены."))
      setDraft((current) => ({
        displayName: current.displayName.trim(),
        fullName: current.fullName.trim(),
        phone: current.phone.trim(),
        about: current.about.trim(),
      }));
  }

  return (
    <main className="page account-page">
      <AccountHeading
        title="Мой профиль"
        text="Расскажите о себе и выберите аватарку. Изменения сохраняются в базе данных."
      />
      {error && (
        <div className="account-feedback error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="account-feedback success" role="status">
          {message}
        </div>
      )}
      <div className="profile-layout">
        <aside className="settings-card profile-summary">
          <div className="avatar-preview">
            {preview ? (
              <img src={preview} alt="Предпросмотр аватара" />
            ) : (
              <ProfileAvatar profile={profile} large />
            )}
          </div>
          <h2>{profile.displayName}</h2>
          <span className="tag success">
            {profile.subscription === "Basic"
              ? "Free · Basic"
              : profile.subscription}
          </span>
          <p>Личный аккаунт</p>
          <label
            className={`button secondary avatar-picker ${busy ? "disabled" : ""}`}
          >
            <Camera size={16} /> Выбрать аватар
            <input
              aria-label="Выбрать аватар"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={busy}
              onChange={(event) => {
                void chooseAvatar(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <small>
            PNG, JPEG, WebP · до 5 МБ. Фото будет обрезано до квадрата.
          </small>
          {avatar && (
            <button
              className="button primary"
              disabled={busy}
              onClick={async () => {
                if (
                  await update(() => uploadAvatar(avatar), "Аватар сохранён.")
                )
                  setAvatar(null);
              }}
            >
              Сохранить аватар
            </button>
          )}
          {(profile.avatarUrl || avatar) && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={async () => {
                if (
                  !profile.avatarUrl ||
                  (await update(removeAvatar, "Аватар удалён."))
                )
                  setAvatar(null);
              }}
            >
              <Trash2 size={15} /> Удалить аватар
            </button>
          )}
          <button className="button secondary" onClick={onSubscriptions}>
            <Crown size={16} /> Управление подпиской
          </button>
        </aside>
        <div className="profile-forms">
          <form
            className="settings-card"
            onSubmit={(event) => void submitProfile(event)}
          >
            <h2>Личные данные</h2>
            <fieldset className="account-fields" disabled={busy}>
              <label>
                Имя в интерфейсе
                <input
                  required
                  minLength={2}
                  maxLength={60}
                  value={draft.displayName}
                  onChange={(event) =>
                    setDraft({ ...draft, displayName: event.target.value })
                  }
                  autoComplete="nickname"
                />
              </label>
              <label>
                ФИО
                <input
                  maxLength={200}
                  value={draft.fullName}
                  onChange={(event) =>
                    setDraft({ ...draft, fullName: event.target.value })
                  }
                  autoComplete="name"
                  placeholder="Фамилия Имя Отчество"
                />
              </label>
              <label>
                Номер телефона
                <input
                  type="tel"
                  maxLength={25}
                  value={draft.phone}
                  onChange={(event) =>
                    setDraft({ ...draft, phone: event.target.value })
                  }
                  autoComplete="tel"
                  placeholder="+7 (999) 123-45-67"
                />
              </label>
              <label className="account-field-wide">
                О себе
                <textarea
                  aria-label="О себе"
                  maxLength={1000}
                  rows={4}
                  value={draft.about}
                  onChange={(event) =>
                    setDraft({ ...draft, about: event.target.value })
                  }
                  placeholder="Чем занимаетесь и какие товары отслеживаете"
                />
              </label>
            </fieldset>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? "Подождите…" : "Сохранить профиль"}
            </button>
          </form>
          <section className="settings-card email-card">
            <p>
              Почта для входа: <strong>{profile.loginEmail}</strong>. Привязка
              ниже не меняет адрес для входа.
            </p>
            <div className="account-section-heading">
              <Mail size={20} />
              <h2>Контактная почта · демо</h2>
            </div>
            <p>
              {profile.email ? (
                <>
                  Привязана: <strong>{profile.email}</strong> · демо
                </>
              ) : (
                "Почта пока не привязана."
              )}
            </p>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void update(
                  () => linkEmail(email.trim()),
                  "Почта привязана в деморежиме. Письмо не отправляется.",
                );
              }}
            >
              <label className="account-input-label">
                Адрес электронной почты
                <input
                  type="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  disabled={busy}
                  autoComplete="email"
                />
              </label>
              <div className="account-actions">
                <button
                  className="button secondary"
                  disabled={busy}
                  type="submit"
                >
                  {profile.email
                    ? "Изменить почту (демо)"
                    : "Привязать почту (демо)"}
                </button>
                {profile.email && (
                  <button
                    type="button"
                    className="button secondary"
                    disabled={busy}
                    onClick={async () => {
                      if (await update(unlinkEmail, "Почта отвязана."))
                        setEmail("");
                    }}
                  >
                    Отвязать почту
                  </button>
                )}
              </div>
            </form>
            <small>
              Привязка демонстрационная: письма и коды подтверждения не
              отправляются.
            </small>
          </section>
        </div>
      </div>
    </main>
  );
}

const plans: {
  id: Subscription;
  name: string;
  caption: string;
  features: string[];
}[] = [
  {
    id: "Basic",
    name: "Free · Basic",
    caption: "Всё для начала работы",
    features: [
      "Отслеживание товаров",
      "Графики цен и история",
      "Профиль и аватарка",
    ],
  },
  {
    id: "Plus",
    name: "Plus",
    caption: "Данные под рукой",
    features: [
      "Все возможности Basic",
      "Экспорт товаров в CSV для Excel",
      "Статус Plus в профиле",
    ],
  },
  {
    id: "Pro",
    name: "Pro",
    caption: "Ваш помощник по товарам",
    features: [
      "Все возможности Plus",
      "Чат с демоассистентом",
      "Сводки по ценам, остаткам и продажам",
    ],
  },
];

export function SubscriptionsPage({
  profile,
  onUpdated,
  onChat,
}: {
  profile: DemoProfile;
  onUpdated: (profile: DemoProfile) => void;
  onChat: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function select(plan: Subscription) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      onUpdated(await changeSubscription(plan));
      setMessage(
        `Выбран тариф ${plan === "Basic" ? "Free · Basic" : plan}. Это демоподписка, списаний нет.`,
      );
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function download() {
    setBusy(true);
    setError("");
    try {
      await exportProducts();
      setMessage("CSV-файл подготовлен для скачивания.");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page account-page">
      <AccountHeading
        title="Подписки"
        text="Выберите возможности для демонстрации. Тариф можно менять свободно, без оплаты и банковской карты."
      />
      {error && (
        <div className="account-feedback error" role="alert">
          {error}
        </div>
      )}
      {message && (
        <div className="account-feedback success" role="status">
          {message}
        </div>
      )}
      <section className="plans-grid">
        {plans.map((plan) => (
          <article
            className={`plan-card ${profile.subscription === plan.id ? "selected" : ""} ${plan.id === "Pro" ? "pro" : ""}`}
            key={plan.id}
          >
            <span className="plan-icon">
              {plan.id === "Pro" ? (
                <Crown size={25} />
              ) : plan.id === "Plus" ? (
                <Sparkles size={25} />
              ) : (
                <ShieldCheck size={25} />
              )}
            </span>
            <h2>{plan.name}</h2>
            <p>{plan.caption}</p>
            <span className="tag neutral">
              {plan.id === "Basic"
                ? "Бесплатный тариф"
                : "Демонстрационный тариф"}
            </span>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={16} />
                  {feature}
                </li>
              ))}
            </ul>
            <button
              className={`button ${profile.subscription === plan.id ? "secondary" : "primary"}`}
              disabled={busy || profile.subscription === plan.id}
              onClick={() => void select(plan.id)}
            >
              {profile.subscription === plan.id
                ? "Текущий тариф"
                : `Выбрать ${plan.name}`}
            </button>
          </article>
        ))}
      </section>
      <section className="settings-card subscription-tools">
        <div>
          <h2>Возможности вашей подписки</h2>
          <p>
            Переход на Basic закроет доступ к экспорту и чату. История чата
            сохранится до возвращения на Pro или её удаления.
          </p>
        </div>
        <div className="account-actions">
          <button
            className="button secondary"
            disabled={busy || profile.subscription === "Basic"}
            onClick={() => void download()}
          >
            <Download size={16} /> Скачать товары CSV
          </button>
          <button className="button primary" onClick={onChat}>
            <MessageCircle size={16} />{" "}
            {profile.subscription === "Pro"
              ? "Открыть чат"
              : "Посмотреть демочат Pro"}
          </button>
        </div>
      </section>
    </main>
  );
}

export function ChatPage({
  profile,
  onSubscriptions,
}: {
  profile: DemoProfile;
  onSubscriptions: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (profile.subscription !== "Pro") return;
    let active = true;
    setLoading(true);
    getChat()
      .then((result) => {
        if (active) setMessages(result);
      })
      .catch((error) => {
        if (active) setError(errorText(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [profile.subscription]);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [messages]);

  async function send(text = input) {
    if (!text.trim() || busy || loading) return;
    setBusy(true);
    setError("");
    try {
      setMessages(await sendChat(text.trim()));
      setInput("");
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  async function clear() {
    setBusy(true);
    setError("");
    try {
      await clearChat();
      setMessages([]);
      setConfirmClear(false);
    } catch (error) {
      setError(errorText(error));
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page account-page">
      <AccountHeading
        title="Демоассистент"
        text="Имитация ИИ: готовые ответы по вашим товарам из SQL Server. Без внешней нейросети и обращения к Ozon."
      />
      {profile.subscription !== "Pro" ? (
        <section className="settings-card chat-locked">
          <LockKeyhole size={44} />
          <span className="tag neutral">Только Pro</span>
          <h2>Ваш помощник по товарам</h2>
          <p>
            Узнайте, что подешевело, проверьте остатки и получите сводку.
            Выберите Pro, чтобы открыть демочат.
          </p>
          <button className="button primary" onClick={onSubscriptions}>
            Выбрать Pro
          </button>
        </section>
      ) : (
        <section className="settings-card chat-panel">
          <header className="chat-header">
            <div>
              <Sparkles size={22} />
              <strong>Ozon Assistant</strong>
              <span className="tag success">Pro · Демо</span>
            </div>
            <button
              className="button secondary"
              disabled={busy || !messages.length}
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={15} /> Очистить историю
            </button>
          </header>
          {error && (
            <div className="account-feedback error" role="alert">
              {error}
            </div>
          )}
          {confirmClear && (
            <div className="account-feedback" role="alert">
              <span>Удалить всю историю чата?</span>
              <div className="account-actions">
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => void clear()}
                >
                  Удалить историю
                </button>
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={() => setConfirmClear(false)}
                >
                  Отмена
                </button>
              </div>
            </div>
          )}
          <div
            className="chat-log"
            role="log"
            aria-label="История чата"
            aria-live="polite"
          >
            {loading ? (
              <p>Загрузка истории…</p>
            ) : (
              !messages.length && (
                <div className="chat-welcome">
                  <Sparkles size={36} />
                  <h2>Что посмотрим сегодня?</h2>
                  <p>
                    Спросите о ценах, остатках или продажах. Ответы основаны на
                    демонстрационных данных вашего списка.
                  </p>
                </div>
              )
            )}
            {messages.map((message) => (
              <article
                className={`chat-message ${message.role}`}
                key={message.id}
              >
                <header>
                  <strong>
                    {message.role === "user"
                      ? profile.displayName
                      : "Демоассистент"}
                  </strong>
                  <time>
                    {new Date(message.createdAt).toLocaleTimeString("ru-RU", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                </header>
                <p>{message.text}</p>
              </article>
            ))}
            {busy && <p role="status">Обрабатываем запрос…</p>}
            <div ref={end} />
          </div>
          <div className="chat-suggestions">
            {[
              "Покажи сводку",
              "Какие товары подешевели?",
              "Что с остатками?",
            ].map((text) => (
              <button
                key={text}
                disabled={busy || loading}
                onClick={() => void send(text)}
              >
                {text}
              </button>
            ))}
          </div>
          <form
            className="chat-composer"
            onSubmit={(event) => {
              event.preventDefault();
              void send();
            }}
          >
            <label className="visually-hidden" htmlFor="chat-input">
              Сообщение ассистенту
            </label>
            <textarea
              id="chat-input"
              maxLength={1000}
              rows={2}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Спросите о ваших товарах…"
              disabled={busy || loading}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  !event.nativeEvent.isComposing
                ) {
                  event.preventDefault();
                  void send();
                }
              }}
            />
            <button
              className="button primary"
              disabled={busy || loading || !input.trim()}
              type="submit"
            >
              <Send size={17} /> Отправить
            </button>
          </form>
          <small>
            Демоассистент отвечает по шаблонам. Здесь нет прогнозов или
            рекомендаций реальной нейросети. Показываются последние 100
            сообщений.
          </small>
        </section>
      )}
    </main>
  );
}
