const { BETTER_AUTH_URL, ATLAS_OWNER_EMAIL, ATLAS_SETUP_TOKEN } = process.env;
if (!BETTER_AUTH_URL || !ATLAS_OWNER_EMAIL || !ATLAS_SETUP_TOKEN) {
  throw new Error("Set BETTER_AUTH_URL, ATLAS_OWNER_EMAIL, and ATLAS_SETUP_TOKEN.");
}
if (process.stdin.isTTY) throw new Error("Pass the owner password through stdin.");
let password = "";
for await (const chunk of process.stdin) password += chunk;
password = password.replace(/\r?\n$/, "");
if (password.length < 12 || password.length > 128) throw new Error("Use a password between 12 and 128 characters.");

const url = new URL("/api/auth/sign-up/email", BETTER_AUTH_URL);
const response = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: url.origin,
    "x-atlas-setup-token": ATLAS_SETUP_TOKEN,
  },
  body: JSON.stringify({ email: ATLAS_OWNER_EMAIL.trim().toLowerCase(), name: "Personal workspace", password }),
});
if (!response.ok) {
  const error = await response.json().catch(() => ({}));
  throw new Error(error.message ?? `Account setup returned HTTP ${response.status}.`);
}
console.log("Owner account created. Sign in with the owner email and password.");
