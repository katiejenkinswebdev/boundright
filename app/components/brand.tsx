/**
 * BoundRight brand primitives (brand guidelines v1.0).
 *
 * - Wordmark: "Bound" 600 + "Right" 400, always Ink (Paper on Ink for
 *   reverse). Never all caps, never recolored.
 * - Seal: the tilted BR monogram. Tilt is at most 4 degrees; dropped under
 *   24px for crisp edges (the favicon in app/icon.svg is level).
 * - BoundRightStamp: the single bold element in the system. Reserved for
 *   actual verification moments: the reviewed state in the app and the
 *   exported PDF. Never decorative, never on marketing surfaces.
 */

export function Wordmark({
  reverse = false,
  className = "",
}: {
  reverse?: boolean;
  className?: string;
}) {
  return (
    <span className={`tracking-tight ${reverse ? "text-paper" : "text-ink"} ${className}`}>
      <span className="font-semibold">Bound</span>
      <span className="font-normal">Right</span>
    </span>
  );
}

export function Seal({
  size = 28,
  tilt = true,
  reverse = false,
}: {
  size?: number;
  tilt?: boolean;
  reverse?: boolean;
}) {
  const stroke = reverse ? "#FAFAF7" : "#1B2A41";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={tilt && size >= 24 ? { transform: "rotate(-3deg)" } : undefined}
    >
      <rect
        x="2.5"
        y="2.5"
        width="27"
        height="27"
        rx="4"
        fill="none"
        stroke={stroke}
        strokeWidth="2"
      />
      <text
        x="16"
        y="21"
        textAnchor="middle"
        fontFamily="var(--font-plex-mono), monospace"
        fontWeight="600"
        fontSize="11.5"
        letterSpacing="0.5"
        fill={stroke}
      >
        BR
      </text>
    </svg>
  );
}

/** Seal + wordmark lockup for app and page headers. */
export function Lockup({ reverse = false }: { reverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Seal size={26} reverse={reverse} />
      <Wordmark reverse={reverse} className="text-xl" />
    </span>
  );
}

/**
 * The BOUND RIGHT stamp. Verify Green, rotated within 4 degrees, date line
 * carries the review date. Renders only where a licensed agent actually
 * confirmed a report.
 */
export function BoundRightStamp({ reviewedAt }: { reviewedAt: string | Date }) {
  const d = new Date(reviewedAt);
  const dateLine = [
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
    d.getFullYear(),
  ].join("·");

  return (
    <span
      className="stamp-settle inline-flex -rotate-3 flex-col items-center rounded border-2 border-verify px-4 py-2 text-verify"
      role="img"
      aria-label={`Bound right, reviewed ${d.toLocaleDateString("en-US")}`}
    >
      <span className="font-mono text-sm font-semibold uppercase leading-tight tracking-[0.2em]">
        Bound
      </span>
      <span className="font-mono text-sm font-semibold uppercase leading-tight tracking-[0.2em]">
        Right
      </span>
      <span className="mt-1 font-mono text-[10px] tracking-widest">{dateLine}</span>
    </span>
  );
}
