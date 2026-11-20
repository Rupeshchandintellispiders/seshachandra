"use client";
import { useLanguage } from "@/components/shell";
export default function AdminError({ reset }: { reset: () => void }) {
  const { t } = useLanguage();
  return (
    <div className="adm-card" role="alert">
      <h1>{t("పేజీ లోడ్ కాలేదు", "This page could not be loaded")}</h1>
      <p>
        {t(
          "డేటాబేస్ అందుబాటులో ఉందో తనిఖీ చేసి మళ్ళీ ప్రయత్నించండి.",
          "Check that the database is available, then try again.",
        )}
      </p>
      <button onClick={reset}>{t("మళ్ళీ ప్రయత్నించండి", "Try again")}</button>
    </div>
  );
}
