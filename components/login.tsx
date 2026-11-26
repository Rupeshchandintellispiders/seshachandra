"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Eye, EyeOff, KeyRound, Lock, Mail, UserPlus } from "lucide-react";
import { useLanguage, api, SiteLogo } from "./shell";

/** Centered card shared by sign-in and the password-recovery pages. */
function AuthCard({
  icon,
  title,
  intro,
  children,
}: {
  icon: ReactNode;
  title: string;
  intro?: string;
  children: ReactNode;
}) {
  const { t, lang, setLang } = useLanguage();
  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-top">
          <Link className="adm-brand" href="/">
            <SiteLogo />
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
          {icon} {title}
        </h1>
        {intro && <p className="muted">{intro}</p>}
        {children}
      </div>
    </div>
  );
}

function PasswordField({
  label,
  name,
  autoComplete,
  newPassword = false,
}: {
  label: string;
  name: string;
  autoComplete: string;
  newPassword?: boolean;
}) {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <span className="adm-password">
        <input
          name={name}
          type={show ? "text" : "password"}
          autoComplete={autoComplete}
          required
          minLength={newPassword ? 12 : undefined}
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
  );
}

/** Submit handling shared by the forms: one request at a time, error shown. */
function useSubmit() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const lock = useRef(false);
  async function submit(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, setError, submit };
}

function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : null;
}

function BackToSignIn() {
  const { t } = useLanguage();
  return (
    <Link className="adm-back adm-auth-back" href="/admin/login">
      ← {t("ప్రవేశ పేజీకి", "Back to sign-in")}
    </Link>
  );
}

