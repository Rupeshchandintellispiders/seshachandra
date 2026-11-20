"use client";
import { useRef, useState } from "react";
import { api, useLanguage } from "../shell";
import { Flash, PageHeader, useAction } from "./common";

export function Account({
  email,
  sessions,
}: {
  email: string;
  /** Active sign-ins for this admin, including this browser. */
  sessions: number;
}) {
  const { t } = useLanguage();
  const { busy, error, notice, run, setError } = useAction();
  const form = useRef<HTMLFormElement>(null);
  const [show, setShow] = useState(false);
  return (
    <>
      <PageHeader eyebrow={t("ఖాతా", "ACCOUNT")} title={t("మీ ఖాతా", "Your account")} />
      <Flash error={error} notice={notice} />
      <div className="adm-grid">
        <form
          ref={form}
          className="adm-card"
          onSubmit={(e) => {
            e.preventDefault();
            const data = new FormData(e.currentTarget);
            const next = String(data.get("next"));
            if (next !== data.get("confirm")) {
              setError(t("కొత్త పాస్‌వర్డ్‌లు సరిపోలలేదు.", "The new passwords do not match."));
              return;
            }
            void run(async () => {
              await api("auth/password", {
                method: "POST",
                body: JSON.stringify({ current: data.get("current"), next }),
              });
              form.current?.reset();
              return t(
                "పాస్‌వర్డ్ మార్చబడింది. ఇతర పరికరాల నుండి నిష్క్రమించబడింది.",
                "Password changed. Other devices have been signed out.",
              );
            });
          }}
        >
          <h2>{t("పాస్‌వర్డ్ మార్చండి", "Change password")}</h2>
          <p className="muted">{email}</p>
          <label>
            {t("ప్రస్తుత పాస్‌వర్డ్", "Current password")}
            <input
              name="current"
              type={show ? "text" : "password"}
              autoComplete="current-password"
              required
              maxLength={128}
            />
          </label>
          <label>
            {t("కొత్త పాస్‌వర్డ్ (కనీసం 12 అక్షరాలు)", "New password (at least 12 characters)")}
            <input
              name="next"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <label>
            {t("కొత్త పాస్‌వర్డ్ మళ్ళీ", "Repeat new password")}
            <input
              name="confirm"
              type={show ? "text" : "password"}
              autoComplete="new-password"
              required
              minLength={12}
              maxLength={128}
            />
          </label>
          <label className="checkbox">
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
            {t("పాస్‌వర్డ్‌లు చూపించు", "Show passwords")}
          </label>
          <button disabled={busy}>{t("పాస్‌వర్డ్ మార్చు", "Change password")}</button>
        </form>
        <section className="adm-card">
          <h2>{t("ప్రవేశ సెషన్‌లు", "Sign-in sessions")}</h2>
          <p>
            {t(
              `ఈ ఖాతా ప్రస్తుతం ${sessions} పరికరం(ల)లో ప్రవేశించి ఉంది. ప్రతి ప్రవేశం 8 గంటల తర్వాత ముగుస్తుంది.`,
              `This account is signed in on ${sessions} device(s). Each sign-in expires after 8 hours.`,
            )}
          </p>
          <p className="muted">
            {t(
              "మీ పాస్‌వర్డ్ ఇతరులకు తెలిసిందని అనుమానం ఉంటే, పాస్‌వర్డ్ మార్చి అన్ని పరికరాల నుండి నిష్క్రమించండి.",
              "If you think someone else knows your password, change it and sign out everywhere.",
            )}
          </p>
          <button
            className="secondary danger"
            disabled={busy}
            onClick={() => {
              if (
                confirm(
                  t(
                    "ఈ పరికరంతో సహా అన్ని పరికరాల నుండి నిష్క్రమించాలా?",
                    "Sign out on every device, including this one?",
                  ),
                )
              )
                void run(async () => {
                  await api("auth/logout", {
                    method: "POST",
                    body: JSON.stringify({ everywhere: true }),
                  });
                  location.assign("/admin/login");
                });
            }}
          >
            {t("అన్ని పరికరాల నుండి నిష్క్రమించు", "Sign out everywhere")}
          </button>
        </section>
      </div>
    </>
  );
}
