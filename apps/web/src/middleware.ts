import { NextResponse, type NextRequest } from "next/server";

/**
 * Subdomain router.
 *
 * `explorer.trypact.xyz` is a marketing-distinct surface that internally
 * lives at `/explore` in the same Next app — the same fonts, tokens, and
 * components carry over without a duplicate deploy. Only the root path
 * is rewritten; deeper routes (e.g. `/jobs/123`, `/marketplace/2`) stay
 * canonical so a judge can paste any URL between subdomains and it works.
 *
 * Future: when explorer grows page-specific copy or layout, we can scope
 * more paths here instead of forking into `apps/explorer`.
 */
export function middleware(request: NextRequest) {
  const host = (request.headers.get("host") ?? "").toLowerCase();

  if (host.startsWith("explorer.") && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/explore";
    return NextResponse.rewrite(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Only match the root path; everything else passes through untouched.
    "/",
  ],
};
