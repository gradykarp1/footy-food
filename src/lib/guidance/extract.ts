import { extractText, getDocumentProxy } from "unpdf";
import { EXTRACTION_SCHEMA, ExtractionResult } from "./schema";
import { EXTRACTION_SYSTEM_PROMPT } from "./prompt";

/**
 * Per-page text. Pure JS rather than shelling out to pdftotext, which exists on
 * a dev machine via Homebrew but not in a serverless runtime.
 */
export async function pdfToPages(data: Uint8Array): Promise<string[]> {
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  return text;
}

/** Page markers are what let the model attribute a rule to a source page. */
export function markPages(pages: string[], startIndex: number): string {
  return pages
    .map((body, i) => `=== PAGE ${startIndex + i + 1} ===\n${body}`)
    .join("\n\n");
}

export class ExtractionError extends Error {}

/**
 * Extract one chunk of pages. Chunked because a long document at high effort
 * will not finish inside Vercel Hobby's 60s function ceiling, and because a
 * failure then costs one chunk rather than the whole document.
 */
export async function extractChunk(opts: {
  apiKey: string;
  documentTitle: string;
  pages: string[];
  startIndex: number;
}): Promise<ExtractionResult> {
  const { apiKey, documentTitle, pages, startIndex } = opts;
  const body = markPages(pages, startIndex);

  // Pages that are pure imagery extract to nothing. Skip the call rather than
  // pay for a request that can only return empty arrays.
  if (body.replace(/=== PAGE \d+ ===/g, "").trim().length === 0) {
    return { rules: [], options: [], context: [], low_confidence_pages: [] };
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      // Extraction is the hardest reasoning task in the app and runs once per
      // document, so it gets high effort where meal analysis gets low.
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: EXTRACTION_SCHEMA },
      },
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Document: "${documentTitle}"\n\n${body}`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new ExtractionError(
      `Anthropic API ${response.status}: ${(await response.text()).slice(0, 300)}`
    );
  }

  const data = await response.json();

  if (data.stop_reason === "max_tokens") {
    throw new ExtractionError(
      "Extraction truncated — reduce chunk_size for this document."
    );
  }
  if (data.stop_reason === "refusal") {
    throw new ExtractionError("Extraction refused by safety classifiers.");
  }

  const text = data.content?.find(
    (b: { type: string }) => b.type === "text"
  )?.text;
  if (!text) throw new ExtractionError("No content returned.");

  try {
    return JSON.parse(text) as ExtractionResult;
  } catch {
    throw new ExtractionError(
      `Unparseable extraction output: ${String(text).slice(0, 300)}`
    );
  }
}
