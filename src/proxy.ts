import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Next 16 renamed the `middleware` file convention to `proxy`.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  // Everything except Next internals and static assets. /api is intentionally
  // included so route handlers are gated too.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
