"use client";
import Link from "next/link";
import { Plus, Clapperboard, ArrowRight } from "lucide-react";
import { useLanguage } from "../shell";
import { PageHeader, StatusBadge, useTypeLabel } from "./common";
import type { Work } from "@/lib/validation";

export function Dashboard({
  counts,
  recent,
  categories,
}: {
  counts: { type: string; status: string; count: number }[];
  recent: Work[];
  categories: number;
}) {
  const { t } = useLanguage();
  const typeLabel = useTypeLabel();
  const total = (type?: string, status?: string) =>
    counts
      .filter(
        (c) => (!type || c.type === type) && (!status || c.status === status),
      )
      .reduce((n, c) => n + c.count, 0);
  const drafts = total(undefined, "draft");
  const stats: [string, number, string][] = [
    [t("మొత్తం రచనలు", "All works"), total(), "/admin/works"],
    [t("ప్రచురించినవి", "Published"), total(undefined, "published"), "/admin/works?status=published"],
    [t("ముసాయిదాలు", "Drafts"), drafts, "/admin/works?status=draft"],
    [t("వీడియోలు", "Videos"), total("video"), "/admin/works?type=video"],
    [t("కథలు", "Stories"), total("story"), "/admin/works?type=story"],
    [t("పుస్తకాలు", "Books"), total("book"), "/admin/works?type=book"],
  ];
  return (
    <>
      <PageHeader
        eyebrow={t("నిర్వహణ", "ADMINISTRATION")}
        title={t("డాష్‌బోర్డ్", "Dashboard")}
      >
        <Link className="button" href="/admin/works/new">
          <Plus size={16} aria-hidden="true" />
          {t("కొత్త రచన", "New work")}
        </Link>
      </PageHeader>
      <div className="adm-stats">
        {stats.map(([label, count, href]) => (
          <Link key={label} href={href}>
            <strong>{count}</strong>
            <span>{label}</span>
          </Link>
        ))}
      </div>
      {drafts > 0 && (
        <div className="adm-callout">
          <div>
            <strong>
              {t(
                `${drafts} ముసాయిదాలు ప్రచురణకు వేచి ఉన్నాయి`,
                `${drafts} drafts are waiting to be published`,
              )}
            </strong>
            <p>
              {t(
                "ముసాయిదాలు ప్రజలకు కనిపించవు. వాటిని ఎంచుకుని ఒకేసారి ప్రచురించవచ్చు.",
                "Drafts are hidden from visitors. Select them and publish in one step.",
              )}
            </p>
          </div>
          <Link className="button secondary" href="/admin/works?status=draft">
            {t("ముసాయిదాలు చూడండి", "Review drafts")}
            <ArrowRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
      <div className="adm-grid">
        <section className="adm-card">
          <div className="adm-card-head">
            <h2>{t("ఇటీవలి మార్పులు", "Recently updated")}</h2>
            <Link href="/admin/works?sort=updated">
              {t("అన్నీ", "View all")} →
            </Link>
          </div>
          {recent.length === 0 ? (
            <p className="muted">{t("ఇంకా రచనలు లేవు.", "No works yet.")}</p>
          ) : (
            <ul className="adm-recent">
              {recent.map((w) => (
                <li key={w.id}>
                  <Link href={"/admin/works/" + w.id}>
                    <span className="adm-recent-title">{w.title}</span>
                    <span className="adm-recent-meta">
                      {typeLabel(w.type)} · {w.updatedAt.slice(0, 10)}
                    </span>
                  </Link>
                  <StatusBadge status={w.status} featured={w.featured} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="adm-card">
          <h2>{t("త్వరిత చర్యలు", "Quick actions")}</h2>
          <div className="adm-quick">
            <Link href="/admin/works/new">
              <Plus size={18} aria-hidden="true" />
              {t("కథ, వీడియో లేదా పుస్తకం జోడించండి", "Add a story, video or book")}
            </Link>
            <Link href="/admin/import">
              <Clapperboard size={18} aria-hidden="true" />
              {t("YouTube నుండి కొత్త వీడియోలు", "Import new YouTube videos")}
            </Link>
            <Link href="/admin/categories">
              <ArrowRight size={18} aria-hidden="true" />
              {t(
                `విభాగాలు నిర్వహించండి (${categories})`,
                `Manage categories (${categories})`,
              )}
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
