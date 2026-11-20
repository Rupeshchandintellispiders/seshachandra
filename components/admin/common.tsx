"use client";
import { useRef, useState, type ReactNode } from "react";
import { useLanguage } from "../shell";

/**
 * Runs one admin action at a time and keeps its outcome. The action may return
 * a success message to show.
 */
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const lock = useRef(false);
  async function run(fn: () => Promise<string | void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const message = await fn();
      if (message) setNotice(message);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, notice, run, setError, setNotice };
}

export function Flash({ error, notice }: { error?: string; notice?: string }) {
  const { t } = useLanguage();
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          <strong>{t("పూర్తి కాలేదు", "Could not complete")}:</strong> {error}
        </div>
      )}
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
    </>
  );
}

export function PageHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="adm-page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      {children && <div className="adm-header-actions">{children}</div>}
    </div>
  );
}

export function StatusBadge({
  status,
  featured,
}: {
  status: string;
  featured?: boolean;
}) {
  const { t } = useLanguage();
  return (
    <span className={"badge " + status}>
      {status === "published"
        ? t("ప్రచురితం", "Published")
        : t("ముసాయిదా", "Draft")}
      {featured ? " · ★" : ""}
    </span>
  );
}

export function useTypeLabel() {
  const { t } = useLanguage();
  return (type: string) =>
    type === "video"
      ? t("వీడియో", "Video")
      : type === "story"
        ? t("కథ", "Story")
        : t("పుస్తకం", "Book");
}
