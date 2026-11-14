"use client";

import { useEffect, useRef, useState } from "react";

type State = { kind: "form" | "sending" | "done" } | { kind: "error"; message: string };

export default function ReviewForm({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [state,setState] = useState<State>({kind:"form"});
  const [rating,setRating] = useState(0);
  const [text,setText] = useState("");
  const [handle,setHandle] = useState("");
  const [website,setWebsite] = useState("");

  useEffect(() => {
    const node = dialog.current;
    const trigger = document.activeElement;
    node?.showModal();
    return () => {
      node?.close();
      if (trigger instanceof HTMLElement) trigger.focus({ preventScroll:true });
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rating) return setState({kind:"error",message:"Pick a rating from 1 to 5 stars."});
    if (!text.trim()) return setState({kind:"error",message:"Write a few words about your experience."});
    setState({kind:"sending"});
    try {
      const res = await fetch("/api/reviews",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({rating,text,name:handle,website})});
      const data = await res.json().catch(()=>({}));
      if (!res.ok) return setState({kind:"error",message:data.error ?? "Couldn’t send your review. Please try again."});
      setState({kind:"done"});
    } catch {
      setState({kind:"error",message:"Couldn’t reach the site. Check your connection and try again."});
    }
  };

  return <dialog ref={dialog} className="review-dialog" aria-labelledby="review-heading"
    onCancel={event=>{event.preventDefault();onClose();}}
    onClick={event=>{
      if (event.target !== event.currentTarget) return;
      const rect=event.currentTarget.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
    }}>
    <button type="button" className="modal-x" aria-label="Close review" onClick={onClose}>×</button>
    {state.kind==="done" ? <><h2 id="review-heading">Thanks for the review.</h2><button type="button" className="sun-action" onClick={onClose}>Done</button></> :
    <form className="review-form" onSubmit={submit}>
      <h2 id="review-heading">Leave a review.</h2>
      <fieldset className="rating-field"><legend>Your rating</legend><div>{[1,2,3,4,5].map(n=><label key={n}>
        <input className="sr-only" type="radio" name="rating" value={n} checked={rating===n} onChange={()=>setRating(n)} aria-label={`${n} ${n===1?"star":"stars"}`}/>
        <span aria-hidden="true" className={n<=rating?"rated":""}>★</span>
      </label>)}</div></fieldset>
      <label>Your review<textarea className="field" rows={4} maxLength={1000} placeholder="How did your upload turn out?" value={text} onChange={event=>setText(event.target.value)}/></label>
      <label>TikTok @username <small>(optional)</small><input className="field" type="text" placeholder="@username" value={handle} maxLength={60} onChange={event=>setHandle(event.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off"/></label>
      <input className="hp" type="text" tabIndex={-1} aria-hidden="true" value={website} onChange={event=>setWebsite(event.target.value)} autoComplete="off"/>
      {state.kind==="error" && <p className="modal-error" role="alert">{state.message}</p>}
      <button type="submit" className="sun-action" disabled={state.kind==="sending"}>{state.kind==="sending"?"Sending…":"Send review"}</button>
    </form>}
  </dialog>;
}
