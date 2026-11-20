"use client";
import { useState, useRef } from "react";
import { useLanguage, api } from "./shell";
export function Login() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  return (
    <div className="login-panel">
      <div className="eyebrow">SESHACHANDRA CREATIONS</div>
      <h1>{t("నిర్వాహక ప్రవేశం", "Admin sign-in")}</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (lock.current) return;
          lock.current = true;
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            await api("auth/login", {
              method: "POST",
              body: JSON.stringify({
                email: data.get("email"),
                password: data.get("password"),
              }),
            });
            location.assign("/admin");
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
            lock.current = false;
          }
        }}
      >
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <label>
          {t("ఈమెయిల్", "Email")}
          <input
            name="email"
            type="email"
            autoComplete="username"
            required
            maxLength={254}
          />
        </label>
        <label>
          {t("పాస్‌వర్డ్", "Password")}
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={128}
          />
        </label>
        <button disabled={busy}>
          {busy
            ? t("ప్రవేశిస్తోంది…", "Signing in…")
            : t("ప్రవేశించండి", "Sign in")}
        </button>
      </form>
      <p>
        {t(
          "ప్రవేశ వివరాల కోసం సైట్ నిర్వాహకుడిని సంప్రదించండి.",
          "Contact the site owner if you need access.",
        )}
      </p>
    </div>
  );
}
export function LogoutButton() {
  const { t } = useLanguage();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <>
      <button
        className="secondary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api("auth/logout", { method: "POST", body: "{}" });
            location.assign("/admin/login");
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        {t("నిష్క్రమించండి", "Sign out")}
      </button>
      {error && <span role="alert">{error}</span>}
    </>
  );
}
