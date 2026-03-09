import { NextResponse } from "next/server";

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

  return NextResponse.json({
    message: "Environment variable check",
    envCheck,
    hint: "Values show true if the env var exists, false if not",
  });
}
