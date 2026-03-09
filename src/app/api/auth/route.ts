import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { name, pin } = await request.json();

    const validName = process.env.AUTH_NAME;
    const validPin = process.env.AUTH_PIN;

    if (!validName || !validPin) {
      console.error("Auth credentials not configured");
      return NextResponse.json(
        { error: "Authentication not configured" },
        { status: 500 }
      );
    }

    // Case-insensitive name comparison, exact PIN match
    if (
      name.toLowerCase().trim() === validName.toLowerCase().trim() &&
      pin === validPin
    ) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { error: "Invalid name or PIN" },
      { status: 401 }
    );
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
