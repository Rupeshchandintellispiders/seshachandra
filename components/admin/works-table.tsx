"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Eye, Pencil } from "lucide-react";
import { api, useLanguage } from "../shell";
import {
  Flash,
  PageHeader,
  StatusBadge,
  useAction,
  useTypeLabel,
} from "./common";
import type { Category, Work } from "@/lib/validation";

type Results = { items: Work[]; total: number; page: number; pages: number };
type BulkAction =
  | "publish"
  | "unpublish"
  | "feature"
  | "unfeature"
  | "category"
  | "delete";

export function WorksTable({
  result,
  categories,
  query,
}: {
  result: Results;
  categories: Category[];
  /** Current filters as a query string without "?". */
  query: string;
}) {
  const { t, lang } = useLanguage();
  const typeLabel = useTypeLabel();
  const router = useRouter();
  const { busy, error, notice, run } = useAction();
  const [selected, setSelected] = useState<string[]>([]);
  const [moveTo, setMoveTo] = useState("");
  const p = new URLSearchParams(query);
  const filtered = ["q", "type", "status", "category"].some((k) => p.get(k));
  const allChecked =
    result.items.length > 0 && result.items.every((w) => selected.includes(w.id));
  const catName = (id: string | null) => {
    const c = categories.find((x) => x.id === id);
    return c ? (lang === "te" ? c.nameTe : c.nameEn) : "—";
  };
  const pageLink = (page: number) => {
    const next = new URLSearchParams(query);
    next.set("page", String(page));
    return "/admin/works?" + next;
  };
  function bulk(action: BulkAction) {
    if (
      action === "delete" &&
      !confirm(
        t(
          `ఎంచుకున్న ${selected.length} రచనలను శాశ్వతంగా తొలగించాలా? దీనిని వెనక్కి తీసుకోలేరు.`,
          `Permanently delete ${selected.length} selected works? This cannot be undone.`,
        ),
      )
    )
      return;
    void run(async () => {
      const r = await api<{ changed: number; skipped: number }>("works/bulk", {
        method: "POST",
        body: JSON.stringify({
          ids: selected,
          action,
          ...(action === "category" ? { categoryId: moveTo || null } : {}),
        }),
      });
      setSelected([]);
      router.refresh();
      return (
        t(`${r.changed} రచనలు మార్చబడ్డాయి.`, `${r.changed} works updated.`) +
        (r.skipped
          ? " " +
            t(
              `${r.skipped} మారలేదు (పాఠ్యం లేని కథలను ప్రచురించలేరు).`,
              `${r.skipped} unchanged (stories without text cannot be published).`,
            )
          : "")
      );
    });
  }
  return (
    <>
      <PageHeader
        eyebrow={t("నిర్వహణ", "ADMINISTRATION")}
        title={t("రచనలు", "Works")}
      >
        <Link className="button" href="/admin/works/new">
          <Plus size={16} aria-hidden="true" />
          {t("కొత్త రచన", "New work")}
        </Link>
      </PageHeader>
      <form className="adm-filters" action="/admin/works" key={query}>
        <label className="adm-filter-search">
          {t("వెతకండి", "Search")}
          <input
            name="q"
            defaultValue={p.get("q") || ""}
            placeholder={t("శీర్షిక, వివరణ, ట్యాగ్", "Title, description, tag")}
          />
        </label>
        <label>
          {t("రకం", "Type")}
          <select name="type" defaultValue={p.get("type") || ""}>
            <option value="">{t("అన్నీ", "All")}</option>
            <option value="video">{t("వీడియోలు", "Videos")}</option>
            <option value="story">{t("కథలు", "Stories")}</option>
            <option value="book">{t("పుస్తకాలు", "Books")}</option>
          </select>
        </label>
        <label>
          {t("స్థితి", "Status")}
          <select name="status" defaultValue={p.get("status") || ""}>
            <option value="">{t("అన్నీ", "All")}</option>
            <option value="published">{t("ప్రచురితం", "Published")}</option>
            <option value="draft">{t("ముసాయిదా", "Draft")}</option>
          </select>
        </label>
        <label>
          {t("విభాగం", "Category")}
          <select name="category" defaultValue={p.get("category") || ""}>
            <option value="">{t("అన్నీ", "All")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {lang === "te" ? c.nameTe : c.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("క్రమం", "Sort")}
          <select name="sort" defaultValue={p.get("sort") || ""}>
            <option value="">{t("కొత్తవి ముందు", "Newest")}</option>
            <option value="updated">{t("ఇటీవల మార్చినవి", "Recently updated")}</option>
            <option value="oldest">{t("పాతవి ముందు", "Oldest")}</option>
            <option value="title">{t("శీర్షిక", "Title")}</option>
          </select>
        </label>
        <div className="adm-filter-actions">
          <button>{t("చూపించు", "Apply")}</button>
          {filtered && (
            <Link className="button secondary" href="/admin/works">
              {t("తొలగించు", "Clear")}
            </Link>
          )}
        </div>
      </form>
      <Flash error={error} notice={notice} />
      <div className="adm-table-meta">
        <span>
          {result.total} {t("రచనలు", "works")}
        </span>
        {selected.length > 0 && (
          <span>
            · {selected.length} {t("ఎంపిక", "selected")}
          </span>
        )}
      </div>
      {selected.length > 0 && (
        <div className="adm-bulkbar" role="region" aria-label={t("ఎంపికపై చర్యలు", "Bulk actions")}>
          <button disabled={busy} onClick={() => bulk("publish")}>
            {t("ప్రచురించు", "Publish")}
          </button>
          <button className="secondary" disabled={busy} onClick={() => bulk("unpublish")}>
            {t("ముసాయిదాగా మార్చు", "Unpublish")}
          </button>
          <button className="secondary" disabled={busy} onClick={() => bulk("feature")}>
            ★ {t("ముఖపుటలో చూపించు", "Feature")}
          </button>
          <button className="secondary" disabled={busy} onClick={() => bulk("unfeature")}>
            {t("ప్రత్యేకత తీసివేయి", "Unfeature")}
          </button>
          <span className="adm-bulk-move">
            <select
              aria-label={t("విభాగం", "Category")}
              value={moveTo}
              onChange={(e) => setMoveTo(e.target.value)}
            >
              <option value="">{t("విభాగం లేదు", "No category")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === "te" ? c.nameTe : c.nameEn}
                </option>
              ))}
            </select>
            <button className="secondary" disabled={busy} onClick={() => bulk("category")}>
              {t("విభాగం మార్చు", "Set category")}
            </button>
          </span>
          <button className="secondary danger" disabled={busy} onClick={() => bulk("delete")}>
            {t("తొలగించు", "Delete")}
          </button>
          <button className="adm-link" onClick={() => setSelected([])}>
            {t("ఎంపిక రద్దు", "Clear selection")}
          </button>
        </div>
      )}
      {result.items.length === 0 ? (
        <div className="empty">
          <h3>
            {filtered
              ? t("సరిపోయే రచనలు లేవు", "No matching works")
              : t("ఇంకా రచనలు లేవు", "No works yet")}
          </h3>
        </div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th className="adm-check">
                  <input
                    type="checkbox"
                    aria-label={t("అన్నీ ఎంచుకోండి", "Select all on this page")}
                    checked={allChecked}
                    onChange={(e) =>
                      setSelected(e.target.checked ? result.items.map((w) => w.id) : [])
                    }
                  />
                </th>
                <th>{t("శీర్షిక", "Title")}</th>
                <th>{t("రకం", "Type")}</th>
                <th>{t("స్థితి", "Status")}</th>
                <th>{t("విభాగం", "Category")}</th>
                <th>{t("మార్పు", "Updated")}</th>
                <th>
                  <span className="sr-only">{t("చర్యలు", "Actions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((w) => (
                <tr key={w.id} className={selected.includes(w.id) ? "selected" : ""}>
                  <td className="adm-check">
                    <input
                      type="checkbox"
                      aria-label={t("ఎంచుకోండి", "Select") + ": " + w.title}
                      checked={selected.includes(w.id)}
                      onChange={(e) =>
                        setSelected((s) =>
                          e.target.checked ? [...s, w.id] : s.filter((x) => x !== w.id),
                        )
                      }
                    />
                  </td>
                  <td className="adm-title-cell">
                    <Link href={"/admin/works/" + w.id}>{w.title}</Link>
                    <small>/work/{w.slug}</small>
                  </td>
                  <td>{typeLabel(w.type)}</td>
                  <td>
                    <StatusBadge status={w.status} featured={w.featured} />
                  </td>
                  <td>{catName(w.categoryId)}</td>
                  <td className="adm-nowrap">{w.updatedAt.slice(0, 10)}</td>
                  <td className="adm-row-actions">
                    <Link
                      className="button secondary"
                      href={"/admin/works/" + w.id}
                      aria-label={t("సవరించు", "Edit") + ": " + w.title}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </Link>
                    <a
                      className="button secondary"
                      href={"/work/" + w.slug + "?preview=1"}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={t("వీక్షణ", "Preview") + ": " + w.title}
                    >
                      <Eye size={14} aria-hidden="true" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {result.pages > 1 && (
        <nav className="pagination" aria-label={t("పేజీలు", "Pages")}>
          {result.page > 1 && (
            <Link className="button secondary" href={pageLink(result.page - 1)}>
              ← {t("మునుపటి", "Previous")}
            </Link>
          )}
          <span>
            {t("పేజీ", "Page")} {result.page} / {result.pages}
          </span>
          {result.page < result.pages && (
            <Link className="button secondary" href={pageLink(result.page + 1)}>
              {t("తరువాతి", "Next")} →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
