"use client";

import { useEffect, useState } from "react";

type State = { kind: "form" } | { kind: "sending" } | { kind: "done" } | { kind: "error"; message: string };

export default function ReviewForm({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<State>({ kind: "form" });
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [handle, setHandle] = useState("");
  const [website, setWebsite] = useState(""); // honeypot

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (rating === 0) return setState({ kind: "error", message: "Pick a rating from 1 to 5 stars." });
    if (!text.trim()) return setState({ kind: "error", message: "Write a few words about your experience." });
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, text, name: handle, website }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setState({ kind: "error", message: data.error ?? "Something went wrong. Please try again." });
      setState({ kind: "done" });
    } catch {
      setState({ kind: "error", message: "Couldn't reach the site. Check your connection and try again." });
    }
  };

  return (
    <div className="modal-back" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Leave a review">
        <button type="button" className="modal-x" onClick={onClose} aria-label="Close">
          ×
        </button>
        {state.kind === "done" ? (
          <>
            <h2>Thanks for the review</h2>
            <p className="modal-ok">We got it.</p>
            <button type="button" className="btn btn-patch" onClick={onClose}>
              Close
            </button>
          </>
        ) : (
          <form className="review-form" onSubmit={submit}>
            <h2>Leave a review</h2>
            <p className="modal-sub">Tell us how OQM worked for you.</p>

            <div className="stars" role="radiogroup" aria-label="Rating" onMouseLeave={() => setHover(0)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={rating === n}
                  aria-label={`${n} star${n > 1 ? "s" : ""}`}
                  className={n <= (hover || rating) ? "star on" : "star"}
                  onMouseEnter={() => setHover(n)}
                  onClick={() => setRating(n)}
                >
                  ★
                </button>
              ))}
            </div>

            <textarea
              className="field"
              rows={5}
              maxLength={1000}
              placeholder="What did you upload, and how did it turn out?"
              value={text}
              onChange={(event) => setText(event.target.value)}
              aria-label="Your review"
            />
            <input
              className="field"
              type="text"
              maxLength={60}
              placeholder="Your TikTok @username (optional)"
              value={handle}
              onChange={(event) => setHandle(event.target.value)}
              aria-label="Your TikTok @username (optional)"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
            />
            <input
              className="hp"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
            />

            {state.kind === "error" && <p className="modal-error">{state.message}</p>}
            <button type="submit" className="btn btn-patch" disabled={state.kind === "sending"}>
              {state.kind === "sending" ? "Sending…" : "Send review"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
