"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Eye, Trash2 } from "lucide-react";
import { api, useLanguage } from "../shell";
import { Flash, PageHeader, StatusBadge, useAction } from "./common";
import type { Category, WorkInput } from "@/lib/validation";


/** Create or edit one work, then return to the works list. */
export function WorkEditor({
  initial,
  categories,
}: {
  initial: WorkInput & { id?: string };
  categories: Category[];
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const { busy, error, run } = useAction();
  const back = () => {
    router.push("/admin/works?sort=updated");
    router.refresh();
  };
  return (
    <>
      <Link className="adm-back" href="/admin/works">
        ← {t("రచనల జాబితా", "All works")}
      </Link>
      <PageHeader
        eyebrow={initial.id ? t("సవరణ", "EDIT") : t("కొత్తది", "NEW")}
        title={
          initial.id
            ? initial.title || t("రచన సవరించండి", "Edit work")
            : t("కొత్త రచన", "New work")
        }
      >
        {initial.id && (
          <>
            <StatusBadge status={initial.status} featured={initial.featured} />
            <a
              className="button secondary"
              target="_blank"
              rel="noreferrer"
              href={"/work/" + initial.slug + "?preview=1"}
            >
              <Eye size={16} aria-hidden="true" />
              {t("వీక్షణ", "Preview")}
            </a>
            <button
              className="secondary danger"
              disabled={busy}
              onClick={() => {
                if (
                  confirm(
                    t(
                      "ఈ రచనను శాశ్వతంగా తొలగించాలా? దీనిని వెనక్కి తీసుకోలేరు.",
                      "Permanently delete this work? This cannot be undone.",
                    ),
                  )
                )
                  void run(async () => {
                    await api("works/" + initial.id, { method: "DELETE" });
                    back();
                  });
              }}
            >
              <Trash2 size={16} aria-hidden="true" />
              {t("తొలగించు", "Delete")}
            </button>
          </>
        )}
      </PageHeader>
      <Flash error={error} />
      <EditorForm
        initial={initial}
        categories={categories}
        busy={busy}
        onCancel={back}
        onSave={(v) =>
          run(async () => {
            await api("works" + (initial.id ? "/" + initial.id : ""), {
              method: initial.id ? "PUT" : "POST",
              body: JSON.stringify(v),
            });
            back();
          })
        }
      />
    </>
  );
}
function EditorForm({
  initial,
  categories,
  busy,
  onCancel,
  onSave,
}: {
  initial: WorkInput & { id?: string };
  categories: Category[];
  busy: boolean;
  onCancel: () => void;
  onSave: (v: WorkInput) => Promise<void>;
}) {
  const { t, lang } = useLanguage();
  const [v, setV] = useState(initial),
    [tagText, setTagText] = useState(initial.tags.join(", ")),
    [uploading, setUploading] = useState(false),
    [error, setError] = useState("");
  const uploadLock = useRef(false);
  const update = (key: keyof WorkInput, value: unknown) =>
    setV((old) => ({ ...old, [key]: value }));
  // Warn before leaving with unsaved edits (closing the tab or reloading).
  const dirty =
    JSON.stringify(v) !== JSON.stringify(initial) ||
    tagText !== initial.tags.join(", ");
  useEffect(() => {
    if (!dirty || busy) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, busy]);
  async function upload(file: File | undefined, cover: boolean) {
    if (!file || uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setError("");
    try {
      if (
        file.size > 10 * 1024 * 1024 ||
        !["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(
          file.type,
        )
      )
        throw new Error(
          t(
            "10 MB లోపు PDF లేదా చిత్రాన్ని ఎంచుకోండి.",
            "Choose a PDF or supported image up to 10 MB.",
          ),
        );
      const ticket = await api<{ id?: string; url?: string; local: boolean }>(
        "storage/presign",
        {
          method: "POST",
          body: JSON.stringify({
            name: file.name,
            mime: file.type,
            size: file.size,
          }),
        },
      );
      let r: { id: string };
      if (ticket.local) {
        const form = new FormData();
        form.append("file", file);
        r = await api<{ id: string }>("uploads", {
          method: "POST",
          body: form,
        });
      } else {
        const response = await fetch(ticket.url!, {
          method: "PUT",
          headers: { "Content-Type": file.type },
          body: file,
        });
        if (!response.ok)
          throw new Error(
            t(
              "అప్‌లోడ్ కాలేదు. మళ్ళీ ప్రయత్నించండి.",
              "Upload failed. Try again.",
            ),
          );
        r = await api<{ id: string }>("storage/complete", {
          method: "POST",
          body: JSON.stringify({ id: ticket.id }),
        });
      }
      setV((old) => ({
        ...old,
        ...(cover
          ? { coverId: r.id }
          : { attachmentIds: [...old.attachmentIds, r.id] }),
      }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setUploading(false);
      uploadLock.current = false;
    }
  }
  return (
    <form
      className="editor"
      onSubmit={(e) => {
        e.preventDefault();
        void onSave({
          ...v,
          tags: tagText
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        });
      }}
    >
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      <fieldset disabled={busy || uploading}>
        <div className="form-grid">
          <label>
            {t("రకం", "Type")}
            <select
              value={v.type}
              onChange={(e) => update("type", e.target.value)}
            >
              <option value="story">{t("కథ", "Story")}</option>
              <option value="video">{t("వీడియో", "Video")}</option>
              <option value="book">{t("పుస్తకం", "Book")}</option>
            </select>
          </label>
          <label>
            {t("స్థితి", "Status")}
            <select
              value={v.status}
              onChange={(e) => update("status", e.target.value)}
            >
              <option value="draft">{t("ముసాయిదా", "Draft")}</option>
              <option value="published">{t("ప్రచురితం", "Published")}</option>
            </select>
          </label>
          <label>
            {t("విభాగం", "Category")}
            <select
              value={v.categoryId || ""}
              onChange={(e) => update("categoryId", e.target.value || null)}
            >
              <option value="">{t("విభాగం లేదు", "Uncategorized")}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {lang === "te" ? c.nameTe : c.nameEn}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label>
          {t("శీర్షిక", "Title")} *
          <input
            required
            maxLength={240}
            value={v.title}
            onChange={(e) => update("title", e.target.value)}
          />
        </label>
        <label>
          {t(
            "స్థిర లింక్ పేరు (ఆంగ్ల అక్షరాలు, సంఖ్యలు, హైఫన్)",
            "URL slug (lowercase letters, numbers and hyphens)",
          )}{" "}
          *
          <input
            required
            pattern="[a-z0-9]+(-[a-z0-9]+)*"
            maxLength={180}
            value={v.slug}
            readOnly={!!initial.id}
            onChange={(e) => update("slug", e.target.value)}
          />
          <small>/work/{v.slug}</small>
        </label>
        {v.type === "video" && (
          <label>
            YouTube URL / ID *
            <input
              required
              value={v.youtubeId || ""}
              onChange={(e) => update("youtubeId", e.target.value)}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </label>
        )}
        <label>
          {t("సారాంశం / వివరణ", "Summary / description")}
          <textarea
            rows={3}
            maxLength={6000}
            value={v.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </label>
        {v.type !== "video" && (
          <label>
            {t("రచన పాఠ్యం", "Full text")}
            <textarea
              rows={14}
              maxLength={200000}
              value={v.body}
              onChange={(e) => update("body", e.target.value)}
            />
          </label>
        )}
        <div className="form-grid">
          <label>
            {t("ప్రచురణ పేరు", "Publication name")}
            <input
              value={v.publication}
              onChange={(e) => update("publication", e.target.value)}
            />
          </label>
          <label>
            {t("ప్రచురణ తేదీ", "Publication date")}
            <input
              type="date"
              value={v.publicationDate}
              onChange={(e) => update("publicationDate", e.target.value)}
            />
          </label>
        </div>
        <label>
          {t("మూలం / కృతజ్ఞతలు", "Attribution")}
          <input
            value={v.attribution}
            onChange={(e) => update("attribution", e.target.value)}
          />
        </label>
        <label>
          {t("ట్యాగ్‌లు (కామాలతో వేరు చేయండి)", "Tags (comma separated)")}
          <input value={tagText} onChange={(e) => setTagText(e.target.value)} />
        </label>
        {v.type === "book" && (
          <label>
            {t("కొనుగోలు / సంప్రదింపు లింక్", "Purchase / contact link")}
            <input
              type="url"
              value={v.externalUrl}
              onChange={(e) => update("externalUrl", e.target.value)}
              placeholder="https://…"
            />
          </label>
        )}
        <label className="checkbox">
          <input
            type="checkbox"
            checked={v.featured}
            onChange={(e) => update("featured", e.target.checked)}
          />
          {t("ముఖపుటలో ప్రత్యేకంగా చూపించు", "Feature on the home page")}
        </label>
        <div className="upload-panel">
          <h3>{t("చిత్రాలు & అనుబంధాలు", "Images & attachments")}</h3>
          <p>
            {t(
              "PDF, JPEG, PNG, WebP · ఒక్కో ఫైలు గరిష్ఠంగా 10 MB",
              "PDF, JPEG, PNG, WebP · maximum 10 MB per file",
            )}
          </p>
          <label>
            {t("ముఖచిత్రం", "Cover image")}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void upload(e.target.files?.[0], true)}
            />
          </label>
          {v.coverId && (
            <p>
              <a
                target="_blank"
                rel="noreferrer"
                href={"/api/uploads/" + v.coverId}
              >
                {t("ముఖచిత్రం చూడండి", "View cover")}
              </a>{" "}
              <button
                className="secondary"
                type="button"
                onClick={() => update("coverId", null)}
              >
                {t("తీసివేయి", "Remove")}
              </button>
            </p>
          )}
          <label>
            {t("కథ PDF / స్కాన్", "Story PDF / scan")}
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={v.attachmentIds.length >= 12}
              onChange={(e) => void upload(e.target.files?.[0], false)}
            />
          </label>
          {v.attachmentIds.map((id, i) => (
            <p key={id}>
              <a target="_blank" rel="noreferrer" href={"/api/uploads/" + id}>
                {t("అనుబంధం", "Attachment")} {i + 1}
              </a>{" "}
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  update(
                    "attachmentIds",
                    v.attachmentIds.filter((x) => x !== id),
                  )
                }
              >
                {t("తీసివేయి", "Remove")}
              </button>
            </p>
          ))}
        </div>
      </fieldset>
      {uploading && (
        <p role="status">{t("అప్‌లోడ్ అవుతోంది…", "Uploading…")}</p>
      )}
      <div className="editor-actions">
        <button disabled={busy || uploading}>
          {busy
            ? t("భద్రపరుస్తోంది…", "Saving…")
            : t("రచన భద్రపరచు", "Save work")}
        </button>
        <button
          className="secondary"
          type="button"
          disabled={busy || uploading}
          onClick={() => {
            if (
              !dirty ||
              confirm(
                t(
                  "భద్రపరచని మార్పులు పోతాయి. కొనసాగించాలా?",
                  "Discard unsaved changes?",
                ),
              )
            )
              onCancel();
          }}
        >
          {t("రద్దు", "Cancel")}
        </button>
        {initial.id && (
          <a
            className="button secondary"
            target="_blank"
            rel="noreferrer"
            href={"/work/" + v.slug + "?preview=1"}
          >
            {t("భద్రపరచిన వీక్షణ", "Preview saved version")} ↗
          </a>
        )}
      </div>
    </form>
  );
}
