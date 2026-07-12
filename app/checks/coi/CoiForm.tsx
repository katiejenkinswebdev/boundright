"use client";

import { useState } from "react";
import Link from "next/link";
import { createCheck, startCheck } from "@/app/actions/checks";
import { labelClass, primaryButtonClass } from "@/app/components/ui";

type CertRow = {
  file: File;
  status: "pending" | "running" | "done" | "error";
  message?: string;
  checkId?: string;
};

export function CoiForm() {
  const [policy, setPolicy] = useState<File | null>(null);
  const [account, setAccount] = useState("");
  const [certs, setCerts] = useState<CertRow[]>([]);
  const [running, setRunning] = useState(false);

  const update = (i: number, patch: Partial<CertRow>) =>
    setCerts((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  async function runAll() {
    if (!policy) return;
    setRunning(true);
    for (let i = 0; i < certs.length; i++) {
      const row = certs[i];
      if (row.status === "done") continue;
      update(i, { status: "running", message: undefined });
      try {
        const fd = new FormData();
        fd.set("label", `${account || "COI"}: ${row.file.name.replace(/\.pdf$/i, "")}`);
        fd.set("policy_type", "Other");
        fd.set("check_type", "coi");
        fd.set("doc_a_filename", row.file.name);
        fd.set("doc_b_filename", policy.name);
        const created = await createCheck(fd);
        if (!created.ok) {
          update(i, { status: "error", message: created.message });
          continue;
        }
        const uploads = await Promise.all([
          fetch(created.uploadA.url, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: row.file,
          }),
          fetch(created.uploadB.url, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: policy,
          }),
        ]);
        if (uploads.some((r) => !r.ok)) {
          update(i, { status: "error", message: "Upload failed. Try this certificate again." });
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
        update(i, { status: "error", message: "Something went wrong. Try this certificate again." });
      }
    }
    setRunning(false);
  }

  const remaining = certs.filter((c) => c.status !== "done").length;
  const ready = policy && remaining > 0;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-line bg-card p-6">
        <label htmlFor="coi-account" className={labelClass}>
          Account name (used in check labels)
        </label>
        <input
          id="coi-account"
          type="text"
          value={account}
          onChange={(e) => setAccount(e.target.value)}
          placeholder="e.g. Blue Ridge Builders"
          className="mb-4 w-full max-w-sm rounded border border-line bg-card px-4 py-2"
        />
        <p className={labelClass}>
          Underlying policy (uploaded once, checked against every certificate)
        </p>
        <label className="mt-1 flex min-h-20 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line p-4 text-ink/70 hover:border-ink">
          {policy ? (
            <span className="font-mono text-sm">{policy.name}</span>
          ) : (
            <span>Drop or choose the policy PDF</span>
          )}
          <input
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(e) => setPolicy(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <div className="rounded-lg border border-line bg-card p-6">
        <p className={labelClass}>Certificates (add as many as you need)</p>
        <label className="mt-1 flex min-h-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-line p-4 text-ink/70 hover:border-ink">
          <span>Add certificate PDFs</span>
          <input
            type="file"
            accept=".pdf,application/pdf"
            multiple
            className="sr-only"
            onChange={(e) =>
              setCerts((prev) => [
                ...prev,
                ...Array.from(e.target.files ?? []).map((file) => ({
                  file,
                  status: "pending" as const,
                })),
              ])
            }
          />
        </label>
        {certs.length > 0 && (
          <ul className="mt-4 divide-y divide-line/60">
            {certs.map((c, i) => (
              <li key={i} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{c.file.name}</span>
                <span className="font-mono text-xs uppercase tracking-wide">
                  {c.status === "done" && c.checkId ? (
                    <Link href={`/checks/${c.checkId}`} className="text-verify underline">
                      running
                    </Link>
                  ) : c.status === "running" ? (
                    <span className="text-ink/60">starting…</span>
                  ) : c.status === "error" ? (
                    <span className="text-flag">retry</span>
                  ) : (
                    <span className="text-ink/40">ready</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
        {certs.some((c) => c.message) && (
          <p role="alert" className="mt-2 text-flag text-sm">
            {certs.find((c) => c.message)?.message}
          </p>
        )}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          disabled={!ready || running}
          onClick={runAll}
          className={primaryButtonClass + " w-auto"}
        >
          {running
            ? "Checking certificates…"
            : `Check ${remaining} certificate${remaining === 1 ? "" : "s"}`}
        </button>
        <Link href="/checks?type=coi" className="text-sm underline">
          Watch progress in Checks
        </Link>
      </div>
    </div>
  );
}
