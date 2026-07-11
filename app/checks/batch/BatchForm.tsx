"use client";

import { useState } from "react";
import Link from "next/link";
import { createCheck, startCheck } from "@/app/actions/checks";
import { inputClass, primaryButtonClass } from "@/app/components/ui";

type Row = {
  label: string;
  fileA: File | null;
  fileB: File | null;
  status: "pending" | "running" | "done" | "error";
  message?: string;
  checkId?: string;
};

const emptyRow = (): Row => ({ label: "", fileA: null, fileB: null, status: "pending" });

export function BatchForm() {
  const [rows, setRows] = useState<Row[]>([emptyRow(), emptyRow(), emptyRow()]);
  const [running, setRunning] = useState(false);

  const update = (i: number, patch: Partial<Row>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function runAll() {
    setRunning(true);
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row.label || !row.fileA || !row.fileB || row.status === "done") continue;
      update(i, { status: "running", message: undefined });
      try {
        const fd = new FormData();
        fd.set("label", row.label);
        fd.set("policy_type", "Other");
        fd.set("check_type", "issuance");
        fd.set("doc_a_filename", row.fileA.name);
        fd.set("doc_b_filename", row.fileB.name);
        const created = await createCheck(fd);
        if (!created.ok) {
          update(i, { status: "error", message: created.message });
          continue;
        }
        const uploads = await Promise.all(
          [
            { url: created.uploadA.url, file: row.fileA },
            { url: created.uploadB.url, file: row.fileB },
          ].map(({ url, file }) =>
            fetch(url, {
              method: "PUT",
              headers: { "Content-Type": "application/pdf" },
              body: file,
            })
          )
        );
        if (uploads.some((r) => !r.ok)) {
          update(i, { status: "error", message: "Upload failed. Try this row again." });
          continue;
        }
        const started = await startCheck(created.checkId);
        update(
          i,
          started.ok
            ? { status: "done", checkId: created.checkId }
            : { status: "error", message: started.message }
        );
      } catch {
        update(i, { status: "error", message: "Something went wrong. Try this row again." });
      }
    }
    setRunning(false);
  }

  const ready = rows.filter((r) => r.label && r.fileA && r.fileB && r.status !== "done");

  return (
    <div className="space-y-4">
      {rows.map((row, i) => (
        <div key={i} className="rounded-lg border border-line bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr_auto]">
            <input
              type="text"
              placeholder={`Client / account name`}
              value={row.label}
              onChange={(e) => update(i, { label: e.target.value })}
              disabled={row.status === "done"}
              className={inputClass}
              aria-label={`Row ${i + 1} label`}
            />
            <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-line px-2 py-2 text-sm text-ink/70 hover:border-ink">
              {row.fileA ? row.fileA.name.slice(0, 18) : "Proposal PDF"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={(e) => update(i, { fileA: e.target.files?.[0] ?? null })}
              />
            </label>
            <label className="flex cursor-pointer items-center justify-center rounded border border-dashed border-line px-2 py-2 text-sm text-ink/70 hover:border-ink">
              {row.fileB ? row.fileB.name.slice(0, 18) : "Policy PDF"}
              <input
                type="file"
                accept=".pdf,application/pdf"
                className="sr-only"
                onChange={(e) => update(i, { fileB: e.target.files?.[0] ?? null })}
              />
            </label>
            <span className="flex items-center font-mono text-xs uppercase tracking-wide">
              {row.status === "done" && row.checkId ? (
                <Link href={`/checks/${row.checkId}`} className="text-verify underline">
                  running
                </Link>
              ) : row.status === "running" ? (
                <span className="text-ink/60">starting…</span>
              ) : row.status === "error" ? (
                <span className="text-flag">retry</span>
              ) : (
                <span className="text-ink/40">ready</span>
              )}
            </span>
          </div>
          {row.message && (
            <p role="alert" className="mt-2 text-flag text-sm">
              {row.message}
            </p>
          )}
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setRows((rs) => [...rs, emptyRow()])}
          className="rounded border border-ink px-4 py-2 text-sm font-semibold hover:bg-ink hover:text-paper"
        >
          Add a pair
        </button>
        <button
          type="button"
          disabled={running || ready.length === 0}
          onClick={runAll}
          className={primaryButtonClass + " w-auto"}
        >
          {running ? "Starting checks…" : `Run ${ready.length} check${ready.length === 1 ? "" : "s"}`}
        </button>
        <Link href="/checks" className="text-sm underline">
          Watch progress in Checks
        </Link>
      </div>
    </div>
  );
}
