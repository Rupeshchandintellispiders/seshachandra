"use client";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { Mail } from "lucide-react";
import { api, useLanguage } from "../shell";
import { Flash, useAction } from "./common";

/** Changes the signed-in admin's email after confirming the password. */
export function ChangeEmail({ email }: { email: string }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { busy, error, notice, run } = useAction();
  const form = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={form}
      className="adm-card"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        void run(async () => {
          const r = await api<{ email: string }>("auth/email", {
            method: "POST",
            body: JSON.stringify({
              email: data.get("email"),
              current: data.get("current"),
            }),
          });
          form.current?.reset();
          router.refresh();
          return t(
            `ఈమెయిల్ ${r.email} గా మార్చబడింది. ఇతర పరికరాల నుండి నిష్క్రమించబడింది.`,
            `Email changed to ${r.email}. Other devices have been signed out.`,
          );
        });
      }}
    >
      <h2 className="adm-card-title">
        <Mail size={18} aria-hidden="true" /> {t("ఈమెయిల్ మార్చండి", "Change email")}
      </h2>
      <p className="muted">
        {t("ప్రస్తుతం", "Currently")}: <strong>{email}</strong>
      </p>
      <Flash error={error} notice={notice} />
      <label>
        {t("కొత్త ఈమెయిల్", "New email")}
        <input name="email" type="email" required maxLength={254} autoComplete="email" />
      </label>
      <label>
        {t("ప్రస్తుత పాస్‌వర్డ్ (నిర్ధారణకు)", "Current password (to confirm it's you)")}
        <input
          name="current"
          type="password"
          required
          maxLength={128}
          autoComplete="current-password"
        />
      </label>
      <button disabled={busy}>{t("ఈమెయిల్ మార్చు", "Change email")}</button>
    </form>
  );
}
