import { timingSafeEqual } from "node:crypto";
import { betterAuth, APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { getMigrations } from "better-auth/db/migration";
import { Pool } from "pg";

export function authEnabled() {
  return process.env.ATLAS_AUTH === "1";
}

export function localOrigin(headers: Headers) {
  const host = headers.get("host") ?? "";
  return /^(127\.0\.0\.1|localhost)(:\d+)?$/i.test(host) ? new URL(`http://${host}`).origin : null;
}

function createAuth() {
  const { BETTER_AUTH_URL, BETTER_AUTH_SECRET, ATLAS_AUTH_DATABASE_URL, ATLAS_OWNER_EMAIL, ATLAS_SETUP_TOKEN } = process.env;
  if (!BETTER_AUTH_URL || !BETTER_AUTH_SECRET || BETTER_AUTH_SECRET.length < 32 || !ATLAS_AUTH_DATABASE_URL || !ATLAS_OWNER_EMAIL) {
    throw new Error("Set BETTER_AUTH_URL, BETTER_AUTH_SECRET, ATLAS_AUTH_DATABASE_URL and ATLAS_OWNER_EMAIL.");
  }
  const owner = ATLAS_OWNER_EMAIL.trim().toLowerCase();

  return betterAuth({
    appName: "ATLAS",
    baseURL: BETTER_AUTH_URL,
    secret: BETTER_AUTH_SECRET,
    database: new Pool({ connectionString: ATLAS_AUTH_DATABASE_URL }),
    emailAndPassword: { enabled: true, autoSignIn: false },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const supplied = Buffer.from(ctx.headers?.get("x-atlas-setup-token") ?? "");
        const expected = Buffer.from(ATLAS_SETUP_TOKEN ?? "");
        if (expected.length < 32 || supplied.length !== expected.length || !timingSafeEqual(supplied, expected) || ctx.body?.email?.toLowerCase() !== owner) {
          throw new APIError("FORBIDDEN", { message: "Account registration is closed." });
        }
      }),
    },
  });
}

let auth: ReturnType<typeof createAuth> | undefined;
let migration: Promise<void> | undefined;

export function getAuth() {
  return auth ??= createAuth();
}

export async function prepareAuth() {
  const instance = getAuth();
  migration ??= getMigrations(instance.options).then(({ runMigrations }) => runMigrations()).catch((error) => {
    migration = undefined;
    throw error;
  });
  await migration;
  return instance;
}
