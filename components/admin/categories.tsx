"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useLanguage } from "../shell";
import { Flash, PageHeader, useAction } from "./common";
import type { Category } from "@/lib/validation";

export function Categories({
  categories,
  usage,
}: {
  categories: Category[];
  /** Number of works in each category id. */
  usage: Record<string, number>;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { busy, error, notice, run } = useAction();
  const [cat, setCat] = useState<Partial<Category>>({});
  return (
    <>
      <PageHeader
        eyebrow={t("నిర్వహణ", "ADMINISTRATION")}
        title={t("విభాగాలు", "Categories")}
      />
      <Flash error={error} notice={notice} />
      <div className="adm-grid adm-grid-wide-left">
        <section className="adm-card">
          <h2>{t("విభాగాల జాబితా", "All categories")}</h2>
          {categories.length === 0 ? (
            <p className="muted">
              {t("ఇంకా విభాగాలు లేవు.", "No categories yet.")}
            </p>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>{t("తెలుగు", "Telugu")}</th>
                    <th>{t("ఆంగ్లం", "English")}</th>
                    <th>{t("క్రమం", "Order")}</th>
                    <th>{t("రచనలు", "Works")}</th>
                    <th>
                      <span className="sr-only">{t("చర్యలు", "Actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id} className={cat.id === c.id ? "selected" : ""}>
                      <td>{c.nameTe}</td>
                      <td>{c.nameEn}</td>
                      <td>{c.position}</td>
                      <td>{usage[c.id] || 0}</td>
                      <td className="adm-row-actions">
                        <button className="secondary" onClick={() => setCat(c)}>
                          {t("సవరించు", "Edit")}
                        </button>
                        <button
                          className="secondary danger"
                          disabled={busy}
                          onClick={() => {
                            if (
                              confirm(
                                t(
                                  "విభాగాన్ని తొలగించాలా? రచనలు తొలగించబడవు.",
                                  "Delete this category? Its works will be kept.",
                                ),
                              )
                            )
                              void run(async () => {
                                await api("categories/" + c.id, {
                                  method: "DELETE",
                                });
                                if (cat.id === c.id) setCat({});
                                router.refresh();
                                return t("విభాగం తొలగించబడింది.", "Category deleted.");
                              });
                          }}
                        >
                          {t("తొలగించు", "Delete")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
        <form
          className="adm-card"
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              await api("categories" + (cat.id ? "/" + cat.id : ""), {
                method: cat.id ? "PUT" : "POST",
                body: JSON.stringify({
                  nameTe: cat.nameTe,
                  nameEn: cat.nameEn,
                  position: cat.position || 0,
                }),
              });
              setCat({});
              router.refresh();
              return t("విభాగం భద్రపరచబడింది.", "Category saved.");
            });
          }}
        >
          <h2>
            {cat.id
              ? t("విభాగం సవరించండి", "Edit category")
              : t("కొత్త విభాగం", "New category")}
          </h2>
          <label>
            {t("తెలుగు పేరు", "Telugu name")}
            <input
              required
              maxLength={100}
              value={cat.nameTe || ""}
              onChange={(e) => setCat({ ...cat, nameTe: e.target.value })}
            />
          </label>
          <label>
            {t("ఆంగ్ల పేరు", "English name")}
            <input
              required
              maxLength={100}
              value={cat.nameEn || ""}
              onChange={(e) => setCat({ ...cat, nameEn: e.target.value })}
            />
          </label>
          <label>
            {t("క్రమ సంఖ్య (చిన్నది ముందు)", "Display order (lower first)")}
            <input
              type="number"
              min="0"
              max="10000"
              value={cat.position || 0}
              onChange={(e) => setCat({ ...cat, position: Number(e.target.value) })}
            />
          </label>
          <div className="editor-actions">
            <button disabled={busy}>
              {busy ? t("భద్రపరుస్తోంది…", "Saving…") : t("భద్రపరచు", "Save")}
            </button>
            {cat.id && (
              <button className="secondary" type="button" onClick={() => setCat({})}>
                {t("రద్దు", "Cancel")}
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}
