"use client";
import { useEffect, useState } from "react";
import { useLanguage, api, Empty, Notice } from "./shell";
import {
  defaultSettings,
  type Work,
  type Category,
  type Settings,
} from "@/lib/validation";
type Results = { items: Work[]; total: number; page: number; pages: number };
export function Card({ work }: { work: Work }) {
  const { t } = useLanguage();
  return (
    <a className="card" href={"/work/" + work.slug}>
      <div className={"card-art " + work.type}>
        {work.type === "video" ? (
          <>
            <img
              src={`https://i.ytimg.com/vi/${work.youtubeId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
            />
            <span className="play">▶</span>
          </>
        ) : work.coverId ? (
          <img src={"/api/uploads/" + work.coverId} alt="" loading="lazy" />
        ) : (
          <span className="type-glyph">
            {work.type === "story" ? "అ" : "▤"}
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="eyebrow">
          {work.type === "video"
            ? t("వీడియో", "VIDEO")
            : work.type === "story"
              ? t("కథ", "STORY")
              : t("పుస్తకం", "BOOK")}
          {work.publicationDate && <span> · {work.publicationDate}</span>}
        </div>
        <h3>{work.title}</h3>
        <p>{work.description}</p>
        <span className="text-link">
          {work.type === "video"
            ? t("వీడియో చూడండి", "Watch video")
            : t("మరింత చదవండి", "Read more")}{" "}
          ↗
        </span>
      </div>
    </a>
  );
}
export function Home() {
  const { t, lang } = useLanguage();
  const [latest, setLatest] = useState<Work[]>([]),
    [featured, setFeatured] = useState<Work[]>([]),
    [cats, setCats] = useState<Category[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    Promise.all([
      api<Results>("works"),
      api<Results>("works?featured=1"),
      api<Category[]>("categories"),
    ])
      .then(([l, f, c]) => {
        setLatest(l.items);
        setFeatured(f.items);
        setCats(c);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="gold-line" />{" "}
            {t("మన భాష. మన కథలు.", "OUR LANGUAGE. OUR STORIES.")}
          </div>
          <h1>
            {t("అక్షరాల ప్రయాణం,", "A journey in words,")}
            <br />
            <em>{t("ఆలోచనల ప్రపంచం.", "a world of ideas.")}</em>
          </h1>
          <p>
            {t(
              "శేషచంద్ర క్రియేషన్స్‌కు స్వాగతం. తెలుగు కథలు, రచనలు, వీడియోలను ఒకే చోట ఆస్వాదించండి.",
              "Welcome to Seshachandra Creations. Discover Telugu stories, writing and videos, all in one place.",
            )}
          </p>
          <div className="actions">
            <a className="button" href="/library">
              {t("రచనలు అన్వేషించండి", "Explore the library")} <span>→</span>
            </a>
            <a
              className="button secondary"
              href="https://youtube.com/@seshachandracreations1955"
              target="_blank"
              rel="noreferrer"
            >
              <span>▷</span> {t("YouTube లో చూడండి", "Watch on YouTube")}
            </a>
          </div>
          <div className="hero-note">
            <span>✦</span>
            {t(
              "తెలుగు సాహిత్యానికి ఒక ఆత్మీయ వేదిక",
              "A welcoming home for Telugu literature",
            )}
          </div>
        </div>
        <div className="literary-art" aria-hidden="true">
          <div className="art-orbit" />
          <div className="paper paper-back" />
          <div className="paper paper-front">
            <span className="paper-top">శేషచంద్ర క్రియేషన్స్</span>
            <span className="big-letter">అ</span>
            <span className="paper-rule" />
            <span className="paper-caption">అక్షరం నుంచి ఆలోచన వరకు</span>
            <span className="paper-flower">❧</span>
          </div>
          <span className="art-star">✦</span>
          <span className="art-label">కథలు · కవిత్వం · భావాలు</span>
        </div>
      </section>
      <section className="paths" aria-label={t("రచనల రకాలు", "Types of work")}>
        {[
          [
            "story",
            "01",
            "కథల లోకం",
            "Stories to read",
            "తెలుగు కథలు, రచనలు",
            "Words to spend time with",
            "అ",
          ],
          [
            "video",
            "02",
            "దృశ్యాల వేదిక",
            "Videos to watch",
            "మాటలు, భావాలు, వీడియోలు",
            "Ideas brought to the screen",
            "▷",
          ],
          [
            "book",
            "03",
            "పుస్తకాలు & ప్రచురణలు",
            "Books & publications",
            "పుస్తకాల వివరాలు",
            "Explore published collections",
            "▤",
          ],
        ].map(([type, n, te, en, descTe, descEn, icon]) => (
          <a key={type} href={"/library?type=" + type}>
            <span className="path-number">{n} /</span>
            <span className="path-icon">{icon}</span>
            <h2>{t(te, en)}</h2>
            <p>{t(descTe, descEn)}</p>
            <span className="path-arrow">↗</span>
          </a>
        ))}
      </section>
      <section className="section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">
              {t("రచనల సంపుటి", "FROM THE LIBRARY")}
            </div>
            <h2>
              {featured.length
                ? t("ఎంపిక చేసిన రచనలు", "Selected works")
                : t("తాజా రచనలు", "The latest chapter")}
            </h2>
          </div>
          <a className="text-link" href="/library">
            {t("అన్నీ చూడండి", "View all works")} →
          </a>
        </div>
        {error ? (
          <Notice error={error} />
        ) : loading ? (
          <p role="status">{t("లోడ్ అవుతోంది…", "Loading…")}</p>
        ) : featured.length || latest.length ? (
          <div className="cards">
            {(featured.length ? featured : latest).slice(0, 6).map((w) => (
              <Card key={w.id} work={w} />
            ))}
          </div>
        ) : (
          <Empty />
        )}
      </section>
      {featured.length > 0 && latest.length > 0 && (
        <section className="section">
          <div className="section-heading">
            <h2>{t("తాజా రచనలు & వీడియోలు", "Latest writing & videos")}</h2>
          </div>
          <div className="cards">
            {latest.slice(0, 3).map((w) => (
              <Card key={w.id} work={w} />
            ))}
          </div>
        </section>
      )}
      {cats.length > 0 && (
        <section className="section">
          <h2>{t("విభాగాల వారీగా", "Browse by category")}</h2>
          <div className="tags">
            {cats.map((c) => (
              <a className="tag" key={c.id} href={"/library?category=" + c.id}>
                {lang === "te" ? c.nameTe : c.nameEn} →
              </a>
            ))}
          </div>
        </section>
      )}
      <section className="channel-banner">
        <span className="channel-mark">▷</span>
        <div>
          <div className="eyebrow">SESHACHANDRA CREATIONS · YOUTUBE</div>
          <h2>
            {t(
              "మరిన్ని కథలు. మరిన్ని ఆలోచనలు.",
              "More stories. More to discover.",
            )}
          </h2>
          <p>
            {t(
              "కొత్త వీడియోల కోసం మా YouTube ఛానల్‌కు సభ్యత్వం పొందండి.",
              "Subscribe to our YouTube channel for new videos.",
            )}
          </p>
        </div>
        <a
          className="button cream"
          href="https://youtube.com/@seshachandracreations1955?sub_confirmation=1"
          target="_blank"
          rel="noreferrer"
        >
          {t("సభ్యత్వం పొందండి", "Subscribe on YouTube")} ↗
        </a>
      </section>
    </>
  );
}
export function Library() {
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState(""),
    [result, setResult] = useState<Results | null>(null),
    [cats, setCats] = useState<Category[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    setQuery(location.search);
    api<Results>("works" + location.search)
      .then(setResult)
      .catch((e) => setError(e.message));
    api<Category[]>("categories")
      .then(setCats)
      .catch((e) => setError(e.message));
  }, []);
  const p = new URLSearchParams(query);
  return (
    <div className="page-wrap">
      <div className="page-heading">
        <div className="eyebrow">
          {t("చదవండి · చూడండి · ఆస్వాదించండి", "READ · WATCH · DISCOVER")}
        </div>
        <h1>{t("రచనల సంపుటి", "The library")}</h1>
        <p>
          {t(
            "కథలు, వీడియోలు, పుస్తకాలు — మీకు నచ్చినవి కనుగొనండి.",
            "Find your next story, video or book.",
          )}
        </p>
      </div>
      <form className="filters" action="/library" key={query}>
        <label className="search-label">
          {t("వెతకండి", "Search")}
          <input
            name="q"
            defaultValue={p.get("q") || ""}
            placeholder={t(
              "శీర్షిక, వివరణ, ట్యాగ్…",
              "Title, description, tag…",
            )}
          />
        </label>
        <label>
          {t("రకం", "Type")}
          <select name="type" defaultValue={p.get("type") || ""}>
            <option value="">{t("అన్ని రకాలు", "All types")}</option>
            <option value="story">{t("కథలు", "Stories")}</option>
            <option value="video">{t("వీడియోలు", "Videos")}</option>
            <option value="book">{t("పుస్తకాలు", "Books")}</option>
          </select>
        </label>
        <label>
          {t("విభాగం", "Category")}
          <select name="category" defaultValue={p.get("category") || ""}>
            <option value="">{t("అన్ని విభాగాలు", "All categories")}</option>
            {cats.map((c) => (
              <option value={c.id} key={c.id}>
                {lang === "te" ? c.nameTe : c.nameEn}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("క్రమం", "Sort")}
          <select name="sort" defaultValue={p.get("sort") || "newest"}>
            <option value="newest">{t("కొత్తవి ముందు", "Newest first")}</option>
            <option value="oldest">{t("పాతవి ముందు", "Oldest first")}</option>
            <option value="title">{t("శీర్షిక", "Title")}</option>
          </select>
        </label>
        <button>{t("చూపించు", "Apply")} →</button>
      </form>
      {error ? (
        <Notice error={error} />
      ) : !result ? (
        <p role="status">{t("లోడ్ అవుతోంది…", "Loading…")}</p>
      ) : (
        <>
          <p className="result-count">
            {result.total} {t("రచనలు", "works")}
            <a href="/library">{t("వడపోతలు తొలగించండి", "Clear filters")}</a>
          </p>
          {result.items.length ? (
            <div className="cards">
              {result.items.map((w) => (
                <Card key={w.id} work={w} />
              ))}
            </div>
          ) : (
            <Empty filtered={!!query} />
          )}
          <div className="pagination">
            {result.page > 1 && (
              <a
                className="button secondary"
                href={
                  "/library?" +
                  new URLSearchParams({
                    ...Object.fromEntries(p),
                    page: String(result.page - 1),
                  })
                }
              >
                ← {t("మునుపటి", "Previous")}
              </a>
            )}
            {result.pages > 0 && (
              <span>
                {t("పేజీ", "Page")} {result.page} / {result.pages}
              </span>
            )}
            {result.page < result.pages && (
              <a
                className="button secondary"
                href={
                  "/library?" +
                  new URLSearchParams({
                    ...Object.fromEntries(p),
                    page: String(result.page + 1),
                  })
                }
              >
                {t("తరువాతి", "Next")} →
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}
export function Reader({
  initial,
  preview = false,
}: {
  initial: Work;
  preview?: boolean;
}) {
  const { t } = useLanguage();
  const [size, setSize] = useState(22),
    [copied, setCopied] = useState(false),
    [shareError, setShareError] = useState(false);
  useEffect(() => {
    try {
      const n = Number(localStorage.getItem("sc-font"));
      if (n >= 18 && n <= 36) setSize(n);
    } catch {}
  }, []);
  function change(n: number) {
    setSize(n);
    try {
      localStorage.setItem("sc-font", String(n));
    } catch {}
  }
  const w = initial;
  return (
    <article className="reader">
      <a className="back" href={preview ? "/admin" : "/library"}>
        ←{" "}
        {preview
          ? t("నిర్వాహక పేజీకి", "Back to admin")
          : t("రచనల సంపుటికి", "Back to library")}
      </a>
      {preview && (
        <div className="notice">
          {t(
            "ముందస్తు వీక్షణ — ముసాయిదాలు ప్రజలకు కనిపించవు.",
            "Preview — drafts are hidden from the public.",
          )}
        </div>
      )}
      <div className="eyebrow">
        {w.type === "story"
          ? t("కథ", "STORY")
          : w.type === "video"
            ? t("వీడియో", "VIDEO")
            : t("పుస్తకం / ప్రచురణ", "BOOK / PUBLICATION")}
      </div>
      <h1>{w.title}</h1>
      {(w.publication || w.publicationDate) && (
        <p className="publication">
          {w.publication}{" "}
          {w.publicationDate && (
            <time dateTime={w.publicationDate}> · {w.publicationDate}</time>
          )}
        </p>
      )}
      {w.description && <p className="lead">{w.description}</p>}
      <div className="reading-controls">
        {w.type === "story" && (
          <div>
            <span>{t("అక్షర పరిమాణం", "Text size")}</span>
            <button
              className="secondary"
              disabled={size <= 18}
              onClick={() => change(size - 2)}
              aria-label={t("అక్షరాలు చిన్నగా", "Decrease text size")}
            >
              A−
            </button>
            <button
              className="secondary"
              disabled={size >= 36}
              onClick={() => change(size + 2)}
              aria-label={t("అక్షరాలు పెద్దగా", "Increase text size")}
            >
              A+
            </button>
          </div>
        )}
        <button
          className="secondary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(
                location.origin + "/work/" + w.slug,
              );
              setCopied(true);
            } catch {
              setShareError(true);
            }
          }}
        >
          {copied
            ? t("లింక్ కాపీ అయింది", "Link copied")
            : t("లింక్ కాపీ చేయండి", "Copy link")}{" "}
          ↗
        </button>
      </div>
      {shareError && (
        <p role="status">
          {t(
            "చిరునామా పట్టీ నుండి లింక్ కాపీ చేయండి.",
            "Copy the link from your address bar.",
          )}
        </p>
      )}
      {w.type === "video" && (
        <>
          <iframe
            className="video-player"
            src={"https://www.youtube-nocookie.com/embed/" + w.youtubeId}
            title={w.title}
            allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
          <a
            className="button secondary"
            href={"https://www.youtube.com/watch?v=" + w.youtubeId}
            target="_blank"
            rel="noreferrer"
          >
            {t("YouTube లో చూడండి", "Watch on YouTube")} ↗
          </a>
        </>
      )}
      {w.coverId && (
        <img
          className="book-cover"
          src={"/api/uploads/" + w.coverId}
          alt={w.title}
        />
      )}
      {w.body && (
        <div className="story-text" style={{ fontSize: size }}>
          {w.body.split("\n").map((line, i) => (
            <p key={i}>{line || "\u00a0"}</p>
          ))}
        </div>
      )}
      {w.attribution && (
        <p className="attribution">
          {t("మూలం / కృతజ్ఞతలు", "Attribution")}: {w.attribution}
        </p>
      )}
      {w.attachmentIds.length > 0 && (
        <section className="attachments">
          <h2>{t("అనుబంధాలు", "Attachments")}</h2>
          {w.attachmentIds.map((id, i) => (
            <a
              className="button secondary"
              key={id}
              href={"/api/uploads/" + id}
              target="_blank"
              rel="noreferrer"
            >
              {t("అనుబంధం తెరవండి", "Open attachment")} {i + 1} ↗
            </a>
          ))}
        </section>
      )}
      {w.externalUrl && (
        <p>
          <a
            className="button"
            href={w.externalUrl}
            target="_blank"
            rel="noreferrer"
          >
            {t("వివరాలు / కొనుగోలు", "Details / purchase")} ↗
          </a>
        </p>
      )}
      <div className="tags">
        {w.tags.map((tag) => (
          <a
            className="tag"
            key={tag}
            href={"/library?q=" + encodeURIComponent(tag)}
          >
            #{tag}
          </a>
        ))}
      </div>
      <p className="language-note">
        {t(
          "భాష ఎంపిక మెనూలను మాత్రమే మారుస్తుంది. రచన అసలు భాషలోనే కనిపిస్తుంది.",
          "The language switch changes the interface. Works remain in their original language.",
        )}
      </p>
    </article>
  );
}
export function About() {
  const { t, lang } = useLanguage();
  const [settings, setSettings] = useState<Settings | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    api<Settings>("settings")
      .then(setSettings)
      .catch((e) => setError(e.message));
  }, []);
  return (
    <div className="page-wrap about">
      <div className="page-heading">
        <div className="eyebrow">{t("రచన వెనుక", "BEHIND THE WORDS")}</div>
        <h1>{t("పరిచయం & సంప్రదింపు", "About & contact")}</h1>
      </div>
      <div className="about-grid">
        <div className="about-emblem" aria-hidden="true">
          శే<span>శేషచంద్ర క్రియేషన్స్</span>
        </div>
        <div>
          <h2>Seshachandra Creations</h2>
          <p className="lead">
            {t(
              "తెలుగు కథలు, రచనలు, వీడియోలను ఒకే చోట అందించే వేదిక.",
              "A home for Telugu stories, writing and videos.",
            )}
          </p>
          {error ? (
            <Notice error={error} />
          ) : !settings ? (
            <p role="status">{t("లోడ్ అవుతోంది…", "Loading…")}</p>
          ) : (
            <>
              {(lang === "te" ? settings.aboutTe : settings.aboutEn) ? (
                <div className="preserve-lines">
                  {lang === "te" ? settings.aboutTe : settings.aboutEn}
                </div>
              ) : (
                <p className="muted">
                  {t(
                    "రచయిత పరిచయం త్వరలో ఇక్కడ అందుబాటులో ఉంటుంది.",
                    "An introduction from the author will be added here.",
                  )}
                </p>
              )}
              <div className="contact-list">
                {settings.email && (
                  <a href={"mailto:" + settings.email}>{settings.email}</a>
                )}
                {settings.phone && <span>{settings.phone}</span>}
                {[
                  ["YouTube", settings.youtubeUrl],
                  ["Instagram", settings.instagramUrl],
                  ["Facebook", settings.facebookUrl],
                ].map(
                  ([label, url]) =>
                    url && (
                      <a
                        key={label}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {label} ↗
                      </a>
                    ),
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
