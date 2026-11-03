"use client";
import { useEffect, useRef, useState } from "react";
import { api, useLanguage, Notice } from "./shell";
import {
  defaultSettings,
  type Settings,
  type Category,
  type Work,
  type WorkInput,
} from "@/lib/validation";
const empty: WorkInput = {
  title: "",
  slug: "",
  type: "story",
  description: "",
  body: "",
  tags: [],
  categoryId: null,
  status: "draft",
  featured: false,
  youtubeId: "",
  publication: "",
  publicationDate: "",
  attribution: "",
  externalUrl: "",
  coverId: null,
  attachmentIds: [],
};
export function Admin() {
  const { t } = useLanguage();
  const [session, setSession] = useState<{
      signedIn: boolean;
      admin: boolean;
      userId: string | null;
    } | null>(null),
    [tab, setTab] = useState("works"),
    [items, setItems] = useState<Work[]>([]),
    [cats, setCats] = useState<Category[]>([]),
    [settings, setSettings] = useState<Settings>(defaultSettings),
    [counts, setCounts] = useState<
      { type: string; status: string; count: number }[]
    >([]),
    [page, setPage] = useState(1),
    [pages, setPages] = useState(1),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [edit, setEdit] = useState<(WorkInput & { id?: string }) | null>(null),
    [cat, setCat] = useState<Partial<Category>>({}),
    [cursor, setCursor] = useState<string | null>(null),
    [search, setSearch] = useState("");
  const lock = useRef(false);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    try {
      const [w, c, s, d] = await Promise.all([
        api<{ items: Work[]; pages: number }>(
          "works?admin=1&page=" + page + "&q=" + encodeURIComponent(search),
        ),
        api<Category[]>("categories"),
        api<Settings>("settings"),
        api<typeof counts>("dashboard"),
      ]);
      setItems(w.items);
      setPages(w.pages);
      setCats(c);
      setSettings(s);
      setCounts(d);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    api<typeof session>("session")
      .then(setSession)
      .catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (session?.admin) void refresh();
  }, [session, page, search]);
  async function act(fn: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  if (!session)
    return (
      <div className="page-wrap">
        {error ? (
          <Notice error={error} />
        ) : (
          <p role="status">{t("లోడ్ అవుతోంది…", "Loading…")}</p>
        )}
      </div>
    );
  if (!session.admin)
    return (
      <div className="login-panel">
        <div className="eyebrow">SESHACHANDRA CREATIONS</div>
        <h1>{t("నిర్వాహక ప్రవేశం", "Admin sign-in")}</h1>
        <p>
          {t(
            "అనుమతి ఉన్న నిర్వాహకులు మాత్రమే రచనలను నిర్వహించగలరు.",
            "Only authorized administrators can manage content.",
          )}
        </p>
        {session.signedIn ? (
          <>
            <div className="notice">
              {t(
                "ఈ ఖాతాకు నిర్వాహక అనుమతి లేదు. మీ వినియోగదారు IDని హోస్టింగ్ నిర్వాహకునికి అందించండి.",
                "This account is not on the admin allowlist. Give your user ID to the hosting administrator.",
              )}
              <code>{session.userId}</code>
            </div>
            <a
              className="button secondary"
              href="/signout-with-chatgpt?return_to=/admin"
              target="_top"
            >
              {t("నిష్క్రమించండి", "Sign out")}
            </a>
          </>
        ) : (
          <a
            className="button"
            href="/signin-with-chatgpt?return_to=/admin"
            target="_top"
          >
            {t("ChatGPT తో ప్రవేశించండి", "Sign in with ChatGPT")} →
          </a>
        )}
      </div>
    );
  const total = (type?: string, status?: string) =>
    counts
      .filter(
        (c) => (!type || c.type === type) && (!status || c.status === status),
      )
      .reduce((n, c) => n + c.count, 0);
  return (
    <div className="page-wrap admin">
      <div className="section-heading">
        <div>
          <div className="eyebrow">{t("నిర్వహణ", "ADMINISTRATION")}</div>
          <h1>{t("మీ రచనల వేదిక", "Your writing desk")}</h1>
        </div>
        <a
          className="button secondary"
          href="/signout-with-chatgpt?return_to=/admin"
          target="_top"
        >
          {t("నిష్క్రమించండి", "Sign out")}
        </a>
      </div>
      <div className="stats">
        {[
          [t("మొత్తం రచనలు", "All works"), total()],
          [t("ప్రచురించినవి", "Published"), total(undefined, "published")],
          [t("ముసాయిదాలు", "Drafts"), total(undefined, "draft")],
          [t("వీడియోలు", "Videos"), total("video")],
        ].map(([label, count]) => (
          <div key={label}>
            <strong>{count}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <div className="admin-tabs">
        {[
          ["works", "రచనలు", "Works"],
          ["categories", "విభాగాలు", "Categories"],
          ["settings", "పరిచయం & లింకులు", "About & links"],
          ["import", "YouTube దిగుమతి", "YouTube import"],
        ].map(([key, te, en]) => (
          <button
            key={key}
            className={tab === key ? "" : "secondary"}
            onClick={() => {
              setTab(key);
              setEdit(null);
              setError("");
              setNotice("");
            }}
          >
            {t(te, en)}
          </button>
        ))}
      </div>
      {error && (
        <div className="notice error" role="alert">
          {t("పూర్తి కాలేదు. వివరాలు:", "Could not complete the request:")}{" "}
          {error}
        </div>
      )}
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {tab === "works" &&
        (edit ? (
          <Editor
            initial={edit}
            categories={cats}
            busy={busy}
            onCancel={() => setEdit(null)}
            onSave={(v) =>
              act(async () => {
                await api("works" + (edit.id ? "/" + edit.id : ""), {
                  method: edit.id ? "PUT" : "POST",
                  body: JSON.stringify(v),
                });
                setEdit(null);
                setNotice(t("రచన భద్రపరచబడింది.", "Work saved."));
                await refresh();
              })
            }
          />
        ) : (
          <>
            <div className="section-heading">
              <h2>{t("రచనలను నిర్వహించండి", "Manage works")}</h2>
              <button
                onClick={() =>
                  setEdit({
                    ...empty,
                    slug: "work-" + crypto.randomUUID().slice(0, 8),
                  })
                }
              >
                ＋ {t("కొత్త రచన", "New work")}
              </button>
            </div>
            <form
              className="inline-form"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
                setSearch(new FormData(e.currentTarget).get("q") as string);
              }}
            >
              <label>
                {t("వెతకండి", "Search works")}
                <input
                  name="q"
                  placeholder={t("శీర్షిక లేదా ట్యాగ్", "Title or tag")}
                />
              </label>
              <button className="secondary">{t("వెతకండి", "Search")}</button>
            </form>
            {loading ? (
              <p role="status">{t("లోడ్ అవుతోంది…", "Loading…")}</p>
            ) : items.length === 0 ? (
              <div className="empty">
                <h3>{t("ఇంకా రచనలు లేవు", "No works yet")}</h3>
                <p>
                  {t(
                    "కొత్త రచనను జోడించి, ముసాయిదాగా భద్రపరచండి.",
                    "Add your first work and save it as a draft.",
                  )}
                </p>
              </div>
            ) : (
              <div className="admin-list">
                {items.map((w) => (
                  <div className="admin-row" key={w.id}>
                    <div>
                      <span className={"badge " + w.status}>
                        {w.status === "published"
                          ? t("ప్రచురితం", "Published")
                          : t("ముసాయిదా", "Draft")}
                        {w.featured ? " · ★" : ""}
                      </span>
                      <h3>{w.title}</h3>
                      <small>
                        {w.updatedAt.slice(0, 10)} · /work/{w.slug}
                      </small>
                    </div>
                    <div className="row-actions">
                      <a
                        className="button secondary"
                        href={"/work/" + w.slug + "?preview=1"}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {t("వీక్షణ", "Preview")}
                      </a>
                      <button className="secondary" onClick={() => setEdit(w)}>
                        {t("సవరించు", "Edit")}
                      </button>
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={() =>
                          void act(async () => {
                            await api("works/" + w.id, {
                              method: "PUT",
                              body: JSON.stringify({
                                ...w,
                                status:
                                  w.status === "published"
                                    ? "draft"
                                    : "published",
                              }),
                            });
                            await refresh();
                            setNotice(
                              t("స్థితి మార్చబడింది.", "Status updated."),
                            );
                          })
                        }
                      >
                        {w.status === "published"
                          ? t("ప్రచురణ ఆపు", "Unpublish")
                          : t("ప్రచురించు", "Publish")}
                      </button>
                      <button
                        className="danger secondary"
                        disabled={busy}
                        onClick={() => {
                          if (
                            confirm(
                              t(
                                "ఈ రచనను శాశ్వతంగా తొలగించాలా?",
                                "Permanently delete this work?",
                              ),
                            )
                          )
                            void act(async () => {
                              await api("works/" + w.id, { method: "DELETE" });
                              await refresh();
                              setNotice(
                                t("రచన తొలగించబడింది.", "Work deleted."),
                              );
                            });
                        }}
                      >
                        {t("తొలగించు", "Delete")}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="pagination">
              <button
                className="secondary"
                disabled={page <= 1 || loading}
                onClick={() => setPage(page - 1)}
              >
                ← {t("మునుపటి", "Previous")}
              </button>
              <span>
                {page} / {Math.max(pages, 1)}
              </span>
              <button
                className="secondary"
                disabled={page >= pages || loading}
                onClick={() => setPage(page + 1)}
              >
                {t("తరువాతి", "Next")} →
              </button>
            </div>
          </>
        ))}
      {tab === "categories" && (
        <>
          <h2>{t("విభాగాల నిర్వహణ", "Category management")}</h2>
          <form
            className="editor"
            onSubmit={(e) => {
              e.preventDefault();
              void act(async () => {
                await api("categories" + (cat.id ? "/" + cat.id : ""), {
                  method: cat.id ? "PUT" : "POST",
                  body: JSON.stringify({
                    nameTe: cat.nameTe,
                    nameEn: cat.nameEn,
                    position: cat.position || 0,
                  }),
                });
                setCat({});
                await refresh();
                setNotice(t("విభాగం భద్రపరచబడింది.", "Category saved."));
              });
            }}
          >
            <div className="form-grid">
              <label>
                {t("తెలుగు పేరు", "Telugu name")}
                <input
                  required
                  value={cat.nameTe || ""}
                  onChange={(e) => setCat({ ...cat, nameTe: e.target.value })}
                />
              </label>
              <label>
                {t("ఆంగ్ల పేరు", "English name")}
                <input
                  required
                  value={cat.nameEn || ""}
                  onChange={(e) => setCat({ ...cat, nameEn: e.target.value })}
                />
              </label>
              <label>
                {t("క్రమ సంఖ్య", "Display order")}
                <input
                  type="number"
                  min="0"
                  max="10000"
                  value={cat.position || 0}
                  onChange={(e) =>
                    setCat({ ...cat, position: Number(e.target.value) })
                  }
                />
              </label>
            </div>
            <div className="actions">
              <button disabled={busy}>
                {busy
                  ? t("భద్రపరుస్తోంది…", "Saving…")
                  : t("విభాగం భద్రపరచు", "Save category")}
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => setCat({})}
              >
                {t("రద్దు", "Cancel")}
              </button>
            </div>
          </form>
          <div className="admin-list">
            {cats.map((c) => (
              <div className="admin-row" key={c.id}>
                <div>
                  <h3>
                    {c.nameTe} / {c.nameEn}
                  </h3>
                  <small>
                    {t("క్రమం", "Order")}: {c.position}
                  </small>
                </div>
                <div className="row-actions">
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
                        void act(async () => {
                          await api("categories/" + c.id, { method: "DELETE" });
                          await refresh();
                        });
                    }}
                  >
                    {t("తొలగించు", "Delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "settings" && (
        <form
          className="editor"
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              await api("settings", {
                method: "PUT",
                body: JSON.stringify(settings),
              });
              setNotice(t("వివరాలు భద్రపరచబడ్డాయి.", "Settings saved."));
            });
          }}
        >
          <h2>{t("పరిచయం & సంప్రదింపు", "About & contact")}</h2>
          <p>
            {t(
              "నిజమైన వివరాలను మాత్రమే జోడించండి. ఖాళీ సంప్రదింపు వివరాలు కనిపించవు.",
              "Add only real details. Empty contact fields are hidden.",
            )}
          </p>
          <label>
            {t("తెలుగు పరిచయం", "About in Telugu")}
            <textarea
              rows={6}
              value={settings.aboutTe}
              onChange={(e) =>
                setSettings({ ...settings, aboutTe: e.target.value })
              }
            />
          </label>
          <label>
            {t("ఆంగ్ల పరిచయం", "About in English")}
            <textarea
              rows={6}
              value={settings.aboutEn}
              onChange={(e) =>
                setSettings({ ...settings, aboutEn: e.target.value })
              }
            />
          </label>
          <div className="form-grid">
            {(
              [
                "email",
                "phone",
                "youtubeUrl",
                "instagramUrl",
                "facebookUrl",
              ] as const
            ).map((key) => (
              <label key={key}>
                {
                  {
                    email: t("ఈమెయిల్", "Email"),
                    phone: t("ఫోన్", "Phone"),
                    youtubeUrl: "YouTube URL",
                    instagramUrl: "Instagram URL",
                    facebookUrl: "Facebook URL",
                  }[key]
                }
                <input
                  type={
                    key === "email"
                      ? "email"
                      : key.endsWith("Url")
                        ? "url"
                        : "text"
                  }
                  value={settings[key]}
                  onChange={(e) =>
                    setSettings({ ...settings, [key]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>
          <button disabled={busy}>
            {busy
              ? t("భద్రపరుస్తోంది…", "Saving…")
              : t("వివరాలు భద్రపరచు", "Save settings")}
          </button>
        </form>
      )}
      {tab === "import" && (
        <div className="editor">
          <h2>{t("YouTube ఛానల్ దిగుమతి", "Import from YouTube")}</h2>
          <p>@seshachandracreations1955</p>
          <p>
            {t(
              "ఒక్కోసారి 50 వీడియోల వరకు ముసాయిదాలుగా దిగుమతి అవుతాయి. ఇప్పటికే ఉన్న వీడియోలు, మీ సవరణలు మారవు. ఆటోమేటిక్ షెడ్యూల్ లేదు.",
              "Import up to 50 videos at a time as drafts. Existing videos and manual edits are preserved. There is no automatic schedule.",
            )}
          </p>
          <button
            disabled={busy}
            onClick={() =>
              void act(async () => {
                const r = await api<{
                  imported: number;
                  skipped: number;
                  nextCursor: string | null;
                }>("import", {
                  method: "POST",
                  body: JSON.stringify({ cursor }),
                });
                setCursor(r.nextCursor);
                setNotice(
                  `${t("దిగుమతి", "Imported")}: ${r.imported}. ${t("దాటవేసినవి", "Skipped")}: ${r.skipped}. ${r.nextCursor ? t("మరిన్ని వీడియోలు ఉన్నాయి.", "More videos are available.") : t("ఛానల్ చివరికి చేరారు.", "Reached the end of the channel.")}`,
                );
                await refresh();
              })
            }
          >
            {busy
              ? t("దిగుమతి అవుతోంది…", "Importing…")
              : cursor
                ? t("తదుపరి 50 దిగుమతి", "Import next 50")
                : t("వీడియోలు దిగుమతి చేయండి", "Import videos")}
          </button>
          {cursor && (
            <button className="secondary" onClick={() => setCursor(null)}>
              {t("మొదటి నుండి", "Start from beginning")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
function Editor({
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
  async function upload(file: File | undefined, cover: boolean) {
    if (!file || uploadLock.current) return;
    uploadLock.current = true;
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api<{ id: string }>("uploads", {
        method: "POST",
        body: form,
      });
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
      <h2>
        {initial.id
          ? t("రచన సవరించండి", "Edit work")
          : t("కొత్త రచన", "New work")}
      </h2>
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
          onClick={onCancel}
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
