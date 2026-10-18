import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const SIGNED_OUT_ONLY = ["/login", "/signup"];
const SIGNED_IN_ONLY = ["/dashboard", "/onboarding", "/matches", "/requests", "/payitforward", "/college", "/profile", "/people", "/opportunities", "/network", "/invites", "/messages", "/notifications", "/announcements"];

const matches = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/** Refreshes the Supabase session cookie and applies optimistic route guards. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // getUser() validates the token with Supabase; never trust the cookie alone.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const redirectTo = (to: string) => {
    const url = request.nextUrl.clone();
    url.pathname = to;
    url.search = "";
    const redirect = NextResponse.redirect(url);
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!user && matches(path, SIGNED_IN_ONLY)) return redirectTo("/login");
  if (user && matches(path, SIGNED_OUT_ONLY)) return redirectTo("/dashboard");

  return response;
}
