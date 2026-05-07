const REALM = "Meds Database";

function unauthorized() {
  return new Response("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": `Basic realm="${REALM}", charset="UTF-8"`,
      "Cache-Control": "no-store",
    },
  });
}

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let index = 0; index < a.length; index += 1) {
    result |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return result === 0;
}

function decodeBasicAuth(header: string | null) {
  if (!header?.startsWith("Basic ")) return null;

  try {
    const decoded = atob(header.slice("Basic ".length));
    const separator = decoded.indexOf(":");
    if (separator === -1) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

export const config = {
  matcher: ["/((?!favicon.ico).*)"],
};

export default function middleware(request: Request) {
  const username = process.env.SITE_AUTH_USERNAME;
  const password = process.env.SITE_AUTH_PASSWORD;

  if (!username || !password) {
    return;
  }

  const credentials = decodeBasicAuth(request.headers.get("authorization"));
  if (
    credentials &&
    timingSafeEqual(credentials.username, username) &&
    timingSafeEqual(credentials.password, password)
  ) {
    return;
  }

  return unauthorized();
}
