export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export function IsLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function DaysInMonth(year: number, month: number): number {
  const days = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month === 2 && IsLeapYear(year)) return 29;
  return days[month];
}

export function DaysInYear(year: number): number {
  return IsLeapYear(year) ? 366 : 365;
}

export function SerialToDate(serial: number): DateParts {
  if (serial === 60) return { year: 1900, month: 2, day: 29 };
  if (serial > 60) serial--;

  let remaining = serial - 1;
  let year = 1900;
  while (remaining >= DaysInYear(year)) {
    remaining -= DaysInYear(year);
    year++;
  }

  let month = 1;
  while (remaining >= DaysInMonth(year, month)) {
    remaining -= DaysInMonth(year, month);
    month++;
  }

  return { year, month, day: remaining + 1 };
}

export function DateToSerial(year: number, month: number, day: number): number {
  let serial = 0;
  for (let y = 1900; y < year; y++) {
    serial += DaysInYear(y);
  }
  for (let m = 1; m < month; m++) {
    serial += DaysInMonth(year, m);
  }
  serial += day;
  if (serial > 59) serial++;
  return serial;
}

export function Days360Us(d1: DateParts, d2: DateParts): number {
  let dd1 = d1.day;
  let dd2 = d2.day;

  const d1_is_last_feb = d1.month === 2 && dd1 === DaysInMonth(d1.year, 2);
  const d2_is_last_feb = d2.month === 2 && dd2 === DaysInMonth(d2.year, 2);

  if (d1_is_last_feb) dd1 = 30;
  if (d2_is_last_feb && d1_is_last_feb) dd2 = 30;
  if (dd1 === 31) dd1 = 30;
  if (dd2 === 31 && dd1 >= 30) dd2 = 30;

  return (d2.year - d1.year) * 360 + (d2.month - d1.month) * 30 + (dd2 - dd1);
}

export function Days360Eu(d1: DateParts, d2: DateParts): number {
  const dd1 = Math.min(d1.day, 30);
  const dd2 = Math.min(d2.day, 30);
  return (d2.year - d1.year) * 360 + (d2.month - d1.month) * 30 + (dd2 - dd1);
}

export function YearFrac(start_serial: number, end_serial: number, basis: number): number {
  const actual_days = end_serial - start_serial;

  switch (basis) {
    case 0: {
      const d1 = SerialToDate(start_serial);
      const d2 = SerialToDate(end_serial);
      return Days360Us(d1, d2) / 360;
    }
    case 1: {
      const d1 = SerialToDate(start_serial);
      const d2 = SerialToDate(end_serial);
      if (d1.year === d2.year) {
        return actual_days / DaysInYear(d1.year);
      }
      const num_years = d2.year - d1.year + 1;
      let total_days = 0;
      for (let y = d1.year; y <= d2.year; y++) {
        total_days += DaysInYear(y);
      }
      return actual_days / (total_days / num_years);
    }
    case 2:
      return actual_days / 360;
    case 3:
      return actual_days / 365;
    case 4: {
      const d1 = SerialToDate(start_serial);
      const d2 = SerialToDate(end_serial);
      return Days360Eu(d1, d2) / 360;
    }
    default:
      return actual_days / 360;
  }
}

// --- coupon date helpers ---

function CouponDate(mat: DateParts, mat_is_eom: boolean, months_per_period: number, num_periods_back: number): DateParts {
  const total_months = mat.year * 12 + (mat.month - 1) - num_periods_back * months_per_period;
  const new_year = Math.floor(total_months / 12);
  const new_month = total_months - new_year * 12 + 1;
  const new_day = mat_is_eom
    ? DaysInMonth(new_year, new_month)
    : Math.min(mat.day, DaysInMonth(new_year, new_month));
  return { year: new_year, month: new_month, day: new_day };
}

function CouponDateSerial(mat: DateParts, mat_is_eom: boolean, months_per_period: number, num_periods_back: number): number {
  const d = CouponDate(mat, mat_is_eom, months_per_period, num_periods_back);
  return DateToSerial(d.year, d.month, d.day);
}

interface CouponInfo {
  pcd: number;
  ncd: number;
  num: number;
}

function FindCouponInfo(settlement: number, maturity: number, frequency: number): CouponInfo {
  const mat = SerialToDate(maturity);
  const months_per_period = 12 / frequency;
  const mat_is_eom = mat.day === DaysInMonth(mat.year, mat.month);

  let num = 0;
  let coupon = maturity;

  while (coupon > settlement) {
    num++;
    coupon = CouponDateSerial(mat, mat_is_eom, months_per_period, num);
  }

  const pcd = coupon;
  const ncd = CouponDateSerial(mat, mat_is_eom, months_per_period, num - 1);

  return { pcd, ncd, num };
}

export function CoupPcdDate(settlement: number, maturity: number, frequency: number): number {
  return FindCouponInfo(settlement, maturity, frequency).pcd;
}

export function CoupNcdDate(settlement: number, maturity: number, frequency: number): number {
  return FindCouponInfo(settlement, maturity, frequency).ncd;
}

export function CoupNumValue(settlement: number, maturity: number, frequency: number): number {
  return FindCouponInfo(settlement, maturity, frequency).num;
}

function DaysBetweenForBasis(s1: number, s2: number, basis: number): number {
  if (basis === 0) {
    return Days360Us(SerialToDate(s1), SerialToDate(s2));
  }
  if (basis === 4) {
    return Days360Eu(SerialToDate(s1), SerialToDate(s2));
  }
  return s2 - s1;
}

export function CoupDaysInPeriod(settlement: number, maturity: number, frequency: number, basis: number): number {
  if (basis === 1) {
    const info = FindCouponInfo(settlement, maturity, frequency);
    return info.ncd - info.pcd;
  }
  if (basis === 3) return 365 / frequency;
  return 360 / frequency;
}

export function CoupDaysBs(settlement: number, maturity: number, frequency: number, basis: number): number {
  const pcd = CoupPcdDate(settlement, maturity, frequency);
  return DaysBetweenForBasis(pcd, settlement, basis);
}

export function CoupDaysNc(settlement: number, maturity: number, frequency: number, basis: number): number {
  return CoupDaysInPeriod(settlement, maturity, frequency, basis) -
    CoupDaysBs(settlement, maturity, frequency, basis);
}

// --- solver ---

export function BisectionSolve(
  f: (x: number) => number,
  lo: number,
  hi: number,
  tolerance: number = 1e-10,
  max_iterations: number = 200,
): number | undefined {
  let f_lo = f(lo);
  let f_hi = f(hi);
  if (f_lo * f_hi > 0) return undefined;

  for (let i = 0; i < max_iterations; i++) {
    const mid = (lo + hi) / 2;
    if ((hi - lo) / 2 < tolerance) return mid;
    const f_mid = f(mid);
    if (Math.abs(f_mid) < tolerance) return mid;
    if (f_lo * f_mid < 0) {
      hi = mid;
      f_hi = f_mid;
    } else {
      lo = mid;
      f_lo = f_mid;
    }
  }
  return (lo + hi) / 2;
}

export function NewtonSolve(
  f: (x: number) => number,
  f_prime: (x: number) => number,
  initial_guess: number,
  tolerance: number = 1e-10,
  max_iterations: number = 100,
): number | undefined {
  let x = initial_guess;
  for (let i = 0; i < max_iterations; i++) {
    const fx = f(x);
    if (Math.abs(fx) < tolerance) return x;
    const fpx = f_prime(x);
    if (fpx === 0) return undefined;
    x = x - fx / fpx;
  }
  return undefined;
}
