"use client";

import { useEffect, useState } from "react";

type Mode = "signup" | "login";

export default function AuthForm({ onClose, onDone, reason }: { onClose: () => void; onDone: (email: string) => void; reason?: string }) {
  const [mode, setMode] = useState<Mode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (res.status === 409) setMode("login");
        return;
      }
      onDone(data.email ?? email);
    } catch {
      setError("Couldn't reach the site. Check your connection and try again.");
    } finally {
      setSending(false);
    }
  };

  const signup = mode === "signup";
  return (
    <div className="modal-back" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={signup ? "Create an account" : "Log in"}>
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
          ×
        </button>
        <form className="review-form" onSubmit={submit}>
          <h2>{signup ? "Create your free account" : "Log in"}</h2>
          <p className="modal-sub">
            {reason ?? (signup ? "One quick step, then your download starts." : "Welcome back.")}
          </p>
          <input
            className="field"
            type="email"
            required
            autoComplete="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-label="Email"
          />
          <input
            className="field"
            type="password"
            required
            minLength={8}
            maxLength={72}
            autoComplete={signup ? "new-password" : "current-password"}
            placeholder={signup ? "Password (8+ characters)" : "Password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-label="Password"
          />
          <input className="hp" type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" value={website} onChange={(event) => setWebsite(event.target.value)} />
          {error && <p className="modal-error">{error}</p>}
          <button type="submit" className="btn btn-patch" disabled={sending}>
            {sending ? "One moment…" : signup ? "Create account" : "Log in"}
          </button>
          {signup && <p className="modal-note">We keep your email to count downloads. No verification email, no spam.</p>}
          <button type="button" className="again" onClick={() => { setMode(signup ? "login" : "signup"); setError(""); }}>
            {signup ? "Already have an account? Log in" : "New here? Create an account"}
          </button>
        </form>
      </div>
    </div>
  );
}
