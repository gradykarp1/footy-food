import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

export async function GET() {
  // Check which env vars are available (don't expose actual values)
  const envCheck = {
    footy_food_KV_REST_API_URL: !!process.env.footy_food_KV_REST_API_URL,
    KV_REST_API_URL: !!process.env.KV_REST_API_URL,
    UPSTASH_REDIS_REST_URL: !!process.env.UPSTASH_REDIS_REST_URL,
    footy_food_KV_REST_API_TOKEN: !!process.env.footy_food_KV_REST_API_TOKEN,
    KV_REST_API_TOKEN: !!process.env.KV_REST_API_TOKEN,
    UPSTASH_REDIS_REST_TOKEN: !!process.env.UPSTASH_REDIS_REST_TOKEN,
  };

  // Try to connect to Redis
  let redisTest = { success: false, error: "", listLength: 0 };

  const redisUrl = process.env.footy_food_KV_REST_API_URL || "";
  const redisToken = process.env.footy_food_KV_REST_API_TOKEN || "";

  if (redisUrl && redisToken) {
    try {
      const redis = new Redis({ url: redisUrl, token: redisToken });
      // Try a simple operation
      const length = await redis.llen("meal-history");
      redisTest = { success: true, error: "", listLength: length };
    } catch (err) {
      redisTest = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        listLength: 0
      };
    }
  } else {
    redisTest = { success: false, error: "Missing URL or token", listLength: 0 };
  }

  return NextResponse.json({
    message: "Environment variable check",
    envCheck,
    redisTest,
  });
}
