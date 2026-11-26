"use client";
import Link from "next/link";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { errorInTelugu } from "@/lib/errors";
type LanguageState = {
  lang: string;
  t: (te: string, en: string) => string;
  setLang: (lang: string) => void;
  /** Address of the uploaded site logo, or null to show the text emblem. */
  logo: string | null;
};
const Language = createContext<LanguageState>({
  lang: "te",
  t: (te) => te,
  setLang: () => {},
  logo: null,
});
export const useLanguage = () => useContext(Language);
function rememberLanguage(v: string) {
  // A cookie lets the server render the chosen language on the next visit.
  document.cookie = `sc-language=${v}; path=/; max-age=31536000; samesite=lax`;
}
/** Holds the interface language for both the public site and the admin. */
export function LanguageProvider({
  children,
  initialLang = "te",
  logo = null,
}: {
  children: ReactNode;
  initialLang?: "te" | "en";
  logo?: string | null;
}) {
  const [lang, setLang] = useState<string>(initialLang);
  useEffect(() => {
    // One-time move of the older localStorage preference into the cookie;
    // it takes effect from the next page the visitor opens.
    try {
      const saved = localStorage.getItem("sc-language");
      if (saved && !document.cookie.includes("sc-language="))
        rememberLanguage(saved === "en" ? "en" : "te");
      localStorage.removeItem("sc-language");
    } catch {}
  }, []);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const change = (v: string) => {
    setLang(v);
    rememberLanguage(v);
  };
  const t = (te: string, en: string) => (lang === "te" ? te : en);
  return (
    <Language.Provider value={{ lang, t, setLang: change, logo }}>
      {children}
    </Language.Provider>
  );
}
/**
 * The site logo when one is uploaded, otherwise the "శే" emblem. Used in every
 * header, the admin sidebar, sign-in pages and the footer.
 */
export function SiteLogo({ className = "" }: { className?: string }) {
  const { logo } = useContext(Language);
  if (logo)
    return (
      <span className={"site-logo " + className}>
        {/* eslint-disable-next-line @next/next/no-img-element -- small uploaded logo, served from the database */}
        <img src={logo} alt="" />
      </span>
    );
  return (
    <span className={"monogram " + className}>
      శే<span>✦</span>
    </span>
  );
}
/** Public site header and footer. */
export function Shell({ children }: { children: ReactNode }) {
  const { lang, t, setLang: change } = useLanguage();
  const [menu, setMenu] = useState(false);
  return (
    <>
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
        <Link className="identity" href="/" aria-label="Seshachandra Creations">
          <SiteLogo />
          <span>
            <strong>
              {t("శేషచంద్ర క్రియేషన్స్", "Seshachandra Creations")}
            </strong>
            <small>
              {t("SESHACHANDRA CREATIONS", "తెలుగు సాహిత్యం · కథలు · వీడియోలు")}
            </small>
          </span>
        </Link>
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
          <Link href="/">{t("ముఖపుట", "Home")}</Link>
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
          <Link className="footer-brand" href="/">
            <SiteLogo className="footer-logo" />
            <span className="footer-brand-text">
              Seshachandra Creations<span>శేషచంద్ర క్రియేషన్స్</span>
            </span>
          </Link>
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
        </div>
        <div className="footer-bottom">
          © {new Date().getFullYear()} Seshachandra Creations{" "}
          <span>{t("తెలుగు పట్ల ప్రేమతో", "With a love for Telugu")} ✦</span>
        </div>
      </footer>
    </>
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
