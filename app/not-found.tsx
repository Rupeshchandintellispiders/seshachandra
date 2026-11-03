"use client";
import { useLanguage } from "@/components/shell";
export default function NotFound() {
  const { t } = useLanguage();
  return (
    <div className="login-panel">
      <div className="eyebrow">404</div>
      <h1>{t("పేజీ కనుగొనబడలేదు", "Page not found")}</h1>
      <p>
        {t(
          "ఈ రచన అందుబాటులో లేదు లేదా ఇంకా ప్రచురించబడలేదు.",
          "This work is unavailable or has not been published.",
        )}
      </p>
      <a className="button" href="/library">
        {t("రచనల సంపుటికి", "Back to the library")} →
      </a>
    </div>
  );
}
