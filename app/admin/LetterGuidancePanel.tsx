"use client";

import { useState, useTransition } from "react";
import { Select } from "@/app/components/Select";
import { saveGlobalLetterGuidance, saveAgencyLetterGuidance } from "@/app/actions/admin";

type AgencyRow = { id: string; name: string; letter_instructions: string | null };

/**
 * Ops-console editor for correction-letter guidance. The platform layer is
 * one textarea for every client; the per-client layer is picked from a
 * dropdown of all clients, then edited in place.
 */
export function LetterGuidancePanel({
  globalValue,
  agencies,
}: {
  globalValue: string;
  agencies: AgencyRow[];
}) {
  const [selectedId, setSelectedId] = useState(agencies[0]?.id ?? "");
  const selected = agencies.find((a) => a.id === selectedId);
  const [draft, setDraft] = useState(selected?.letter_instructions ?? "");
  const [saved, setSaved] = useState<"" | "global" | "agency">("");
  const [pending, startTransition] = useTransition();

  const options = agencies.map(
    (a) => [a.id, a.letter_instructions ? `${a.name} · customized` : a.name] as const
  );

  return (
    <div>
      <form
        action={(fd: FormData) =>
          startTransition(async () => {
            await saveGlobalLetterGuidance(fd);
            setSaved("global");
          })
        }
        className="mb-6"
      >
        <label className="block">
          <span className="mb-1 block text-sm font-semibold">
            Platform-wide guidance (every client, one place)
          </span>
          <textarea
            name="guidance"
            defaultValue={globalValue}
            rows={3}
            maxLength={4000}
            placeholder="Example: Always reference the producer code when known. Close with 'We appreciate your prompt attention.'"
            className="w-full rounded border border-line bg-paper px-3 py-2 font-mono text-sm"
          />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-ink px-4 py-2 text-sm font-semibold text-paper hover:bg-ink/90 disabled:opacity-50"
          >
            Save platform guidance
          </button>
          {saved === "global" && <span className="text-sm text-verify">Saved.</span>}
        </div>
      </form>

      <div className="border-t border-line pt-5">
        <span className="mb-1 block text-sm font-semibold">Per-client guidance</span>
        <p className="mb-3 text-sm text-ink/60">
          Pick the client, write instructions that only shape their letters.
          These win over the platform layer where they conflict.
        </p>
        <div className="mb-3">
          <Select
            value={selectedId}
            options={options}
            ariaLabel="Choose a client"
            onChange={(id) => {
              setSelectedId(id);
              setDraft(agencies.find((a) => a.id === id)?.letter_instructions ?? "");
              setSaved("");
            }}
          />
        </div>
        {selected && (
          <form
            action={(fd: FormData) =>
              startTransition(async () => {
                await saveAgencyLetterGuidance(selected.id, fd);
                setSaved("agency");
              })
            }
          >
            <textarea
              name="guidance"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={4000}
              placeholder="Example: This agency signs as 'Risk Management Team'. Reference their carrier service center, not underwriting."
              className="w-full rounded border border-line bg-paper px-3 py-2 font-mono text-sm"
            />
            <div className="mt-2 flex items-center gap-3">
              <button
                type="submit"
                disabled={pending}
                className="rounded border border-ink px-4 py-1.5 text-sm font-semibold hover:bg-ink hover:text-paper disabled:opacity-50"
              >
                Save for {selected.name}
              </button>
              <span className="text-xs text-ink/50">
                Clear the box and save to return this client to default.
              </span>
              {saved === "agency" && <span className="text-sm text-verify">Saved.</span>}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
