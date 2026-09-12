import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractChunk, pdfToPages, ExtractionError } from "@/lib/guidance/extract";

// Give the chunk as much of Vercel Hobby's 60s ceiling as possible.
export const maxDuration = 60;

/**
 * Extracts ONE chunk of pages and advances the cursor. The client calls this
 * repeatedly until `done` is true, which keeps each invocation inside the
 * function timeout and gives the UI real progress to show.
 */
export async function POST(request: NextRequest) {
  try {
    const { documentId } = await request.json();
    if (!documentId) {
      return NextResponse.json({ error: "Missing documentId" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const supabase = await createClient();

    const { data: doc, error: docError } = await supabase
      .from("guidance_documents")
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 });
    }

    const { data: file, error: fileError } = await supabase.storage
      .from("guidance")
      .download(doc.storage_path);

    if (fileError || !file) {
      return NextResponse.json(
        { error: `Could not read stored file: ${fileError?.message}` },
        { status: 500 }
      );
    }

    const pages = await pdfToPages(new Uint8Array(await file.arrayBuffer()));

    // page_count is unknown until the first chunk parses the file.
    if (doc.page_count !== pages.length) {
      await supabase
        .from("guidance_documents")
        .update({ page_count: pages.length })
        .eq("id", documentId);
    }

    const start = doc.extraction_cursor ?? 0;
    if (start >= pages.length) {
      return NextResponse.json({
        done: true,
        cursor: start,
        pageCount: pages.length,
      });
    }

    const end = Math.min(start + (doc.chunk_size ?? 8), pages.length);

    await supabase
      .from("guidance_documents")
      .update({ extraction_status: "extracting", extraction_error: null })
      .eq("id", documentId);

    let result;
    try {
      result = await extractChunk({
        apiKey,
        documentTitle: doc.filename,
        pages: pages.slice(start, end),
        startIndex: start,
      });
    } catch (err) {
      const message =
        err instanceof ExtractionError ? err.message : "Extraction failed";
      // Leave the cursor where it is so a retry resumes this chunk rather than
      // skipping it or redoing work already persisted.
      await supabase
        .from("guidance_documents")
        .update({ extraction_status: "failed", extraction_error: message })
        .eq("id", documentId);
      return NextResponse.json({ error: message }, { status: 502 });
    }

    // Persist rules first so modifiers can reference the ids they belong to.
    if (result.rules.length > 0) {
      const { data: inserted, error } = await supabase
        .from("extracted_rules")
        .insert(
          result.rules.map((r) => ({
            document_id: documentId,
            kind: r.kind,
            nutrient: r.nutrient,
            value_min: r.value_min,
            value_max: r.value_max,
            unit: r.unit,
            basis: r.basis,
            anchor: r.anchor,
            direction: r.direction,
            offset_min_minutes: r.offset_min_minutes,
            offset_max_minutes: r.offset_max_minutes,
            condition: r.condition,
            source_page: r.source_page,
            verbatim_quote: r.verbatim_quote,
          }))
        )
        .select("id");

      if (error) {
        return NextResponse.json(
          { error: `Saving rules failed: ${error.message}` },
          { status: 500 }
        );
      }

      const modifiers = result.rules.flatMap((rule, i) =>
        rule.modifiers.map((m) => ({
          rule_id: inserted![i].id,
          trigger: m.trigger,
          value_min: m.value_min,
          value_max: m.value_max,
          unit: m.unit,
          note: m.note,
          verbatim_quote: m.verbatim_quote,
        }))
      );
      if (modifiers.length > 0) {
        await supabase.from("rule_modifiers").insert(modifiers);
      }
    }

    if (result.options.length > 0) {
      await supabase.from("extracted_options").insert(
        result.options.map((o) => ({ document_id: documentId, ...o }))
      );
    }
    if (result.context.length > 0) {
      await supabase.from("extracted_context").insert(
        result.context.map((c) => ({ document_id: documentId, ...c }))
      );
    }
    if (result.low_confidence_pages.length > 0) {
      await supabase.from("low_confidence_pages").insert(
        result.low_confidence_pages.map((p) => ({
          document_id: documentId,
          ...p,
        }))
      );
    }

    const done = end >= pages.length;
    await supabase
      .from("guidance_documents")
      .update({
        extraction_cursor: end,
        extraction_status: done ? "extracted" : "extracting",
        ...(done ? { extracted_at: new Date().toISOString() } : {}),
      })
      .eq("id", documentId);

    return NextResponse.json({
      done,
      cursor: end,
      pageCount: pages.length,
      counts: {
        rules: result.rules.length,
        options: result.options.length,
        context: result.context.length,
        lowConfidence: result.low_confidence_pages.length,
      },
    });
  } catch (error) {
    console.error("Extraction route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
