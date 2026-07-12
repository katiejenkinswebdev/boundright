"use client";

import { useRef, useState, useTransition } from "react";
import { uploadAgencyLogoAdmin } from "@/app/actions/admin";

/** One-click client logo upload for the ops console: pick a file, it saves. */
export function AdminLogoForm({
  agencyId,
  agencyName,
  logoUrl,
}: {
  agencyId: string;
  agencyName: string;
  logoUrl: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  return (
    <span className="flex items-center gap-2">
      {logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${agencyName} logo`}
          className="h-6 w-auto rounded border border-line bg-white p-0.5"
        />
      ) : (
        <span className="font-mono text-xs text-ink/40">none</span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="font-mono text-xs underline disabled:opacity-50"
      >
        {pending ? "uploading…" : "set"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const fd = new FormData();
          fd.set("logo", file);
          setMessage("");
          startTransition(async () => {
            const result = await uploadAgencyLogoAdmin(agencyId, fd);
            setMessage(result.message);
            if (inputRef.current) inputRef.current.value = "";
          });
        }}
      />
      {message && (
        <span className={`text-xs ${message === "Logo updated." ? "text-verify" : "text-flag"}`}>
          {message}
        </span>
      )}
    </span>
  );
}
