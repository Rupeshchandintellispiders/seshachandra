"use client";
import { useLanguage } from "@/components/shell";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="login-panel" role="alert">
      <h1>{t("పేజీ లోడ్ కాలేదు", "Unable to load this page")}</h1>
      <p>
        {t(
          "మళ్ళీ ప్రయత్నించండి. సమస్య కొనసాగితే నిర్వాహకుడిని సంప్రదించండి.",
          "Please try again. If the problem continues, contact the administrator.",
        )}
      </p>
      <button onClick={reset}>{t("మళ్ళీ ప్రయత్నించండి", "Try again")}</button>
    </div>
  );
}
