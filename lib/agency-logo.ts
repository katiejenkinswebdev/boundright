export type PdfLogo = { bytes: Uint8Array; kind: "png" | "jpg" } | null;

/** Fetches an agency's logo for PDF co-branding. Best-effort: null on any miss. */
export async function fetchAgencyLogo(logoUrl: string | null | undefined): Promise<PdfLogo> {
  if (!logoUrl) return null;
  try {
    const res = await fetch(logoUrl);
    if (!res.ok) return null;
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      kind: new URL(logoUrl).pathname.endsWith(".png") ? "png" : "jpg",
    };
  } catch {
    return null;
  }
}
