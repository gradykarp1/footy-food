import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a sports nutrition assistant helping a young soccer athlete understand the nutritional content of their meals.

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
    "summary": "One sentence on how well this meal supports soccer performance"
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
    const { image, mediaType, mealContext } = await request.json();

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

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1500,
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
                text: `Meal context: ${mealContext || "not specified"}`,
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

    // Parse the JSON response from Claude
    try {
      const nutritionData = JSON.parse(textContent.text);
      return NextResponse.json(nutritionData);
    } catch {
      console.error("Failed to parse Claude response:", textContent.text);
      return NextResponse.json(
        { error: "Invalid response format from API" },
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
