import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";
import { MealHistoryEntry } from "@/types/nutrition";

// Get Redis credentials (support multiple naming conventions)
const redisUrl =
  process.env.footy_food_KV_REST_API_URL ||
  process.env.KV_REST_API_URL ||
  process.env.UPSTASH_REDIS_REST_URL ||
  "";
const redisToken =
  process.env.footy_food_KV_REST_API_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.UPSTASH_REDIS_REST_TOKEN ||
  "";

// Initialize Redis client
const redis = new Redis({
  url: redisUrl,
  token: redisToken,
});

const HISTORY_KEY = "meal-history";
const MAX_HISTORY_ITEMS = 100;

export async function GET() {
  try {
    if (!redisUrl || !redisToken) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const history = await redis.lrange<MealHistoryEntry>(HISTORY_KEY, 0, -1);
    return NextResponse.json(history || []);
  } catch (error) {
    console.error("Failed to fetch history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  console.log("POST /api/history called");
  console.log("redisUrl exists:", !!redisUrl);
  console.log("redisToken exists:", !!redisToken);

  try {
    if (!redisUrl || !redisToken) {
      console.log("Database not configured - missing credentials");
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const entry: MealHistoryEntry = await request.json();
    console.log("Received entry with id:", entry.id);

    // Validate entry
    if (!entry.id || !entry.timestamp || !entry.nutritionData) {
      console.log("Invalid entry - missing required fields");
      return NextResponse.json(
        { error: "Invalid meal entry" },
        { status: 400 }
      );
    }

    // Add to beginning of list (most recent first)
    console.log("Attempting to save to Redis...");
    await redis.lpush(HISTORY_KEY, entry);
    console.log("Saved to Redis successfully");

    // Trim to max items
    await redis.ltrim(HISTORY_KEY, 0, MAX_HISTORY_ITEMS - 1);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save meal:", error);
    return NextResponse.json(
      { error: "Failed to save meal", details: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!redisUrl || !redisToken) {
      return NextResponse.json(
        { error: "Database not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { error: "Missing meal ID" },
        { status: 400 }
      );
    }

    // Get all history
    const history = await redis.lrange<MealHistoryEntry>(HISTORY_KEY, 0, -1);

    // Find and remove the entry with matching ID
    const entryToRemove = history?.find((entry) => entry.id === id);
    if (entryToRemove) {
      await redis.lrem(HISTORY_KEY, 1, entryToRemove);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete meal:", error);
    return NextResponse.json(
      { error: "Failed to delete meal" },
      { status: 500 }
    );
  }
}