/** Standalone admin sign-in; `next` is where to go afterwards. */
export function Login({
  next,
  expired,
  reset,
}: {
  next: string;
  expired?: boolean;
  /** Just changed the password through a reset link or recovery code. */
  reset?: boolean;
}) {
  const { t } = useLanguage();
  const { busy, error, submit } = useSubmit();
  return (
    <AuthCard
      icon={<Lock size={22} aria-hidden="true" />}
      title={t("నిర్వాహక ప్రవేశం", "Admin sign-in")}
      intro={t(
        "ఈ విభాగం సైట్ నిర్వాహకులకు మాత్రమే.",
        "This area is for the site administrator only.",
      )}
    >
      {reset && !error && (
        <p className="notice success" role="status">
          {t(
            "పాస్‌వర్డ్ మార్చబడింది. కొత్త పాస్‌వర్డ్‌తో ప్రవేశించండి.",
            "Password changed. Sign in with your new password.",
          )}
        </p>
      )}
      {expired && !reset && !error && (
        <p className="notice" role="status">
          {t("కొనసాగించడానికి దయచేసి ప్రవేశించండి.", "Please sign in to continue.")}
        </p>
      )}
      <ErrorNotice error={error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          void submit(async () => {
            const r = await api<{ next: string }>("auth/login", {
              method: "POST",
              body: JSON.stringify({
                email: data.get("email"),
                password: data.get("password"),
                next,
              }),
            });
            location.assign(r.next);
          });
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
        <PasswordField
          label={t("పాస్‌వర్డ్", "Password")}
          name="password"
          autoComplete="current-password"
        />
        <p className="adm-forgot-link">
          <Link href="/admin/forgot">
            {t("పాస్‌వర్డ్ మర్చిపోయారా?", "Forgot password?")}
          </Link>
        </p>
        <button className="adm-login-submit" disabled={busy}>
          {busy ? t("ప్రవేశిస్తోంది…", "Signing in…") : t("ప్రవేశించండి", "Sign in")}
        </button>
      </form>
      <Link className="adm-back adm-auth-back" href="/">
        ← {t("సైట్‌కు తిరిగి వెళ్ళండి", "Back to the site")}
      </Link>
    </AuthCard>
  );
}

/** Step 1 of a reset: ask for the email and send a link (when email is set up). */
export function ForgotPassword({ emailAvailable }: { emailAvailable: boolean }) {
  const { t } = useLanguage();
  const { busy, error, submit } = useSubmit();
  const [sent, setSent] = useState<null | "sent" | "no-email">(null);
  const noEmail = !emailAvailable || sent === "no-email";
  return (
    <AuthCard
      icon={<Mail size={22} aria-hidden="true" />}
      title={t("పాస్‌వర్డ్ మర్చిపోయారా?", "Forgot password?")}
      intro={
        noEmail
          ? undefined
          : t(
              "మీ నిర్వాహక ఈమెయిల్ ఇవ్వండి. కొత్త పాస్‌వర్డ్ ఎంచుకునే లింక్ పంపుతాం.",
              "Enter your admin email and we'll send you a link to choose a new password.",
            )
      }
    >
      {noEmail ? (
        <div className="notice" role="status">
          {t(
            "ఈ సైట్‌లో ఈమెయిల్ పంపే సేవ ఇంకా అమర్చలేదు. మీ రికవరీ కోడ్‌తో పాస్‌వర్డ్ మార్చండి.",
            "This site can't send email yet. Use one of your recovery codes to set a new password.",
          )}
        </div>
      ) : sent === "sent" ? (
        <div className="notice success" role="status">
          {t(
            "ఆ ఈమెయిల్‌తో నిర్వాహక ఖాతా ఉంటే, రీసెట్ లింక్ పంపాం. 30 నిమిషాల్లో తెరవండి. ఇన్‌బాక్స్‌లో లేకపోతే స్పామ్ చూడండి.",
            "If that email belongs to an admin account, a reset link is on its way. It works for 30 minutes. Check your spam folder if you don't see it.",
          )}
        </div>
      ) : (
        <>
          <ErrorNotice error={error} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              void submit(async () => {
                const r = await api<{ email: boolean }>("auth/forgot", {
                  method: "POST",
                  body: JSON.stringify({ email: data.get("email") }),
                });
                setSent(r.email ? "sent" : "no-email");
              });
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
            <button className="adm-login-submit" disabled={busy}>
              {busy ? t("పంపుతోంది…", "Sending…") : t("రీసెట్ లింక్ పంపండి", "Send reset link")}
            </button>
          </form>
        </>
      )}
      <p className="adm-alt-option">
        <KeyRound size={16} aria-hidden="true" />
        <Link href="/admin/recover">
          {noEmail
            ? t("రికవరీ కోడ్ వాడండి", "Use a recovery code")
            : t("ఈమెయిల్ అందడం లేదా? రికవరీ కోడ్ వాడండి", "No email? Use a recovery code instead")}
        </Link>
      </p>
      <p className="adm-login-foot">
        {t(
          "కోడ్‌లు కూడా లేకపోతే, సైట్ యజమాని సర్వర్‌లో npm run admin:create తో పాస్‌వర్డ్ మార్చవచ్చు.",
          "No codes either? The site owner can set a new password on the server with npm run admin:create.",
        )}
      </p>
      <BackToSignIn />
    </AuthCard>
  );
}

function NewPasswordFields() {
  const { t } = useLanguage();
  return (
    <>
      <PasswordField
        label={t("కొత్త పాస్‌వర్డ్ (కనీసం 12 అక్షరాలు)", "New password (at least 12 characters)")}
        name="password"
        autoComplete="new-password"
        newPassword
      />
      <PasswordField
        label={t("కొత్త పాస్‌వర్డ్ మళ్ళీ", "Repeat new password")}
        name="confirm"
        autoComplete="new-password"
        newPassword
      />
    </>
  );
}

/** Step 2 of an email reset: the link from the email lands here. */
export function ResetPassword({ token, valid }: { token: string; valid: boolean }) {
  const { t } = useLanguage();
  const { busy, error, setError, submit } = useSubmit();
  // Keep the one-time token out of the address bar and browser history.
  useEffect(() => {
    if (location.search.includes("token=")) history.replaceState(null, "", "/admin/reset");
  }, []);
  return (
    <AuthCard
      icon={<KeyRound size={22} aria-hidden="true" />}
      title={t("కొత్త పాస్‌వర్డ్", "Choose a new password")}
    >
      {!valid ? (
        <>
          <div className="notice error" role="alert">
            {t(
              "ఈ రీసెట్ లింక్ చెల్లదు లేదా గడువు ముగిసింది. ప్రతి లింక్ 30 నిమిషాలు, ఒకసారి మాత్రమే పనిచేస్తుంది.",
              "This reset link is invalid or has expired. Each link works once, for 30 minutes.",
            )}
          </div>
          <Link className="button adm-login-submit" href="/admin/forgot">
            {t("కొత్త లింక్ అడగండి", "Request a new link")}
          </Link>
        </>
      ) : (
        <>
          <p className="muted">
            {t(
              "మార్చిన తర్వాత అన్ని పరికరాల నుండి నిష్క్రమించబడుతుంది.",
              "After the change, every device is signed out.",
            )}
          </p>
          <ErrorNotice error={error} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              if (data.get("password") !== data.get("confirm")) {
                setError(t("కొత్త పాస్‌వర్డ్‌లు సరిపోలలేదు.", "The new passwords do not match."));
                return;
              }
              void submit(async () => {
                await api("auth/reset", {
                  method: "POST",
                  body: JSON.stringify({ token, password: data.get("password") }),
                });
                location.assign("/admin/login?reset=1");
              });
            }}
          >
            <NewPasswordFields />
            <button className="adm-login-submit" disabled={busy}>
              {busy ? t("మారుస్తోంది…", "Saving…") : t("పాస్‌వర్డ్ మార్చు", "Set new password")}
            </button>
          </form>
        </>
      )}
      <BackToSignIn />
    </AuthCard>
  );
}

