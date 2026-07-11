"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createCheck, startCheck } from "@/app/actions/checks";
import { inputClass, labelClass, primaryButtonClass } from "@/app/components/ui";

const MAX_BYTES = 50 * 1024 * 1024;
const POLICY_TYPES = ["GL", "Property", "WC", "Auto", "Umbrella", "Package", "Other"];
const CHECK_TYPES = [
  { value: "issuance", label: "Issuance check", a: "Proposal or Binder", b: "Issued Policy", blurb: "Does the issued policy match what you sold?" },
  { value: "renewal", label: "Renewal comparison", a: "Expiring Policy", b: "Renewal Policy", blurb: "What changed from last term?" },
  { value: "coi", label: "Certificate check", a: "Certificate (COI)", b: "Underlying Policy", blurb: "Does the policy support every certificate claim?" },
] as const;

function validateFile(file: File): string | null {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "file";
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    return `That's a .${ext}. BoundRight reads PDFs. Export it as PDF and try again.`;
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(0);
    return `That file is ${mb} MB. The limit is 50 MB. Compress or split the PDF and try again.`;
  }
  return null;
}

function DropZone({
  label,
  file,
  error,
  onFile,
}: {
  label: string;
  file: File | null;
  error: string | null;
  onFile: (f: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  return (
    <div className="flex-1">
      <p className={labelClass}>{label}</p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) onFile(dropped);
        }}
        className={`flex min-h-36 w-full flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center ${
          dragging ? "border-verify bg-verify/5" : "border-line bg-card"
        }`}
      >
        {file ? (
          <>
            <span className="font-mono text-sm break-all">{file.name}</span>
            <span className="mt-1 text-sm text-ink/60">
              {(file.size / (1024 * 1024)).toFixed(1)} MB · click to replace
            </span>
          </>
        ) : (
          <>
            <span className="font-semibold">Drop a PDF here</span>
            <span className="mt-1 text-sm text-ink/60">or click to choose a file</span>
          </>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="sr-only"
        onChange={(e) => {
          const chosen = e.target.files?.[0];
          if (chosen) onFile(chosen);
        }}
      />
      {error && (
        <p role="alert" className="mt-2 text-flag text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

export function NewCheckForm() {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [policyType, setPolicyType] = useState("GL");
  const [checkType, setCheckType] = useState<(typeof CHECK_TYPES)[number]>(CHECK_TYPES[0]);
  const [docA, setDocA] = useState<File | null>(null);
  const [docB, setDocB] = useState<File | null>(null);
  const [errors, setErrors] = useState<{ a: string | null; b: string | null; form: string | null }>({
    a: null,
    b: null,
    form: null,
  });
  const [phase, setPhase] = useState<"idle" | "uploading" | "starting">("idle");

  const setFile = (side: "a" | "b") => (file: File) => {
    const error = validateFile(file);
    if (side === "a") setDocA(error ? null : file);
    else setDocB(error ? null : file);
    setErrors((e) => ({ ...e, [side]: error }));
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!docA || !docB || phase !== "idle") return;
    setErrors((prev) => ({ ...prev, form: null }));
    setPhase("uploading");
    try {
      const fd = new FormData();
      fd.set("label", label);
      fd.set("policy_type", policyType);
      fd.set("check_type", checkType.value);
      fd.set("doc_a_filename", docA.name);
      fd.set("doc_b_filename", docB.name);
      const created = await createCheck(fd);
      if (!created.ok) {
        setErrors((prev) => ({ ...prev, form: created.message }));
        setPhase("idle");
        return;
      }

      const uploads = await Promise.all(
        [
          { url: created.uploadA.url, file: docA },
          { url: created.uploadB.url, file: docB },
        ].map(({ url, file }) =>
          fetch(url, {
            method: "PUT",
            headers: { "Content-Type": "application/pdf" },
            body: file,
          })
        )
      );
      if (uploads.some((r) => !r.ok)) {
        setErrors((prev) => ({
          ...prev,
          form: "An upload didn't finish. Check your connection and try again.",
        }));
        setPhase("idle");
        return;
      }

      setPhase("starting");
      const started = await startCheck(created.checkId);
      if (!started.ok) {
        setErrors((prev) => ({ ...prev, form: started.message }));
        setPhase("idle");
        return;
      }
      router.push(`/checks/${created.checkId}`);
    } catch {
      setErrors((prev) => ({
        ...prev,
        form: "Something went wrong. Try again.",
      }));
      setPhase("idle");
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset>
        <legend className="mb-2 block text-sm font-semibold">What are you checking?</legend>
        <div className="grid gap-2 sm:grid-cols-3">
          {CHECK_TYPES.map((t) => (
            <label
              key={t.value}
              className={`cursor-pointer rounded border p-3 text-sm ${
                checkType.value === t.value ? "border-ink bg-paper" : "border-line"
              }`}
            >
              <input
                type="radio"
                name="check_type_radio"
                checked={checkType.value === t.value}
                onChange={() => setCheckType(t)}
                className="sr-only"
              />
              <span className="font-semibold">{t.label}</span>
              <span className="mt-1 block text-ink/60">{t.blurb}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor="label" className={labelClass}>
            Client / account name
          </label>
          <input
            id="label"
            type="text"
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. Acme Mfg GL Renewal"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="policy_type" className={labelClass}>
            Policy type
          </label>
          <select
            id="policy_type"
            value={policyType}
            onChange={(e) => setPolicyType(e.target.value)}
            className={inputClass}
          >
            {POLICY_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row">
        <DropZone label={checkType.a} file={docA} error={errors.a} onFile={setFile("a")} />
        <DropZone label={checkType.b} file={docB} error={errors.b} onFile={setFile("b")} />
      </div>

      <p className="text-sm text-ink/60">
        PDF only, up to 50 MB and 300 pages each. Documents are processed and
        deleted. We keep only the findings.
      </p>

      <button
        type="submit"
        disabled={!docA || !docB || !label || phase !== "idle"}
        className={primaryButtonClass}
      >
        {phase === "idle" ? "Run check" : phase === "uploading" ? "Uploading…" : "Starting…"}
      </button>
      {errors.form && (
        <p role="alert" className="text-flag text-sm">
          {errors.form}
        </p>
      )}
    </form>
  );
}
