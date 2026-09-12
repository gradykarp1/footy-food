# Footy Food — Nutrition Planning Build Plan

**Status:** Draft for review
**Created:** 2026-09-12
**Current state:** MVP shipped — photo → nutrition analysis, meal history, daily totals. Running `claude-sonnet-5` on Vercel with Upstash Redis.

---

## Scope

Five use cases, in dependency order:

1. **Game-day nutrition plan** — from general nutritional guidance + athlete preferences.
2. **Weekly nutrition plan** — same inputs, across 3–5 practices + 1 game per week.
3. **Recipes from the plans** — multi-turn conversation about what ingredients we actually have or can get. Simple enough for a kitchen-savvy teen. Bulk-prepped on weekends where possible, some on-the-fly.
4. **Shopping list** — reviewable, shareable to a separate app at `tasks.gradykarp.com`.
5. **Intake review over time** — athlete can add what they ate. Daily macro trends over arbitrary ranges, defaulting to the last 7 days.

---

## Settled decisions

| Decision | Choice | Rationale |
|---|---|---|
| Storage | Supabase Postgres | Range queries for trends, real relationships for plan→recipe→list, preference versioning |
| Auth | Supabase Auth | Closes the currently-open `/api/history` endpoint as a byproduct |
| Guidance input | Multiple PDFs → vision extraction → review/edit → approve | PDFs are graphics-heavy; extraction must be reviewable before it reaches any prompt |
| Guidance conflicts | Detected at review, resolved to a single value | Prompts get one coherent ruleset; decided once rather than re-litigated per plan |
| Roles | One shared login, full access | Family app; no permission boundary to work around later |
| Task app integration | Deferred — export only, adapter stubbed | Only external dependency in the plan; shouldn't block the other four use cases |

---

## Architecture

### Guidance: three layers

The review step and conflict resolution depend on this separation.

```
guidance_documents      source PDFs in Supabase Storage
        │
        │  vision extraction, one call per document
        ▼
extracted_rules         typed rules + prose, editable, with page provenance
extracted_context       and verbatim quotes for audit
        │
        │  review UI — you resolve conflicts across documents
        ▼
active_ruleset          versioned, resolved. The only thing prompts ever see.
```

A bad extraction stops at layer two. Nothing reaches a plan until approved.

### Schema sketch

Not final migrations — shape for review.

```sql
-- Athlete
athlete_profile      (id, name, birthdate, weight_kg, position, notes, updated_at)
schedule_template    (id, day_of_week, activity, typical_start, duration_min)
                     -- default pattern; adjustable per-week at plan generation

-- Guidance (three layers above)
guidance_documents   (id, filename, storage_path, page_count, uploaded_at,
                      extraction_status, extracted_at)
extracted_rules      (id, document_id, nutrient, target_value, unit,
                      basis,           -- per_kg | absolute | percent_of_calories
                      timing_window,   -- e.g. '-3h..-2h', 'post+30m'
                      condition,       -- game_day | training_day | rest_day | any
                      source_page, verbatim_quote, approved, edited)
extracted_context    (id, document_id, section_title, body, approved)
active_ruleset       (id, version, created_at)
active_rules         (id, ruleset_id, nutrient, target_value, unit, basis,
                      timing_window, condition,
                      resolved_from,   -- extracted_rule ids this came from
                      resolution_note)

-- Preferences (versioned: new row per change)
preferences          (id, version, created_at, likes[], dislikes[], allergies[],
                      aversions[], cuisines[], notes)

-- Plans
plans                (id, type,              -- game_day | weekly
                      created_at, ruleset_version, preferences_version,
                      input_params jsonb,    -- kickoff time, that week's schedule
                      content jsonb,         -- the structured plan
                      validation jsonb)      -- rule violations flagged by code

-- Recipes
recipes              (id, plan_id, title, batch_strategy,  -- bulk_weekend | on_the_fly
                      active_time_min, total_time_min, servings,
                      equipment[], ingredients jsonb, steps jsonb, teen_notes)
recipe_chats         (id, plan_id, title, created_at)
recipe_chat_messages (id, chat_id, seq, role, content jsonb, created_at)
pantry_items         (id, name, quantity, unit, updated_at)

-- Shopping
shopping_lists       (id, plan_id, status, created_at)
shopping_list_items  (id, list_id, name, quantity, unit, category,
                      checked, manually_added, source_recipe_ids[])

-- Intake — replaces the Redis meal-history list
meal_log             (id, logged_at, meal_context,
                      source,          -- photo | manual | recipe
                      image_thumb, nutrition jsonb, recipe_id, notes)
```

