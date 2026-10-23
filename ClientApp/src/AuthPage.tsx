import { useState, type FormEvent } from "react";
import { LockKeyhole, Sparkles, TrendingDown, Bell } from "lucide-react";
import { authRequest, type Account } from "./api/authApi";
import "./Tracking.css";
export function AuthPage({
  onAuthenticated,
}: {
  onAuthenticated: (account: Account) => void;
}) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      onAuthenticated(
        await authRequest(register ? "register" : "login", {
          email: email.trim(),
          password,
          ...(register ? { displayName: name.trim() } : {}),
        }),
      );
    } catch (error) {
      setError(error instanceof Error ? error.message : "Не удалось войти.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <span className="auth-brand">
          <Sparkles /> OZON Tracker
        </span>
        <h1>
          Следите за ценой.
          <br />
          <em>Выбирайте момент.</em>
        </h1>
        <p>Ваши товары, история цен и уведомления — в одном личном кабинете.</p>
        <div className="auth-feature">
          <TrendingDown /> Графики с выбором показателей и сравнением периодов
        </div>
        <div className="auth-feature">
          <Bell /> Уведомления о достижении целевой цены
        </div>
        <small>
          Учебный проект. Товары и рыночные показатели демонстрационные.
        </small>
      </section>
      <section className="auth-card">
        <LockKeyhole size={28} />
        <h2>{register ? "Создать аккаунт" : "С возвращением"}</h2>
        <p>
          {register
            ? "У каждого пользователя свой список товаров и профиль."
            : "Войдите, чтобы продолжить отслеживание."}
        </p>
        <div className="segmented">
          <button
            className={!register ? "active" : ""}
            onClick={() => {
              setRegister(false);
              setError("");
            }}
          >
            Вход
          </button>
          <button
            className={register ? "active" : ""}
            onClick={() => {
              setRegister(true);
              setError("");
            }}
          >
            Регистрация
          </button>
        </div>
        {error && (
          <div role="alert" className="account-feedback error">
            {error}
          </div>
        )}
        <form onSubmit={(event) => void submit(event)}>
          <fieldset disabled={busy} className="account-fields single-column">
            {register && (
              <label>
                Имя
                <input
                  autoComplete="nickname"
                  required
                  minLength={2}
                  maxLength={60}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
            )}
            <label>
              Почта для входа
              <input
                type="email"
                autoComplete="username"
                required
                maxLength={254}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Пароль
              <input
                type="password"
                autoComplete={register ? "new-password" : "current-password"}
                required
                minLength={register ? 8 : 1}
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          </fieldset>
          <button className="button primary" disabled={busy}>
            {busy ? "Подождите…" : register ? "Зарегистрироваться" : "Войти"}
          </button>
        </form>
        {register && (
          <small>
            Пароль — от 8 символов. Почта используется для входа; письма
            подтверждения не отправляются.
          </small>
        )}
      </section>
    </main>
  );
}