/** Reset with the account email and a one-time recovery code. */
export function RecoverAccount() {
  const { t } = useLanguage();
  const { busy, error, setError, submit } = useSubmit();
  return (
    <AuthCard
      icon={<KeyRound size={22} aria-hidden="true" />}
      title={t("రికవరీ కోడ్‌తో ప్రవేశం", "Use a recovery code")}
      intro={t(
        "ఖాతా → రికవరీ కోడ్‌లలో మీరు భద్రపరచిన కోడ్‌లలో ఒకటి ఇవ్వండి. ప్రతి కోడ్ ఒకసారి మాత్రమే పనిచేస్తుంది.",
        "Enter one of the codes you saved from Account → Recovery codes. Each code works once.",
      )}
    >
      <ErrorNotice error={error} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const data = new FormData(e.currentTarget);
          if (data.get("password") !== data.get("confirm")) {
            setError(t("కొత్త పాస్‌వర్డ్‌లు సరిపోలలేదు.", "The new passwords do not match."));
            return;
          }
          void submit(async () => {
            await api("auth/recover", {
              method: "POST",
              body: JSON.stringify({
                email: data.get("email"),
                code: data.get("code"),
                password: data.get("password"),
              }),
            });
            location.assign("/admin/login?reset=1");
          });
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
          {t("రికవరీ కోడ్", "Recovery code")}
          <input
            name="code"
            required
            maxLength={40}
            autoComplete="one-time-code"
            spellCheck={false}
            placeholder="XXXX-XXXX-XX"
            className="adm-code-input"
          />
        </label>
        <NewPasswordFields />
        <button className="adm-login-submit" disabled={busy}>
          {busy ? t("మారుస్తోంది…", "Saving…") : t("పాస్‌వర్డ్ మార్చు", "Set new password")}
        </button>
      </form>
      <BackToSignIn />
    </AuthCard>
  );
}

/** Admin sign-up, reachable only through a one-time invite link. */
export function SignUp({
  token,
  email,
}: {
  token: string;
  /** The invited address, or null when the link is invalid or used. */
  email: string | null;
}) {
  const { t } = useLanguage();
  const { busy, error, setError, submit } = useSubmit();
  // Keep the one-time token out of the address bar and browser history.
  useEffect(() => {
    if (location.search.includes("token=")) history.replaceState(null, "", "/admin/signup");
  }, []);
  return (
    <AuthCard
      icon={<UserPlus size={22} aria-hidden="true" />}
      title={t("నిర్వాహకుడిగా చేరండి", "Join as an admin")}
      intro={
        email
          ? t(
              "మిమ్మల్ని సైట్ నిర్వహణకు ఆహ్వానించారు. మీ పాస్‌వర్డ్ ఎంచుకోండి.",
              "You've been invited to manage this site. Choose your password.",
            )
          : undefined
      }
    >
      {!email ? (
        <>
          <div className="notice error" role="alert">
            {t(
              "ఈ ఆహ్వాన లింక్ చెల్లదు, వాడేశారు లేదా గడువు ముగిసింది. సైట్ నిర్వాహకుడిని కొత్త లింక్ అడగండి.",
              "This invite link is invalid, already used or expired. Ask the site admin for a new one.",
            )}
          </div>
          <p className="muted">
            {t(
              "ఈ సైట్‌లో ఆహ్వానం లేకుండా ఖాతా సృష్టించలేరు.",
              "Accounts on this site can only be created by invitation.",
            )}
          </p>
        </>
      ) : (
        <>
          <ErrorNotice error={error} />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const data = new FormData(e.currentTarget);
              if (data.get("password") !== data.get("confirm")) {
                setError(t("పాస్‌వర్డ్‌లు సరిపోలలేదు.", "The passwords do not match."));
                return;
              }
              void submit(async () => {
                await api("auth/signup", {
                  method: "POST",
                  body: JSON.stringify({ token, password: data.get("password") }),
                });
                location.assign("/admin/account?welcome=1");
              });
            }}
          >
            <label>
              {t("ఈమెయిల్", "Email")}
              <input
                name="email"
                type="email"
                autoComplete="username"
                value={email}
                readOnly
              />
            </label>
            <NewPasswordFields />
            <button className="adm-login-submit" disabled={busy}>
              {busy
                ? t("ఖాతా సృష్టిస్తోంది…", "Creating account…")
                : t("ఖాతా సృష్టించు", "Create account")}
            </button>
          </form>
        </>
      )}
      <BackToSignIn />
    </AuthCard>
  );
}