Typed rules earn their keep twice: conflict detection at review, and a code-level
**validation pass** on generated plans. A plan that comes back under the protein
target gets flagged in `plans.validation` rather than shipping silently.

### Routes

Replaces the current boolean view switching (`if (showHistory)` / `if (results)`),
which is also what makes the 522-line `page.tsx` tractable.

| Route | Purpose |
|---|---|
| `/` | Capture + today's summary |
| `/log` | Manual meal entry |
| `/history` | Meal history |
| `/trends` | Macro trends, date range picker |
| `/plan/game-day` | Generate game-day plan |
| `/plan/weekly` | Generate weekly plan |
| `/plans/[id]` | View a plan |
| `/recipes/[chatId]` | Recipe chat |
| `/shopping/[id]` | Shopping list review |
| `/settings/guidance` | PDF library |
| `/settings/guidance/[docId]/review` | Extraction review + conflict resolution |
| `/settings/preferences` | Preferences editor |
| `/settings/profile` | Athlete profile + schedule template |

---

## Phases

### Phase 0 — Foundation

No user-visible features. Everything depends on it.

- Supabase project, schema, RLS (simple: authenticated = full access)
- Supabase Auth replacing the localStorage flag; all API routes protected
- App Router routes; `page.tsx` split into per-route components
- Migrate existing history out of Redis (≤100 rows)

Two existing bugs folded in, both of which would corrupt intake review:

- Re-analysis results are never saved (`src/app/page.tsx:224-228`) — a corrected meal stores the *original* numbers
- 100-entry history cap (`src/app/api/history/route.ts:24`) — breaks trends over arbitrary ranges

**Done when:** you can log in, capture a photo, and see it in history, with no unauthenticated endpoint remaining and no data lost from the Redis migration.

### Phase 1 — Guidance + preferences

The shared context every downstream feature reads. Extraction quality gates
everything after this, so expect the most iteration here.

- PDF upload to Supabase Storage
- Extraction call per document → `extracted_rules` + `extracted_context`
- Review screen: edit rules and prose, see page provenance and verbatim quotes
- Cross-document conflict detection on approve; resolve to one value
- `active_ruleset` versioning
- Preferences editor (versioned) and athlete profile + schedule template

**Done when:** your real PDFs produce a resolved ruleset you'd be willing to feed a plan.

### Phase 2 — Plans

- **Game-day plan** anchored to kickoff: pre-game, during, post-game recovery windows
- **Weekly plan** across the week's actual schedule, with game day delegating to the game-day logic so the two can't contradict each other
- Structured outputs; code validation against typed rules before save
- Each plan records the ruleset and preference versions that produced it

**Done when:** a generated plan passes rule validation and reads as something you'd actually follow.

### Phase 3 — Recipes + chat

- Recipes generated *from* a plan (plan passed as context, not regenerated independently)
- Each tagged `bulk_weekend` or `on_the_fly`
- Constrained to a kitchen-savvy teen: skill level, real equipment, honest active-time estimates
- Streaming chat, threads persisted server-side so a reload doesn't lose context
- Pantry as a structured input, not buried in chat scrollback

**Done when:** you can chat your way from a plan to a week of recipes using what's in the kitchen.

### Phase 4 — Shopping list

- Derived from recipe `ingredients` in code: dedupe, aggregate quantities, normalize units
- Review UI: check off, edit, add manually
- Clipboard + JSON/markdown export
- Share adapter behind an interface, unimplemented

