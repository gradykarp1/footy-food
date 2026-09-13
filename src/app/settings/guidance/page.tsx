"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import AppHeader from "@/components/AppHeader";
import { createClient } from "@/lib/supabase/client";

interface GuidanceDocument {
  id: string;
  filename: string;
  storage_path: string;
  page_count: number | null;
  extraction_status: "pending" | "extracting" | "extracted" | "failed";
  extraction_error: string | null;
  extraction_cursor: number;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-card border-card-border text-muted",
  extracting: "bg-blue-500/15 border-blue-500/30 text-blue-300",
  extracted: "bg-green-500/15 border-green-500/30 text-green-300",
  failed: "bg-red-500/15 border-red-500/30 text-red-300",
};

export default function GuidancePage() {
  const [docs, setDocs] = useState<GuidanceDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("guidance_documents")
      .select("*")
      .order("created_at", { ascending: false });
    setDocs((data as GuidanceDocument[]) ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);

    try {
      const supabase = createClient();
      // Straight to Storage from the browser. Routing a 187MB file through a
      // serverless function would exceed its request body limit.
      const path = `${crypto.randomUUID()}/${file.name}`;
      const { error: upErr } = await supabase.storage
        .from("guidance")
        .upload(path, file, { contentType: "application/pdf" });
      if (upErr) throw new Error(upErr.message);

      const { error: insErr } = await supabase
        .from("guidance_documents")
        .insert({ filename: file.name, storage_path: path });
      if (insErr) throw new Error(insErr.message);

      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  /**
   * Drives extraction one chunk at a time. The server can't do the whole
   * document in a single request without blowing the function timeout, so the
   * loop lives here — which is also what makes progress visible.
   */
  const runExtraction = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      for (let guard = 0; guard < 200; guard++) {
        const res = await fetch("/api/guidance/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentId: id }),
        });

        // A function timeout returns a plain-text error page, not JSON. Reading
        // it as JSON turns "the chunk took too long" into an unreadable parse
        // error, so decode defensively and say what actually happened.
        const raw = await res.text();
        let body: { done?: boolean; error?: string };
        try {
          body = JSON.parse(raw);
        } catch {
          throw new Error(
            res.status === 504 || /timed out|TIMEOUT/i.test(raw)
              ? "That chunk exceeded the server time limit. Press Resume — pages already read are saved."
              : `Server returned ${res.status}. ${raw.slice(0, 200)}`
          );
        }

        if (!res.ok) throw new Error(body.error || "Extraction failed");
        await refresh();
        if (body.done) break;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed");
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  /** Resolves every approved rule, across all documents, into a new version. */
  const publish = async () => {
    setPublishing(true);
    setError(null);
    setPublished(null);
    try {
      const res = await fetch("/api/guidance/publish", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Publish failed");
      setPublished(
        `Published v${body.version} — ${body.rules} rules, ${body.modifiers} modifiers.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = async (doc: GuidanceDocument) => {
    setBusyId(doc.id);
    try {
      const supabase = createClient();
      await supabase.storage.from("guidance").remove([doc.storage_path]);
      await supabase.from("guidance_documents").delete().eq("id", doc.id);
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-dvh bg-background">
      <div className="max-w-md mx-auto px-4 py-6">
        <AppHeader historyCount={0} showHistoryLink={false} />

        <Link
          href="/settings"
          className="text-xs text-muted hover:text-foreground transition-colors"
        >
          ← Settings
        </Link>

        <div className="mb-6 mt-2">
          <h2 className="text-2xl font-bold text-foreground">Guidance</h2>
          <p className="text-sm text-muted">
            Nutrition documents that plans are built from
          </p>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          onChange={handleUpload}
          className="sr-only"
          aria-label="Upload a guidance PDF"
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full py-3 mb-4 bg-accent text-background rounded-xl font-medium disabled:opacity-50 hover:bg-accent-muted transition-colors flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-background border-t-transparent rounded-full animate-spin" />
              Uploading...
            </>
          ) : (
            "Upload a PDF"
          )}
        </button>

        {docs.length > 0 && (
          <Link
            href="/settings/guidance/rationalize"
            className="block w-full py-3 mb-3 bg-card border border-card-border rounded-xl text-sm font-medium text-foreground text-center hover:border-accent/50 transition-colors"
          >
            Rationalize duplicate rules
          </Link>
        )}

        {docs.length > 0 && (
          <button
            onClick={publish}
            disabled={publishing}
            className="w-full py-3 mb-4 bg-card border border-card-border rounded-xl text-sm font-medium text-foreground hover:border-accent/50 transition-colors disabled:opacity-50"
          >
            {publishing
              ? "Publishing..."
              : "Publish approved rules to the active ruleset"}
          </button>
        )}

        {published && (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-3 mb-4">
            <p className="text-green-300 text-sm">{published}</p>
          </div>
        )}

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
            <p className="text-red-400 text-sm whitespace-pre-wrap break-words">
              {error}
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : docs.length === 0 ? (
          <p className="text-muted text-sm text-center py-12">
            No documents yet. Upload the PDFs your plans should follow.
          </p>
        ) : (
          <div className="space-y-3">
            {docs.map((doc) => {
              const pct =
                doc.page_count && doc.page_count > 0
                  ? Math.round((doc.extraction_cursor / doc.page_count) * 100)
                  : 0;
              const busy = busyId === doc.id;

              return (
                <div
                  key={doc.id}
                  className="bg-card border border-card-border rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-foreground text-sm break-words flex-1">
                      {doc.filename}
                    </h3>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${
                        STATUS_STYLES[doc.extraction_status]
                      }`}
                    >
                      {doc.extraction_status}
                    </span>
                  </div>

                  <p className="text-xs text-muted mt-1">
                    {doc.page_count
                      ? `${doc.extraction_cursor} of ${doc.page_count} pages read`
                      : "Page count unknown until extraction starts"}
                  </p>

                  {doc.page_count ? (
                    <div className="h-1.5 bg-background rounded-full mt-2 overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null}

                  {doc.extraction_error && (
                    <p className="text-xs text-red-400 mt-2 break-words">
                      {doc.extraction_error}
                    </p>
                  )}

                  <div className="flex gap-2 mt-3">
                    {doc.extraction_status !== "extracted" && (
                      <button
                        onClick={() => runExtraction(doc.id)}
                        disabled={busy}
                        className="flex-1 py-2 bg-accent text-background rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-accent-muted transition-colors"
                      >
                        {busy
                          ? "Reading..."
                          : doc.extraction_cursor > 0
                            ? "Resume"
                            : "Extract"}
                      </button>
                    )}
                    {doc.extraction_cursor > 0 && (
                      <Link
                        href={`/settings/guidance/${doc.id}/review`}
                        className="flex-1 py-2 text-center bg-background border border-card-border rounded-lg text-sm font-medium text-foreground hover:border-accent/50 transition-colors"
                      >
                        Review
                      </Link>
                    )}
                    <button
                      onClick={() => handleDelete(doc)}
                      disabled={busy}
                      className="px-3 py-2 text-muted hover:text-red-400 transition-colors text-sm disabled:opacity-50"
                      aria-label={`Delete ${doc.filename}`}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
