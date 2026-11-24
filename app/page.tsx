import { Atlas } from "@/components/atlas";
import { authEnabled, localOrigin, prepareAuth } from "@/lib/auth";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { SignIn } from "@/components/sign-in";
import type { Workspace } from "@/lib/workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const secured = authEnabled();
  const incoming = await headers();
  if (!secured && !localOrigin(incoming)) notFound();
  const session = secured ? await (await prepareAuth()).api.getSession({ headers: incoming }) : null;
  if (secured && !session) return <SignIn />;
  const initial = await fetch(`${process.env.ATLAS_API_URL ?? "http://127.0.0.1:4000"}/workspace`, {
    cache: "no-store",
    signal: AbortSignal.timeout(2500),
  }).then(async (response) => response.ok ? await response.json() as Workspace : undefined).catch(() => undefined);
  return <Atlas account={session?.user.name ?? null} initial={initial} />;
}
