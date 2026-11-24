"use client";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Copy, UserPlus } from "lucide-react";
import { api, useLanguage } from "../shell";
import { Flash, useAction } from "./common";

export type PendingInvite = { id: string; email: string; expiresAt: number };

/**
 * Invites another admin with a one-time sign-up link. The link is shown once,
 * for the inviter to send (WhatsApp, email); only its hash is stored.
 */
export function Invites({ pending }: { pending: PendingInvite[] }) {
  const { t, lang } = useLanguage();
  const router = useRouter();
  const { busy, error, notice, run, setNotice } = useAction();
  const form = useRef<HTMLFormElement>(null);
  const [created, setCreated] = useState<{ email: string; link: string } | null>(null);
  const when = (ms: number) =>
    new Date(ms).toLocaleString(lang === "te" ? "te-IN" : "en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  return (
    <section className="adm-card adm-invites">
      <h2 className="adm-card-title">
        <UserPlus size={18} aria-hidden="true" /> {t("నిర్వాహకుడిని ఆహ్వానించండి", "Invite an admin")}
      </h2>
      <p className="muted">
        {t(
          "ఈ సైట్‌లో ఎవరూ స్వయంగా ఖాతా సృష్టించలేరు. ఒక ఈమెయిల్‌కు ఒకసారి మాత్రమే పనిచేసే ఆహ్వాన లింక్ సృష్టించి, మీరే పంపండి. ఆ లింక్ 48 గంటలు పనిచేస్తుంది. ఆహ్వానితులకు మీలాగే పూర్తి నిర్వహణ అనుమతి ఉంటుంది.",
          "Nobody can create an account on this site by themselves. Create a one-time invite link for an email and send it yourself. The link works for 48 hours. Invited admins get the same full access as you.",
        )}
      </p>
      <Flash error={error} notice={notice} />
      {created && (
        <div className="notice" role="status">
          <strong>
            {t(
              `${created.email} కోసం లింక్ — ఇప్పుడే కాపీ చేయండి, మళ్ళీ కనిపించదు:`,
              `Link for ${created.email}. Copy it now; it won't be shown again:`,
            )}
          </strong>
          <code className="adm-invite-link">{created.link}</code>
          <div className="editor-actions">
            <button
              className="secondary"
              type="button"
              onClick={() =>
                void navigator.clipboard
                  .writeText(created.link)
                  .then(() => setNotice(t("లింక్ కాపీ అయింది.", "Link copied.")))
                  .catch(() => {})
              }
            >
              <Copy size={16} aria-hidden="true" /> {t("లింక్ కాపీ", "Copy link")}
            </button>
            <button type="button" onClick={() => setCreated(null)}>
              {t("పంపాను", "Done")}
            </button>
          </div>
        </div>
      )}
      <form
        ref={form}
        className="adm-inline-password"
        onSubmit={(e) => {
          e.preventDefault();
          const email = new FormData(e.currentTarget).get("email");
          void run(async () => {
            const r = await api<{ email: string; link: string }>("auth/invites", {
              method: "POST",
              body: JSON.stringify({ email }),
            });
            form.current?.reset();
            setCreated({ email: r.email, link: r.link });
            router.refresh();
          });
        }}
      >
        <label>
          {t("ఆహ్వానించే వారి ఈమెయిల్", "Email to invite")}
          <input name="email" type="email" required maxLength={254} />
        </label>
        <button disabled={busy}>{t("ఆహ్వాన లింక్ సృష్టించు", "Create invite link")}</button>
      </form>
      {pending.length > 0 && (
        <>
          <h3 className="adm-subhead">{t("పెండింగ్ ఆహ్వానాలు", "Pending invites")}</h3>
          <ul className="adm-recent">
            {pending.map((i) => (
              <li key={i.id}>
                <span>
                  <span className="adm-recent-title">{i.email}</span>
                  <span className="adm-recent-meta">
                    {t("గడువు", "Expires")} {when(i.expiresAt)}
                  </span>
                </span>
                <button
                  className="secondary danger adm-small-button"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      await api("auth/invites/" + i.id, { method: "DELETE" });
                      router.refresh();
                      return t("ఆహ్వానం రద్దు చేయబడింది.", "Invite cancelled.");
                    })
                  }
                >
                  {t("రద్దు", "Cancel")}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
