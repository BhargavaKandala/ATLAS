"use client";

import { Compass, ArrowRight } from "lucide-react";
import { FormEvent, useState } from "react";

export function SignIn() {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    const fields = new FormData(event.currentTarget);
    try {
      const res = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fields.get("email"), password: fields.get("password") }),
      });
      if (!res.ok) throw new Error("Check your email and password.");
      window.location.reload();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Sign-in failed.");
      setPending(false);
    }
  }

  return <main className="sign-page">
    <form onSubmit={submit} className="sign-card panel">
      <span className="brand-mark"><Compass size={22} /></span>
      <h1>Sign in to ATLAS</h1>
      <p className="muted">Open your private workspace.</p>
      <label>Email<input name="email" type="email" autoComplete="email" required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary" disabled={pending}>{pending ? "Signing in…" : "Sign in"} <ArrowRight size={16} /></button>
    </form>
  </main>;
}
