"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { ImageUp, Trash2 } from "lucide-react";
import { api, SiteLogo, useLanguage } from "../shell";
import { Flash, useAction } from "./common";

/**
 * Uploads, replaces or removes the site logo. It appears in the site header
 * and footer, the admin, the sign-in pages, the About page and the browser tab.
 */
export function LogoCard() {
  const { t, logo } = useLanguage();
  const router = useRouter();
  const { busy, error, notice, run, setError } = useAction();
  const input = useRef<HTMLInputElement>(null);
  return (
    <section className="adm-card adm-logo-card">
      <h2 className="adm-card-title">
        <ImageUp size={18} aria-hidden="true" /> {t("లోగో", "Logo")}
      </h2>
      <p className="muted">
        {t(
          "లోగో సైట్ హెడర్, ఫుటర్, పరిచయ పేజీ, నిర్వహణ, ప్రవేశ పేజీలు, బ్రౌజర్ ట్యాబ్‌లో కనిపిస్తుంది. PNG, JPEG లేదా WebP, 1 MB లోపు. పారదర్శక నేపథ్యం ఉన్న చతురస్ర/అడ్డ PNG బాగుంటుంది.",
          "The logo appears in the site header and footer, the About page, the admin, the sign-in pages and the browser tab. PNG, JPEG or WebP, up to 1 MB. A square or wide PNG with a transparent background works best.",
        )}
      </p>
      <Flash error={error} notice={notice} />
      <div className="adm-logo-preview" aria-label={t("ప్రస్తుత లోగో", "Current logo")}>
        <SiteLogo />
      </div>
      {!logo && (
        <p className="muted adm-small">
          {t(
            "ఇంకా లోగో లేదు — ప్రస్తుతం “శే” చిహ్నం కనిపిస్తోంది.",
            "No logo yet. The “శే” emblem is shown instead.",
          )}
        </p>
      )}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (
            file.size > 1024 * 1024 ||
            !["image/png", "image/jpeg", "image/webp"].includes(file.type)
          ) {
            setError(
              t(
                "1 MB లోపు PNG, JPEG లేదా WebP చిత్రాన్ని ఎంచుకోండి.",
                "Choose a PNG, JPEG or WebP image up to 1 MB.",
              ),
            );
            return;
          }
          void run(async () => {
            const form = new FormData();
            form.append("file", file);
            await api("site/logo", { method: "POST", body: form });
            router.refresh();
            return t(
              "లోగో భద్రపరచబడింది. ఇది సైట్ అంతటా కనిపిస్తుంది.",
              "Logo saved. It now appears across the site.",
            );
          });
        }}
      />
      <div className="editor-actions">
        <button disabled={busy} onClick={() => input.current?.click()}>
          <ImageUp size={16} aria-hidden="true" />
          {busy
            ? t("అప్‌లోడ్ అవుతోంది…", "Uploading…")
            : logo
              ? t("లోగో మార్చు", "Replace logo")
              : t("లోగో అప్‌లోడ్", "Upload logo")}
        </button>
        {logo && (
          <button
            className="secondary danger"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api("site/logo", { method: "DELETE" });
                router.refresh();
                return t(
                  "లోగో తీసివేయబడింది. “శే” చిహ్నం మళ్ళీ కనిపిస్తుంది.",
                  "Logo removed. The “శే” emblem is shown again.",
                );
              })
            }
          >
            <Trash2 size={16} aria-hidden="true" />
            {t("లోగో తీసివేయి", "Remove logo")}
          </button>
        )}
      </div>
    </section>
  );
}
