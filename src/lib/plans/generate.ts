import { GAME_DAY_SCHEMA, WEEKLY_SCHEMA } from "./schema";

export class PlanError extends Error {}

const SHARED_RULES = `You build nutrition plans for one specific teenage soccer player, from guidance their parent has provided.

Ground every recommendation in the guidance context above. Where it gives a numeric target, hit it — those are checked in code after you answer, and a plan that misses one is flagged to the parent.

Absolute constraints:
- Never include a listed allergen, or any dish that ordinarily contains one.
- Never suggest a food on the "won't eat" list. Preferences are not obstacles to work around; a technically optimal plan he refuses to eat is a failed plan.
- Fill in targets for every meal or window. A null target means "this moment genuinely has no target for that nutrient", not "I didn't work it out".

Tone: you are writing for a parent and a teenager, not a clinician. Be concrete about foods and portions. Never frame anything as restriction or as a warning about weight — focus on what to add and why it helps him play better.`;

interface CallOpts {
  apiKey: string;
  context: string;
  request: string;
  schema: object;
}

async function callModel({ apiKey, context, request, schema }: CallOpts) {
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
      // Planning is multi-step reasoning against numeric constraints, so it
      // gets high effort where photo analysis gets low.
      output_config: { effort: "high", format: { type: "json_schema", schema } },
      system: [
        { type: "text", text: SHARED_RULES },
        {
          type: "text",
          text: context,
          // Stable across every plan, recipe and chat turn — cache it here and
          // keep the varying request in the user turn, after this breakpoint.
          cache_control: { type: "ephemeral" },
        },
      ],
      messages: [{ role: "user", content: [{ type: "text", text: request }] }],
    }),
  });

  if (!response.ok) {
    throw new PlanError(
      `Anthropic API ${response.status}: ${(await response.text()).slice(0, 300)}`
    );
  }

  const data = await response.json();
  if (data.stop_reason === "max_tokens") {
    throw new PlanError("Plan was truncated before it finished.");
  }
  if (data.stop_reason === "refusal") {
    throw new PlanError("Request was declined by safety classifiers.");
  }

  const text = data.content?.find((b: { type: string }) => b.type === "text")?.text;
  if (!text) throw new PlanError("No content returned.");

  try {
    return {
      plan: JSON.parse(text),
      usage: data.usage as Record<string, number>,
    };
  } catch {
    throw new PlanError(`Unparseable plan: ${String(text).slice(0, 300)}`);
  }
}

export function generateGameDayPlan(opts: {
  apiKey: string;
  context: string;
  kickoffTime: string;
  notes?: string;
}) {
  const request = `Build a game-day fuelling plan.

Kickoff: ${opts.kickoffTime}
${opts.notes ? `Context for this particular game: ${opts.notes}` : ""}

Work backwards and forwards from the match, one window per distinct moment the guidance identifies — the full meal hours before, the top-off closer in, the fast fuel just before, anything during, and recovery afterwards.

Set relative_to for every window: "kickoff" for anything before or during the match, "final_whistle" for anything after it. Then set offset_min_minutes and offset_max_minutes as minutes from that point — so a recovery snack half an hour after the match ends is relative_to "final_whistle" with offsets 0 to 30, NOT offsets measured from kickoff. State real clock times in the labels too, assuming a 90-minute match, so nobody has to do arithmetic on the day.

If any guidance modifier could apply — heat, a long match, a short turnaround between games — cover it in watch_outs rather than silently assuming it does or doesn't.`;

  return callModel({
    apiKey: opts.apiKey,
    context: opts.context,
    request,
    schema: GAME_DAY_SCHEMA,
  });
}

export function generateWeeklyPlan(opts: {
  apiKey: string;
  context: string;
  weekStarting: string;
  schedule: string;
  notes?: string;
}) {
  const request = `Build a week of fuelling.

Week starting: ${opts.weekStarting}
Schedule:
${opts.schedule}
${opts.notes ? `\nContext for this week: ${opts.notes}` : ""}

Cover every day, including rest days. Match each day's meals to what that day actually demands — a day with an evening practice is fuelled differently from a rest day, and a game day follows the game-day timing from the guidance rather than a generic template.

Mark batch_prep true for anything that can be made in bulk at the weekend, and use batch_prep_plan to say what to cook on which day. He is a capable teenager cooking for himself on weeknights, so weekday items should be assemble-not-cook wherever the guidance allows.`;

  return callModel({
    apiKey: opts.apiKey,
    context: opts.context,
    request,
    schema: WEEKLY_SCHEMA,
  });
}
