"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { errorInTelugu } from "@/lib/errors";
const Language = createContext({
  lang: "te",
  t: (te: string, en: string) => te,
  setLang: (_v: string) => {},
});
export const useLanguage = () => useContext(Language);
export function Shell({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState("te");
  const [menu, setMenu] = useState(false);
  useEffect(() => {
    try {
      setLang(localStorage.getItem("sc-language") === "en" ? "en" : "te");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const change = (v: string) => {
    setLang(v);
    try {
      localStorage.setItem("sc-language", v);
    } catch {}
  };
  const t = (te: string, en: string) => (lang === "te" ? te : en);
  return (
    <Language.Provider value={{ lang, t, setLang: change }}>
      <a className="skip" href="#main">
        {t("విషయానికి వెళ్ళండి", "Skip to content")}
      </a>
      <div className="topline">
        {t(
          "తెలుగు అక్షరాలకు, ఆలోచనలకు ఒక వేదిక",
          "A home for Telugu words and ideas",
        )}
        <span>EST. WITH LOVE · తెలుగు</span>
      </div>
      <header>
        <a className="identity" href="/" aria-label="Seshachandra Creations">
          <span className="monogram">
            శే<span>✦</span>
          </span>
          <span>
            <strong>
              {t("శేషచంద్ర క్రియేషన్స్", "Seshachandra Creations")}
            </strong>
            <small>
              {t("SESHACHANDRA CREATIONS", "తెలుగు సాహిత్యం · కథలు · వీడియోలు")}
            </small>
          </span>
        </a>
        <button
          className="menu-toggle secondary"
          aria-expanded={menu}
          aria-controls="navigation"
          onClick={() => setMenu(!menu)}
        >
          {t("మెనూ", "Menu")} ☰
        </button>
        <nav
          id="navigation"
          className={menu ? "open" : ""}
          aria-label={t("ప్రధాన మెనూ", "Main navigation")}
        >
          <a href="/">{t("ముఖపుట", "Home")}</a>
          <a href="/library">{t("రచనల సంపుటి", "Library")}</a>
          <a href="/library?type=video">{t("వీడియోలు", "Videos")}</a>
          <a href="/about">{t("పరిచయం", "About")}</a>
        </nav>
        <button
          className="language"
          onClick={() => change(lang === "te" ? "en" : "te")}
          aria-label={t(
            "Switch interface to English",
            "ఇంటర్‌ఫేస్ తెలుగులోకి మార్చండి",
          )}
        >
          {lang === "te" ? "EN" : "తెలుగు"} <span>⇄</span>
        </button>
      </header>
      <main id="main">{children}</main>
      <footer>
        <div>
          <a className="footer-brand" href="/">
            Seshachandra Creations<span>శేషచంద్ర క్రియేషన్స్</span>
          </a>
          <p>
            {t(
              "తెలుగు కథలు, సాహిత్యం, వీడియోలు — ఒకే చోట.",
              "Telugu stories, literature and videos — together in one place.",
            )}
          </p>
        </div>
        <div className="footer-links">
          <a href="/library">{t("రచనలు చూడండి", "Explore the library")}</a>
          <a href="/about">{t("పరిచయం & సంప్రదింపు", "About & contact")}</a>
          <a href="/admin">{t("నిర్వాహక ప్రవేశం", "Admin sign-in")}</a>
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} Seshachandra Creations{" "}
          <span>{t("తెలుగు పట్ల ప్రేమతో", "With a love for Telugu")} ✦</span>
        </div>
      </footer>
    </Language.Provider>
  );
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch("/api/" + path, {
    ...options,
    headers: {
      ...(options?.body && !(options.body instanceof FormData)
        ? { "Content-Type": "application/json" }
        : {}),
      ...options?.headers,
    },
  });
  const data: unknown = await res.json();
  if (!res.ok) {
    const failure = data as { error?: string; code?: string };
    throw new Error(
      document.documentElement.lang === "te"
        ? errorInTelugu(failure.code || "")
        : failure.error || "Request failed",
    );
  }
  return data as T;
}
export function Notice({ error }: { error: string }) {
  const { t } = useLanguage();
  return (
    <div className="notice error" role="alert">
      <strong>
        {t("అభ్యర్థన పూర్తి కాలేదు", "The request could not be completed")}
      </strong>
      <p>{error}</p>
      <button className="secondary" onClick={() => location.reload()}>
        {t("మళ్ళీ ప్రయత్నించండి", "Try again")}
      </button>
    </div>
  );
}
export function Empty({ filtered = false }: { filtered?: boolean }) {
  const { t } = useLanguage();
  return (
    <div className="empty">
      <span className="empty-icon">❧</span>
      <h3>
        {filtered
          ? t("సరిపోయే రచనలు లేవు", "No matching works")
          : t("కొత్త రచనల కోసం వేచి చూడండి", "A new chapter is on its way")}
      </h3>
      <p>
        {filtered
          ? t(
              "వేరే పదాలు లేదా వడపోతలతో ప్రయత్నించండి.",
              "Try another search or change your filters.",
            )
          : t(
              "ప్రచురించిన రచనలు ఇక్కడ కనిపిస్తాయి. అప్పటివరకు మా YouTube ఛానల్‌ను సందర్శించండి.",
              "Published works will appear here. In the meantime, visit our YouTube channel.",
            )}
      </p>
      {filtered ? (
        <a href="/library">{t("వడపోతలు తొలగించండి", "Clear filters")} →</a>
      ) : (
        <a
          href="https://youtube.com/@seshachandracreations1955"
          target="_blank"
          rel="noreferrer"
        >
          {t("YouTube ఛానల్ చూడండి", "Visit the YouTube channel")} ↗
        </a>
      )}
    </div>
  );
}
