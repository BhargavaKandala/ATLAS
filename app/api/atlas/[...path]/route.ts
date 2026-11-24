import { authEnabled, localOrigin, prepareAuth } from "@/lib/auth";

export const runtime = "nodejs";

async function forward(request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const secured = authEnabled();
  const expected = secured ? new URL(process.env.BETTER_AUTH_URL ?? request.url).origin : localOrigin(request.headers);
  if (!expected) return new Response(null, { status: 403 });
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    if (origin && origin !== expected) return new Response(null, { status: 403 });
  }
  if (["POST", "PUT"].includes(request.method) && !request.headers.get("content-type")?.startsWith("application/json")) {
    return new Response(null, { status: 415 });
  }
  if (secured && !await (await prepareAuth()).api.getSession({ headers: request.headers })) {
    return Response.json({ detail: "Sign in to view this workspace." }, { status: 401 });
  }
  const { path } = await params;
  const route = path.join("/");
  if (!/^(workspace|demo|records(?:\/[a-f\d-]{36})?)$/.test(route)) {
    return new Response(null, { status: 404 });
  }

  try {
    const upstream = await fetch(`${process.env.ATLAS_API_URL ?? "http://127.0.0.1:4000"}/${route}`, {
      method: request.method,
      headers: { "Content-Type": "application/json" },
      body: ["POST", "PUT"].includes(request.method) ? await request.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return Response.json({ detail: "ATLAS could not reach the workspace database." }, { status: 503 });
  }
}

export { forward as GET, forward as POST, forward as PUT, forward as DELETE };
