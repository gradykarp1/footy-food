import { NextRequest, NextResponse } from "next/server";
import { NUTRITION_SCHEMA } from "@/lib/nutritionSchema";

const SYSTEM_PROMPT = `You are a sports nutrition assistant helping a young soccer athlete understand the nutritional content of their meals.

The user will provide a meal context (e.g., "pre-match", "post-match", "pre-training", "post-training", "rest-day", or "just-curious"). Use this context to tailor your soccer_performance_rating score and summary:

- **Pre-match/Pre-training**: Prioritize easily digestible carbohydrates for energy, moderate protein, lower fat/fiber to avoid digestive discomfort. Score higher for carb-rich, low-fat meals.
- **Post-match/Post-training**: Prioritize protein for muscle recovery, carbohydrates to replenish glycogen, and hydration. Score higher for protein-rich meals with good carbs.
- **Rest-day**: Prioritize balanced nutrition with adequate protein for recovery, healthy fats, vitamins, and minerals. Moderate portions are fine.
- **Just-curious**: Provide a general balanced assessment without specific timing considerations.

When given a food image, respond ONLY with a valid JSON object in this exact structure — no markdown, no explanation outside the JSON:

{
  "meal_title": "Brief descriptive name for the meal",
  "foods_identified": ["item1", "item2"],
  "confidence": "high | medium | low",
  "calories": { "estimate": 000, "range": "000–000" },
  "macronutrients": {
    "protein_g": 0,
    "carbohydrates_g": 0,
    "fat_g": 0,
    "fiber_g": 0,
    "sugar_g": 0
  },
  "micronutrients": {
    "vitamin_c_mg": 0,
    "vitamin_d_iu": 0,
    "calcium_mg": 0,
    "iron_mg": 0,
    "potassium_mg": 0,
    "magnesium_mg": 0,
    "sodium_mg": 0,
    "b12_mcg": 0,
    "folate_mcg": 0
  },
  "hydration_note": "Any notable water content or hydration considerations",
  "soccer_performance_rating": {
    "score": 0,
    "out_of": 10,
    "summary": "One sentence explaining how well this meal supports soccer performance FOR THE SPECIFIED MEAL CONTEXT"
  },
  "meal_timing_feedback": {
    "pre_match": "...",
    "post_match": "...",
    "rest_day": "..."
  },
  "what_this_meal_does_well": ["strength 1", "strength 2"],
  "what_to_add_next_time": ["suggestion 1", "suggestion 2"],
  "disclaimer": "Estimates are based on visual analysis. For precise tracking, consult a registered sports dietitian."
}`;

export async function POST(request: NextRequest) {
  try {
    const { image, mediaType, mealContext, ingredients } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "No image provided" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "API key not configured" },
        { status: 500 }
      );
    }

    // Build the user message text
    let userText = `Meal context: ${mealContext || "not specified"}`;

    // If ingredients are provided, instruct the model to use them
    if (ingredients && Array.isArray(ingredients) && ingredients.length > 0) {
      userText += `\n\nThe user has confirmed/corrected the ingredients in this meal. Use this exact list of ingredients for your analysis (do not add or remove items): ${ingredients.join(", ")}`;
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
        // Sonnet 5 thinks by default, and max_tokens caps thinking + response
        // together, so the budget needs headroom beyond the JSON payload.
        max_tokens: 8000,
        output_config: {
          effort: "low",
          // Constrains the response to the schema. Without this the model can
          // wrap its JSON in a markdown fence or open with a sentence, both of
          // which break JSON.parse no matter what the prompt asks for.
          format: { type: "json_schema", schema: NUTRITION_SCHEMA },
        },
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: mediaType || "image/jpeg",
                  data: image,
                },
              },
              {
                type: "text",
                text: userText,
              },
            ],
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Anthropic API error:", errorData);
      return NextResponse.json(
        { error: "Failed to analyze image" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Truncation and refusals both produce unparseable output — report them
    // distinctly instead of as a generic format error.
    if (data.stop_reason === "max_tokens") {
      console.error("Response truncated — max_tokens too low");
      return NextResponse.json(
        { error: "Analysis got cut off. Give it another try." },
        { status: 500 }
      );
    }

    if (data.stop_reason === "refusal") {
      console.error("Request refused:", data.stop_details);
      return NextResponse.json(
        { error: "Couldn't analyze that photo. Try a different shot." },
        { status: 400 }
      );
    }

    // Extract the text content from Claude's response
    const textContent = data.content?.find(
      (block: { type: string }) => block.type === "text"
    );

    if (!textContent?.text) {
      return NextResponse.json(
        { error: "No response from API" },
        { status: 500 }
      );
    }

    // Parse the JSON response from Claude. output_config.format should make
    // this unconditional, but strip a markdown fence first as a cheap guard.
    const raw: string = textContent.text.trim();
    const unfenced = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");

    try {
      return NextResponse.json(JSON.parse(unfenced));
    } catch {
      console.error("Failed to parse Claude response:", raw);
      return NextResponse.json(
        {
          error: "Analysis came back in an unexpected format. Try again.",
          // Surfaced to the client so a failure on a phone is diagnosable
          // without tailing server logs.
          detail: raw.slice(0, 300),
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Server error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
