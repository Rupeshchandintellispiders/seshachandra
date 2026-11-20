"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  FileText,
  FolderTree,
  Info,
  Clapperboard,
  UserCog,
  ExternalLink,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { api, useLanguage } from "../shell";

const nav = [
  { href: "/admin", te: "డాష్‌బోర్డ్", en: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/works", te: "రచనలు", en: "Works", icon: FileText },
  { href: "/admin/categories", te: "విభాగాలు", en: "Categories", icon: FolderTree },
  { href: "/admin/settings", te: "పరిచయం & లింకులు", en: "About & links", icon: Info },
  { href: "/admin/import", te: "YouTube దిగుమతి", en: "YouTube import", icon: Clapperboard },
  { href: "/admin/account", te: "ఖాతా", en: "Account", icon: UserCog },
];

/** Admin frame: sidebar navigation and a top bar, separate from the public site. */
export function AdminShell({
  email,
  children,
}: {
  email: string;
  children: ReactNode;
}) {
  const { t, lang, setLang } = useLanguage();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const active = (href: string) =>
    href === "/admin" ? path === "/admin" : path.startsWith(href);
  async function signOut() {
    setSigningOut(true);
    try {
      await api("auth/logout", { method: "POST", body: "{}" });
    } finally {
      // A full page load drops any admin data held by the client router.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      location.assign("/admin/login");
    }
  }
  return (
    <div className={"adm" + (open ? " adm-nav-open" : "")}>
      <a className="skip" href="#admin-main">
        {t("విషయానికి వెళ్ళండి", "Skip to content")}
      </a>
      <aside className="adm-sidebar" aria-label={t("నిర్వహణ మెనూ", "Admin menu")}>
        <Link className="adm-brand" href="/admin" onClick={() => setOpen(false)}>
          <span className="monogram">
            శే<span>✦</span>
          </span>
          <span>
            <strong>{t("శేషచంద్ర", "Seshachandra")}</strong>
            <small>{t("నిర్వహణ", "Admin")}</small>
          </span>
        </Link>
        <nav>
          {nav.map(({ href, te, en, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={active(href) ? "active" : ""}
              aria-current={active(href) ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              <Icon size={18} aria-hidden="true" />
              {t(te, en)}
            </Link>
          ))}
        </nav>
        <a className="adm-site-link" href="/" target="_blank" rel="noreferrer">
          <ExternalLink size={16} aria-hidden="true" />
          {t("సైట్ చూడండి", "View site")}
        </a>
      </aside>
      <div className="adm-body">
        <header className="adm-topbar">
          <button
            className="adm-menu secondary"
            aria-expanded={open}
            aria-label={t("మెనూ", "Menu")}
            onClick={() => setOpen(!open)}
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
          <span className="adm-user" title={email}>
            {email}
          </span>
          <button
            className="secondary adm-lang"
            onClick={() => setLang(lang === "te" ? "en" : "te")}
          >
            {lang === "te" ? "EN" : "తెలుగు"}
          </button>
          <button
            className="secondary"
            disabled={signingOut}
            onClick={() => void signOut()}
          >
            <LogOut size={16} aria-hidden="true" />
            {t("నిష్క్రమించు", "Sign out")}
          </button>
        </header>
        <main id="admin-main" className="adm-main">
          {children}
        </main>
      </div>
      {open && (
        <button
          className="adm-scrim"
          aria-label={t("మెనూ మూసివేయి", "Close menu")}
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
}