**Done when:** a plan's recipes produce a list you can shop from, and export cleanly.

### Phase 5 — Intake + trends

- Manual meal entry via text description (new LLM path, no image)
- Log-from-recipe (one tap when they eat something already planned)
- Server-side aggregation over arbitrary ranges, default last 7 days
- Daily macro trend chart

**Done when:** you can review a week of intake that includes photo, manual, and recipe-sourced entries.

---

## LLM call inventory

| Call | Output | Effort | Stream | Cached prefix |
|---|---|---|---|---|
| Photo meal analysis *(exists)* | NutritionData | low | — | — |
| Text meal estimate *(new)* | NutritionData | low | — | — |
| PDF guidance extraction | rules + context | high | — | — |
| Game-day plan | structured plan | high | — | ✓ |
| Weekly plan | structured plan | high | — | ✓ |
| Recipe generation | recipes | medium | — | ✓ |
| Recipe chat turn | text | medium | ✓ | ✓ |
| **Shopping list** | — | — | — | **code, no model** |
| **Trends** | — | — | — | **SQL, no model** |

**Cached prefix** = `active_ruleset` + profile + preferences. Stable across every
plan, recipe, and chat turn. The chat resends it on every message, so that's where
caching pays off most. Multiple PDFs' worth of rules will clear Sonnet 5's
1,024-token minimum cacheable prefix comfortably.

**Structured outputs** everywhere except the chat and the two nutrition-estimate
paths. This eliminates the `JSON.parse` failure class rather than just reporting it
better — which matters far more for nested plan schemas than it did for the flat
nutrition object. Schema constraint to design around: the dialect supports no
recursion and no numeric ranges, so plan structures stay flat-ish.

### Deliberately not using the model

Two places where a model would be the obvious choice and the wrong one:

- **Shopping list** — generated from recipe ingredient arrays in TypeScript. If plans, recipes, and lists were three independent model calls they would drift: the recipe calls for an ingredient the plan didn't, the list misses half of it. Deriving it is cheaper, instant, and provably consistent.
- **Trends** — aggregated in SQL. Asking a model to add up macros is slower, costlier, and occasionally wrong.

---

## Risks

**Extraction quality is the whole ballgame.** Every plan, recipe, and shopping list
inherits it. The review step is the mitigation, but plan on tuning the extraction
prompt against the actual PDFs rather than expecting it to land first try.

**Plan consistency across features.** Mitigated structurally: weekly plan delegates
to game-day logic, recipes take the plan as input, the list derives from recipes.
No feature regenerates what an upstream one already decided.

**Shared login means no attribution.** You won't be able to tell whether you logged
a meal or the athlete did. An optional "logged by" picker can be added later without
touching auth.

**Cost shape shifts.** Today: one `low`-effort vision call per photo. Plan generation
at `high` effort against a large ruleset is a different order of magnitude — still
small for a family, but caching is what keeps a long recipe chat from getting
expensive.

---

## Deferred

- `tasks.gradykarp.com` integration — adapter interface only until the API shape is known
- Per-meal attribution
- Hydration reminders, match-day vs training-day app mode, shareable summary card (all still listed as post-MVP in `claude.md`)
- Training calendar integration beyond the schedule template

---

## Open for markup

Things I'd most like pushback on:

1. **Rule granularity** — is `(nutrient, basis, timing_window, condition)` the right key for a rule? It determines what counts as a conflict. Too coarse and unrelated rules collide; too fine and real contradictions slip through.
2. **Schedule template vs. per-week entry** — I've assumed a default weekly pattern you adjust when generating. If practices are too irregular for a template to help, per-week entry only is simpler.
3. **Phase 5 placement** — intake review is independent of plans and could run parallel to Phase 2–4 if it's the feature you'd use soonest.
4. **Recipe chat scope** — currently one chat thread per plan. Alternative is a single long-running kitchen conversation not tied to any plan.
