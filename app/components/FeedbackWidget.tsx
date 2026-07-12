"use client";

import { useState, useActionState } from "react";
import { track } from "@/lib/analytics";
import { usePathname } from "next/navigation";
import { sendFeedback, type FeedbackState } from "@/app/actions/feedback";

const initial: FeedbackState = { status: "idle", message: "" };

/** Sidebar feedback entry point. First-party: nothing leaves our database. */
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(sendFeedback, initial);
  const pathname = usePathname();

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="block text-sm underline">
        Send feedback
      </button>
    );
  }
  return (
    <form action={action} onSubmit={() => track("feedback_sent")} className="space-y-2 rounded border border-line bg-paper p-3">
      <input type="hidden" name="page" value={pathname} />
      <select name="category" className="w-full rounded border border-line bg-card px-2 py-1 text-sm" aria-label="Feedback category">
        <option value="general">General</option>
        <option value="bug">Something&apos;s broken</option>
        <option value="idea">Feature idea</option>
        <option value="accuracy">A finding was wrong</option>
      </select>
      <textarea
        name="message"
        rows={3}
        required
        placeholder="What should we know?"
        className="w-full rounded border border-line bg-card px-2 py-1 text-sm"
      />
      <div className="flex items-center gap-2">
        <button disabled={pending} className="rounded bg-ink px-3 py-1.5 text-sm font-semibold text-paper disabled:opacity-50">
          {pending ? "Sending…" : "Send"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm underline">
          Close
        </button>
      </div>
      {state.message && (
        <p className={`text-xs ${state.status === "error" ? "text-flag" : "text-verify"}`}>
          {state.message}
        </p>
      )}
    </form>
  );
}
