
/**
 * Day-of-month rule for a monthly step, decided once at detection time and
 * reused by ProjectTimeline so projection never has to re-analyze the input.
 */
export type MonthlyDayRule =
  | { kind: 'eom' }
  | { kind: 'same'; day: number }
  | { kind: 'capped'; max_intended: number };

/**
 * step detected in a numeric series. `anchor` is the last (max-sorted) value
 * of the input — projection extends after the anchor.
 */
export type ConstantStep =
  | { kind: 'numeric'; step: number; anchor: number }
  | { kind: 'monthly'; months: number; anchor: number; day_rule: MonthlyDayRule };

/**
 * Detect the constant step in a list of numbers.
 *
 * Tries (in order):
 *   1. Monthly step on Excel/Lotus serial dates — handles variable month length.
 *   2. Constant numeric step (integer or fractional).
 *
 * @param values    Input numbers (sorted/deduped internally).
 * @param tolerance Relative tolerance for matching numeric gaps (default 1%).
 * @returns The detected step, or null if no consistent step is found.
 */
export function DetectConstantStep(
  values: number[],
  tolerance: number = 0.01,
): ConstantStep | undefined {
  const sorted = Array.from(new Set(values)).sort((a, b) => a - b);
  if (sorted.length < 2) return undefined;

  return DetectMonthly(sorted) ?? DetectNumeric(sorted, tolerance);
}

// ─── Numeric step (integer or fractional) ───────────────────────────────────

function DetectNumeric(
  sorted: number[],
  tolerance: number,
): ConstantStep | undefined {
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) gaps.push(sorted[i] - sorted[i - 1]);

  const absTol = Math.max(...gaps) * tolerance;

  // Fuzzy GCD over all gaps.
  let step = gaps[0];
  for (let i = 1; i < gaps.length; i++) {
    step = FuzzyGCD(step, gaps[i], absTol);
    if (step <= absTol) return undefined;
  }

  // Every gap must be an integer multiple of `step` within tolerance.
  for (const g of gaps) {
    const k = g / step;
    if (Math.abs(k - Math.round(k)) > tolerance) return undefined;
  }

  return { kind: 'numeric', step, anchor: sorted[sorted.length - 1] };
}

function FuzzyGCD(a: number, b: number, absTol: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  if (a < b) [a, b] = [b, a];
  while (b > absTol) {
    const r = a - Math.round(a / b) * b;
    a = b;
    b = Math.abs(r);
  }
  return a;
}

// ─── Monthly step (Excel/Lotus serial dates) ────────────────────────────────

function DetectMonthly(sorted: number[]): ConstantStep | undefined {
  // Reject values outside a plausible serial-date range (~1900–2200).
  if (sorted[0] < 1 || sorted[sorted.length - 1] > 110000) return undefined;

  const parts = sorted.map((v) => {
    const d = ExcelSerialToDate(v);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth();
    return {
      year: y,
      month: m,
      day: d.getUTCDate(),
      lastDayOfMonth: new Date(Date.UTC(y, m + 1, 0)).getUTCDate(),
    };
  });

  // Day-of-month must follow one of three accepted patterns:
  //   1. Exact same day each time (e.g., the 15th every month).
  //   2. End-of-month every time (handles 28/29/30/31 variations).
  //   3. "Nth, capped at month length" — e.g., asked for the 31st, falling
  //      back to the last day in shorter months.
  const days = parts.map((p) => p.day);
  const firstDay = days[0];
  const allSameDay = days.every((d) => d === firstDay);
  const allEom = parts.every((p) => p.day === p.lastDayOfMonth);
  const maxIntended = Math.max(...days);
  const allCapped = parts.every(
    (p) => p.day === Math.min(maxIntended, p.lastDayOfMonth),
  );

  if (!allSameDay && !allEom && !allCapped) return undefined;

  // Month differences must all be positive and share a common divisor.
  const diffs: number[] = [];
  for (let i = 1; i < parts.length; i++) {
    const a = parts[i - 1];
    const b = parts[i];
    diffs.push((b.year - a.year) * 12 + (b.month - a.month));
  }
  if (diffs.some((d) => d <= 0)) return undefined;

  const months = diffs.reduce((g, d) => IntGCD(g, d), diffs[0]);
  if (months === 0) return undefined;
  if (!diffs.every((d) => d % months === 0)) return undefined;

  // Precedence: EOM (most specific) → same-day → capped. Matches the
  // accept-order implied above; the projector relies on this choice.
  const day_rule: MonthlyDayRule = allEom
    ? { kind: 'eom' }
    : allSameDay
      ? { kind: 'same', day: firstDay }
      : { kind: 'capped', max_intended: maxIntended };

  return { kind: 'monthly', months, anchor: sorted[sorted.length - 1], day_rule };
}

function IntGCD(a: number, b: number): number {
  a = Math.abs(a);
  b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
}

function ExcelSerialToDate(serial: number): Date {
  // Excel/Lotus 1-2-3 incorrectly treat 1900 as a leap year (serial 60 is a
  // phantom Feb 29). Using Dec 30, 1899 as epoch yields correct dates for
  // serials ≥ 61, which covers virtually all real-world data.
  const epoch = Date.UTC(1899, 11, 30);
  return new Date(epoch + Math.round(serial) * 86400000);
}

function DateToExcelSerial(year: number, month_index: number, day: number): number {
  const epoch = Date.UTC(1899, 11, 30);
  return Math.round((Date.UTC(year, month_index, day) - epoch) / 86400000);
}

// ─── Projection ─────────────────────────────────────────────────────────────

/**
 * Project the next `count` values of a detected timeline. Returns values
 * strictly after `step.anchor` (the anchor itself is not included).
 *
 * The step is assumed to be a direct output of DetectConstantStep; the
 * anchor and (for monthly) day_rule it carries are trusted as-is.
 */
export function ProjectTimeline(step: ConstantStep, count: number): number[] {
  if (count <= 0) return [];

  if (step.kind === 'numeric') {
    return Array.from(
      { length: count },
      (_, i) => step.anchor + step.step * (i + 1),
    );
  }

  const start = ExcelSerialToDate(step.anchor);
  const start_year = start.getUTCFullYear();
  const start_month = start.getUTCMonth();

  const out: number[] = [];
  for (let i = 1; i <= count; i++) {
    const total = start_year * 12 + start_month + step.months * i;
    const target_year = Math.floor(total / 12);
    const target_month = total - target_year * 12;
    const last_day = new Date(Date.UTC(target_year, target_month + 1, 0)).getUTCDate();

    let day: number;
    switch (step.day_rule.kind) {
      case 'eom':
        day = last_day;
        break;
      case 'same':
        // Cap on overflow (e.g. day 31 in February falls back to month-end).
        day = Math.min(step.day_rule.day, last_day);
        break;
      case 'capped':
        day = Math.min(step.day_rule.max_intended, last_day);
        break;
    }

    out.push(DateToExcelSerial(target_year, target_month, day));
  }
  return out;
}