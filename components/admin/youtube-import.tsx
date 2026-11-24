"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useLanguage } from "../shell";
import { Flash, PageHeader, useAction } from "./common";

export function YoutubeImport({ keyConfigured }: { keyConfigured: boolean }) {
  const { t } = useLanguage();
  const router = useRouter();
  const { busy, error, notice, run } = useAction();
  const [cursor, setCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  return (
    <>
      <PageHeader
        eyebrow={t("నిర్వహణ", "ADMINISTRATION")}
        title={t("YouTube దిగుమతి", "YouTube import")}
      />
      <Flash error={error} notice={notice} />
      <section className="adm-card">
        <h2>@seshachandracreations1955</h2>
        <p>
          {t(
            "ఒక్కోసారి 50 వీడియోల వరకు ముసాయిదాలుగా దిగుమతి అవుతాయి. ఇప్పటికే ఉన్న వీడియోలు, మీ సవరణలు మారవు.",
            "Imports up to 50 videos at a time as drafts. Videos already on the site and your edits are left unchanged.",
          )}
        </p>
        {!keyConfigured && (
          <div className="notice">
            {t(
              "YOUTUBE_API_KEY అమర్చలేదు. దిగుమతి పనిచేయదు; వీడియోలను 'కొత్త రచన' ద్వారా నేరుగా జోడించవచ్చు.",
              "YOUTUBE_API_KEY is not set, so import is unavailable. You can still add videos one by one with New work.",
            )}
          </div>
        )}
        <div className="editor-actions">
          <button
            disabled={busy || !keyConfigured}
            onClick={() =>
              void run(async () => {
                const r = await api<{
                  imported: number;
                  skipped: number;
                  nextCursor: string | null;
                }>("import", {
                  method: "POST",
                  body: JSON.stringify({ cursor }),
                });
                setCursor(r.nextCursor);
                setTotal((n) => n + r.imported);
                router.refresh();
                return `${t("కొత్తవి", "New")}: ${r.imported}. ${t("ఇప్పటికే ఉన్నవి", "Already present")}: ${r.skipped}. ${
                  r.nextCursor
                    ? t("మరిన్ని వీడియోలు ఉన్నాయి.", "More videos are available.")
                    : t("ఛానల్ చివరికి చేరారు.", "Reached the end of the channel.")
                }`;
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
          {total > 0 && (
            <Link className="button secondary" href="/admin/works?status=draft&type=video">
              {t("దిగుమతి అయిన ముసాయిదాలు", "Review imported drafts")} →
            </Link>
          )}
        </div>
      </section>
    </>
  );
}
