"use client";

import { useActionState } from "react";
import { track } from "@/lib/analytics";
import { runSampleCheck, type SampleCheckState } from "@/app/actions/sample-check";

const initial: SampleCheckState = { status: "idle", message: "" };

export function SampleCheckButton() {
  const [state, action, pending] = useActionState(runSampleCheck, initial);
  return (
    <form action={action} onSubmit={() => track("sample_check_started")} className="flex flex-col items-center">
      <button
        type="submit"
        disabled={pending}
        className="rounded bg-ink px-6 py-3 font-semibold text-paper hover:bg-ink/90 disabled:opacity-60"
      >
        {pending ? "Starting…" : "Run a sample check"}
      </button>
      {state.status === "error" && (
        <p role="alert" className="mt-2 text-flag text-sm">
          {state.message}
        </p>
      )}
    </form>
  );
}
