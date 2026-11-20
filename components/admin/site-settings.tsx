"use client";
import { useState } from "react";
import { api, useLanguage } from "../shell";
import { Flash, PageHeader, useAction } from "./common";
import type { Settings } from "@/lib/validation";

export function SiteSettings({ initial }: { initial: Settings }) {
  const { t } = useLanguage();
  const { busy, error, notice, run } = useAction();
  const [settings, setSettings] = useState(initial);
  const field = (key: keyof Settings, value: string) =>
    setSettings({ ...settings, [key]: value });
  return (
    <>
      <PageHeader
        eyebrow={t("నిర్వహణ", "ADMINISTRATION")}
        title={t("పరిచయం & లింకులు", "About & links")}
      >
        <a className="button secondary" href="/about" target="_blank" rel="noreferrer">
          {t("పరిచయ పేజీ చూడండి", "View About page")} ↗
        </a>
      </PageHeader>
      <Flash error={error} notice={notice} />
      <form
        className="adm-card"
        onSubmit={(e) => {
          e.preventDefault();
          void run(async () => {
            await api("settings", {
              method: "PUT",
              body: JSON.stringify(settings),
            });
            return t("వివరాలు భద్రపరచబడ్డాయి.", "Settings saved.");
          });
        }}
      >
        <p className="muted">
          {t(
            "నిజమైన వివరాలను మాత్రమే జోడించండి. ఖాళీ సంప్రదింపు వివరాలు సైట్‌లో కనిపించవు.",
            "Add only real details. Empty contact fields are hidden on the site.",
          )}
        </p>
        <div className="adm-two">
          <label>
            {t("తెలుగు పరిచయం", "About in Telugu")}
            <textarea
              rows={8}
              maxLength={20000}
              value={settings.aboutTe}
              onChange={(e) => field("aboutTe", e.target.value)}
            />
          </label>
          <label>
            {t("ఆంగ్ల పరిచయం", "About in English")}
            <textarea
              rows={8}
              maxLength={20000}
              value={settings.aboutEn}
              onChange={(e) => field("aboutEn", e.target.value)}
            />
          </label>
        </div>
        <h2>{t("సంప్రదింపు & సామాజిక లింకులు", "Contact & social links")}</h2>
        <div className="form-grid">
          {(
            ["email", "phone", "youtubeUrl", "instagramUrl", "facebookUrl"] as const
          ).map((key) => (
            <label key={key}>
              {
                {
                  email: t("ఈమెయిల్", "Email"),
                  phone: t("ఫోన్", "Phone"),
                  youtubeUrl: "YouTube URL",
                  instagramUrl: "Instagram URL",
                  facebookUrl: "Facebook URL",
                }[key]
              }
              <input
                type={key === "email" ? "email" : key.endsWith("Url") ? "url" : "text"}
                placeholder={key.endsWith("Url") ? "https://…" : undefined}
                value={settings[key]}
                onChange={(e) => field(key, e.target.value)}
              />
            </label>
          ))}
        </div>
        <button disabled={busy}>
          {busy ? t("భద్రపరుస్తోంది…", "Saving…") : t("వివరాలు భద్రపరచు", "Save settings")}
        </button>
      </form>
    </>
  );
}
