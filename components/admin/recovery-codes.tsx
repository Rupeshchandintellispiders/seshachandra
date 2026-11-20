"use client";
import { useState } from "react";
import { Copy, Download, KeyRound } from "lucide-react";
import { api, useLanguage } from "../shell";
import { Flash, useAction } from "./common";

/**
 * Generates one-time recovery codes for resetting a forgotten password. The
 * codes are shown once; only their hashes are stored.
 */
export function RecoveryCodes({
  email,
  codesLeft,
  emailAvailable,
}: {
  email: string;
  codesLeft: number;
  /** Whether reset links can be emailed. */
  emailAvailable: boolean;
}) {
  const { t } = useLanguage();
  const { busy, error, notice, run, setNotice } = useAction();
  const [codes, setCodes] = useState<string[] | null>(null);
  const [left, setLeft] = useState(codesLeft);
  const text = codes
    ? [
        "Seshachandra Creations: admin recovery codes",
        "Account: " + email,
        "Each code works once. Use at /admin/recover",
        "",
        ...codes,
      ].join("\n")
    : "";
  return (
    <section className="adm-card adm-recovery">
      <h2>
        <KeyRound size={18} aria-hidden="true" /> {t("రికవరీ కోడ్‌లు", "Recovery codes")}
      </h2>
      <p>
        {emailAvailable
          ? t(
              "పాస్‌వర్డ్ మర్చిపోతే, ఈమెయిల్‌లో రీసెట్ లింక్ వస్తుంది. ఈమెయిల్ అందకపోతే ఈ కోడ్‌లు బ్యాకప్.",
              "If you forget your password, a reset link is emailed to you. These codes are the backup if email doesn't arrive.",
            )
          : t(
              "ఈ సైట్ ఇంకా ఈమెయిల్ పంపలేదు, కాబట్టి పాస్‌వర్డ్ మర్చిపోతే ఈ కోడ్‌లే మార్గం.",
              "This site can't send email yet, so these codes are how you reset a forgotten password.",
            )}
      </p>
      <Flash error={error} notice={notice} />
      {codes ? (
        <>
          <div className="notice" role="status">
            <strong>
              {t(
                "ఈ కోడ్‌లను ఇప్పుడే భద్రపరచండి. అవి మళ్ళీ కనిపించవు.",
                "Save these codes now. They won't be shown again.",
              )}
            </strong>{" "}
            {t(
              "పాస్‌వర్డ్ మేనేజర్‌లో లేదా ముద్రించి సురక్షిత చోట ఉంచండి. పాత కోడ్‌లు ఇక పనిచేయవు.",
              "Keep them in a password manager or print them. Your old codes no longer work.",
            )}
          </div>
          <ol className="adm-codes">
            {codes.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ol>
          <div className="editor-actions">
            <button
              className="secondary"
              onClick={() =>
                void navigator.clipboard
                  .writeText(text)
                  .then(() => setNotice(t("కోడ్‌లు కాపీ అయ్యాయి.", "Codes copied.")))
                  .catch(() => {})
              }
            >
              <Copy size={16} aria-hidden="true" /> {t("కాపీ", "Copy")}
            </button>
            <a
              className="button secondary"
              download="seshachandra-recovery-codes.txt"
              href={"data:text/plain;charset=utf-8," + encodeURIComponent(text)}
            >
              <Download size={16} aria-hidden="true" /> {t("డౌన్‌లోడ్", "Download .txt")}
            </a>
            <button onClick={() => setCodes(null)}>
              {t("భద్రపరిచాను", "I've saved them")}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className={left > 2 ? "muted" : "notice"}>
            {left
              ? t(`${left} ఉపయోగించని కోడ్‌లు మిగిలి ఉన్నాయి.`, `${left} unused codes left.`)
              : t("మీకు ఇంకా రికవరీ కోడ్‌లు లేవు.", "You don't have any recovery codes yet.")}
          </p>
          <form
            className="adm-inline-password"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const current = new FormData(form).get("current");
              void run(async () => {
                const r = await api<{ codes: string[] }>("auth/recovery-codes", {
                  method: "POST",
                  body: JSON.stringify({ current }),
                });
                form.reset();
                setCodes(r.codes);
                setLeft(r.codes.length);
              });
            }}
          >
            <label>
              {t("ప్రస్తుత పాస్‌వర్డ్ (నిర్ధారణకు)", "Current password (to confirm it's you)")}
              <input
                name="current"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
              />
            </label>
            <button disabled={busy}>
              {left
                ? t("కొత్త కోడ్‌లు సృష్టించు", "Create new codes")
                : t("కోడ్‌లు సృష్టించు", "Create recovery codes")}
            </button>
          </form>
          {left > 0 && (
            <p className="muted adm-small">
              {t(
                "కొత్తవి సృష్టిస్తే పాత కోడ్‌లు ఇక పనిచేయవు.",
                "Creating new codes stops the old ones from working.",
              )}
            </p>
          )}
        </>
      )}
    </section>
  );
}
