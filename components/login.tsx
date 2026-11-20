"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useLanguage, api } from "./shell";

/** Standalone admin sign-in; `next` is where to go afterwards. */
export function Login({ next, expired }: { next: string; expired?: boolean }) {
  const { t, lang, setLang } = useLanguage();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  const lock = useRef(false);
  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-top">
          <Link className="adm-brand" href="/">
            <span className="monogram">
              శే<span>✦</span>
            </span>
            <span>
              <strong>{t("శేషచంద్ర క్రియేషన్స్", "Seshachandra Creations")}</strong>
              <small>{t("నిర్వహణ", "Admin")}</small>
            </span>
          </Link>
          <button
            className="secondary adm-lang"
            onClick={() => setLang(lang === "te" ? "en" : "te")}
          >
            {lang === "te" ? "EN" : "తెలుగు"}
          </button>
        </div>
        <h1>
          <Lock size={22} aria-hidden="true" /> {t("నిర్వాహక ప్రవేశం", "Admin sign-in")}
        </h1>
        <p className="muted">
          {t(
            "ఈ విభాగం సైట్ నిర్వాహకులకు మాత్రమే.",
            "This area is for the site administrator only.",
          )}
        </p>
        {expired && !error && (
          <p className="notice" role="status">
            {t(
              "కొనసాగించడానికి దయచేసి ప్రవేశించండి.",
              "Please sign in to continue.",
            )}
          </p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (lock.current) return;
            lock.current = true;
            setBusy(true);
            setError("");
            const data = new FormData(e.currentTarget);
            try {
              const r = await api<{ next: string }>("auth/login", {
                method: "POST",
                body: JSON.stringify({
                  email: data.get("email"),
                  password: data.get("password"),
                  next,
                }),
              });
              location.assign(r.next);
            } catch (e) {
              setError((e as Error).message);
              setBusy(false);
              lock.current = false;
            }
          }}
        >
          <label>
            {t("ఈమెయిల్", "Email")}
            <input
              name="email"
              type="email"
              autoComplete="username"
              autoFocus
              required
              maxLength={254}
            />
          </label>
          <label>
            {t("పాస్‌వర్డ్", "Password")}
            <span className="adm-password">
              <input
                name="password"
                type={show ? "text" : "password"}
                autoComplete="current-password"
                required
                maxLength={128}
              />
              <button
                type="button"
                className="secondary"
                aria-label={
                  show
                    ? t("పాస్‌వర్డ్ దాచు", "Hide password")
                    : t("పాస్‌వర్డ్ చూపించు", "Show password")
                }
                aria-pressed={show}
                onClick={() => setShow(!show)}
              >
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <button className="adm-login-submit" disabled={busy}>
            {busy
              ? t("ప్రవేశిస్తోంది…", "Signing in…")
              : t("ప్రవేశించండి", "Sign in")}
          </button>
        </form>
        <p className="adm-login-foot">
          {t(
            "పాస్‌వర్డ్ మర్చిపోయారా? సైట్ యజమాని సర్వర్‌లో npm run admin:create తో రీసెట్ చేయవచ్చు.",
            "Forgot your password? The site owner can reset it on the server with npm run admin:create.",
          )}
        </p>
        <Link className="adm-back" href="/">
          ← {t("సైట్‌కు తిరిగి వెళ్ళండి", "Back to the site")}
        </Link>
      </div>
    </div>
  );
}
