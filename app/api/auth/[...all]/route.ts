import { authEnabled, prepareAuth } from "@/lib/auth";

export const runtime = "nodejs";

async function handle(request: Request) {
  if (!authEnabled()) return new Response(null, { status: 404 });
  return (await prepareAuth()).handler(request);
}

export { handle as GET, handle as POST };
