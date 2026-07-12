"use client";

import { useState } from "react";
import type { MonthPoint } from "@/lib/stats";

// Chart series colors — brand-adjacent hues validated for lightness band,
// chroma floor, CVD separation (ΔE 58 deutan / 24 tritan) and 3:1 contrast
// on the paper surface. Brand ink/verify are text colors, not data hues.
const CHECKS_COLOR = "#2E5A9E";
const CONFIRMED_COLOR = "#219A6D";

const W = 640;
const H = 220;
const PAD = { top: 16, right: 12, bottom: 28, left: 36 };

export function TrendChart({ trend }: { trend: MonthPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);

  const max = Math.max(4, ...trend.flatMap((p) => [p.checks, p.confirmed]));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const band = innerW / trend.length;
  const barW = Math.min(24, band / 3);
  const y = (v: number) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, Math.ceil(max / 2), max];

  // 4px rounded data-end, square baseline.
  const bar = (x: number, v: number, color: string, key: string) => {
    const top = y(v);
    const h = PAD.top + innerH - top;
    const r = v === 0 ? 0 : Math.min(4, h);
    return (
      <path
        key={key}
        d={`M ${x} ${PAD.top + innerH}
            L ${x} ${top + r}
            Q ${x} ${top} ${x + r} ${top}
            L ${x + barW - r} ${top}
            Q ${x + barW} ${top} ${x + barW} ${top + r}
            L ${x + barW} ${PAD.top + innerH} Z`}
        fill={color}
      />
    );
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CHECKS_COLOR }} />
            Checks run
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm" style={{ background: CONFIRMED_COLOR }} />
            Confirmed discrepancies
          </span>
        </div>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="text-sm underline">
          {showTable ? "Show chart" : "Show table"}
        </button>
      </div>

      {showTable ? (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th className="py-1.5 font-semibold">Month</th>
              <th className="py-1.5 text-right font-semibold">Checks run</th>
              <th className="py-1.5 text-right font-semibold">Discrepancies</th>
              <th className="py-1.5 text-right font-semibold text-flag">Critical</th>
              <th className="py-1.5 text-right font-semibold text-caution">Moderate</th>
              <th className="py-1.5 text-right font-semibold text-ink/60">Minor</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((p) => (
              <tr key={p.monthKey} className="border-b border-line/50">
                <td className="py-1.5">{p.month}</td>
                <td className="py-1.5 text-right font-mono">{p.checks}</td>
                <td className="py-1.5 text-right font-mono font-semibold">{p.confirmed}</td>
                <td className={`py-1.5 text-right font-mono ${p.critical ? "text-flag" : "text-ink/30"}`}>{p.critical}</td>
                <td className={`py-1.5 text-right font-mono ${p.moderate ? "text-caution" : "text-ink/30"}`}>{p.moderate}</td>
                <td className={`py-1.5 text-right font-mono ${p.minor ? "" : "text-ink/30"}`}>{p.minor}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-ink/20 font-semibold">
              <td className="py-1.5">Total</td>
              <td className="py-1.5 text-right font-mono">{trend.reduce((s, p) => s + p.checks, 0)}</td>
              <td className="py-1.5 text-right font-mono">{trend.reduce((s, p) => s + p.confirmed, 0)}</td>
              <td className="py-1.5 text-right font-mono text-flag">{trend.reduce((s, p) => s + p.critical, 0)}</td>
              <td className="py-1.5 text-right font-mono text-caution">{trend.reduce((s, p) => s + p.moderate, 0)}</td>
              <td className="py-1.5 text-right font-mono">{trend.reduce((s, p) => s + p.minor, 0)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg
            viewBox={`0 0 ${W} ${H}`}
            role="img"
            aria-label={`Six-month trend: checks run and confirmed discrepancies per month. ${trend
              .map((p) => `${p.month}: ${p.checks} checks, ${p.confirmed} confirmed`)
              .join("; ")}.`}
            className="w-full"
          >
            {/* hairline grid, recessive */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="#E4E5E0"
                  strokeWidth={1}
                />
                <text x={PAD.left - 6} y={y(t) + 3.5} fontSize={10} fill="#6B7280" textAnchor="end">
                  {t}
                </text>
              </g>
            ))}

            {trend.map((p, i) => {
              const cx = PAD.left + band * i + band / 2;
              // 2px surface gap between the pair
              const xA = cx - barW - 1;
              const xB = cx + 1;
              return (
                <g key={p.monthKey}>
                  {bar(xA, p.checks, CHECKS_COLOR, `c${i}`)}
                  {bar(xB, p.confirmed, CONFIRMED_COLOR, `d${i}`)}
                  {/* hover hit target: whole band */}
                  <rect
                    x={PAD.left + band * i}
                    y={PAD.top}
                    width={band}
                    height={innerH}
                    fill="transparent"
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                  />
                  <text
                    x={cx}
                    y={H - 10}
                    fontSize={11}
                    fill="#374151"
                    textAnchor="middle"
                  >
                    {p.month}
                  </text>
                </g>
              );
            })}
          </svg>

          {hover !== null && (
            <div
              className="pointer-events-none absolute z-10 rounded border border-line bg-card px-3 py-2 text-xs shadow-sm"
              style={{
                left: `${((PAD.left + band * hover + band / 2) / W) * 100}%`,
                top: 0,
                transform: "translateX(-50%)",
              }}
            >
              <p className="font-semibold">{trend[hover].month}</p>
              <p>
                <span style={{ color: CHECKS_COLOR }}>■</span> {trend[hover].checks} checks
              </p>
              <p>
                <span style={{ color: CONFIRMED_COLOR }}>■</span> {trend[hover].confirmed} confirmed
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
