import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError, NAError } from 'treb-calculator';
import { DateToSerial, SerialToDate, DaysInMonth, Days360Us, Days360Eu } from './finance-date-utils';
import { extractNumbers } from './stats-array-utils';

AddExtendedFunction('HOUR', {
  description: 'Returns the hour from a time value',
  arguments: [
    { name: 'serial_number', description: 'The time as a serial number', unroll: true },
  ],
  fn: (serial?: number): UnionValue => {
    if (serial === undefined) return ValueError();
    const fraction = serial - Math.floor(serial);
    const total_seconds = Math.round(fraction * 86400);
    return Box(Math.floor(total_seconds / 3600) % 24);
  },
});

AddExtendedFunction('MINUTE', {
  description: 'Returns the minute from a time value',
  arguments: [
    { name: 'serial_number', description: 'The time as a serial number', unroll: true },
  ],
  fn: (serial?: number): UnionValue => {
    if (serial === undefined) return ValueError();
    const fraction = serial - Math.floor(serial);
    const total_seconds = Math.round(fraction * 86400);
    return Box(Math.floor(total_seconds / 60) % 60);
  },
});

AddExtendedFunction('SECOND', {
  description: 'Returns the second from a time value',
  arguments: [
    { name: 'serial_number', description: 'The time as a serial number', unroll: true },
  ],
  fn: (serial?: number): UnionValue => {
    if (serial === undefined) return ValueError();
    const fraction = serial - Math.floor(serial);
    const total_seconds = Math.round(fraction * 86400);
    return Box(total_seconds % 60);
  },
});

AddExtendedFunction('TIME', {
  description: 'Returns the serial number for a given time',
  arguments: [
    { name: 'hour', description: 'The hour (0-23)', unroll: true },
    { name: 'minute', description: 'The minute (0-59)' },
    { name: 'second', description: 'The second (0-59)' },
  ],
  fn: (hour?: number, minute?: number, second?: number): UnionValue => {
    if (hour === undefined || minute === undefined || second === undefined) return ValueError();
    const total_seconds = Math.trunc(hour) * 3600 + Math.trunc(minute) * 60 + Math.trunc(second);
    return Box(total_seconds / 86400);
  },
});

AddExtendedFunction('TIMEVALUE', {
  description: 'Converts a time in text format to a serial number',
  arguments: [
    { name: 'time_text', description: 'A text string representing a time', unroll: true },
  ],
  fn: (time_text?: string): UnionValue => {
    if (time_text === undefined) return ValueError();
    const text = String(time_text).trim();

    const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i);
    if (!match) return ValueError();

    let hours = parseInt(match[1], 10);
    const minutes = parseInt(match[2], 10);
    const seconds = match[3] ? parseInt(match[3], 10) : 0;
    const ampm = match[4]?.toUpperCase();

    if (ampm) {
      if (hours < 1 || hours > 12) return ValueError();
      if (ampm === 'AM' && hours === 12) hours = 0;
      if (ampm === 'PM' && hours !== 12) hours += 12;
    }

    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59) {
      return ValueError();
    }

    const total_seconds = hours * 3600 + minutes * 60 + seconds;
    return Box(total_seconds / 86400);
  },
});

AddExtendedFunction('DATEVALUE', {
  description: 'Converts a date in text format to a serial number',
  arguments: [
    { name: 'date_text', description: 'A text string representing a date', unroll: true },
  ],
  fn: (date_text?: string): UnionValue => {
    if (date_text === undefined) return ValueError();
    const text = String(date_text).trim();
    const d = new Date(text);
    if (isNaN(d.getTime())) return ValueError();
    return Box(DateToSerial(d.getFullYear(), d.getMonth() + 1, d.getDate()));
  },
});

AddExtendedFunction('DAYS', {
  description: 'Returns the number of days between two dates',
  arguments: [
    { name: 'end_date', description: 'The end date', unroll: true },
    { name: 'start_date', description: 'The start date' },
  ],
  fn: (end_date?: number, start_date?: number): UnionValue => {
    if (end_date === undefined || start_date === undefined) return ValueError();
    return Box(Math.floor(end_date) - Math.floor(start_date));
  },
});

AddExtendedFunction('DAYS360', {
  description: 'Returns the number of days between two dates based on a 360-day year',
  arguments: [
    { name: 'start_date', description: 'The start date', unroll: true },
    { name: 'end_date', description: 'The end date' },
    { name: 'method', description: 'FALSE=US (default), TRUE=European' },
  ],
  fn: (start_date?: number, end_date?: number, method?: boolean): UnionValue => {
    if (start_date === undefined || end_date === undefined) return ValueError();
    const d1 = SerialToDate(Math.trunc(start_date));
    const d2 = SerialToDate(Math.trunc(end_date));
    if (method) {
      return Box(Days360Eu(d1, d2));
    }
    return Box(Days360Us(d1, d2));
  },
});

AddExtendedFunction('DATEDIF', {
  description: 'Calculates the number of days, months, or years between two dates',
  arguments: [
    { name: 'start_date', description: 'The start date', unroll: true },
    { name: 'end_date', description: 'The end date' },
    { name: 'unit', description: 'The type of information (Y, M, D, MD, YM, YD)' },
  ],
  fn: (start_date?: number, end_date?: number, unit?: string): UnionValue => {
    if (start_date === undefined || end_date === undefined || unit === undefined) return ValueError();
    const s = Math.trunc(start_date);
    const e = Math.trunc(end_date);
    if (s > e) return ValueError();
    const d1 = SerialToDate(s);
    const d2 = SerialToDate(e);

    switch (String(unit).toUpperCase()) {
      case 'Y': {
        let years = d2.year - d1.year;
        if (d2.month < d1.month || (d2.month === d1.month && d2.day < d1.day)) years--;
        return Box(years);
      }
      case 'M': {
        let months = (d2.year - d1.year) * 12 + (d2.month - d1.month);
        if (d2.day < d1.day) months--;
        return Box(months);
      }
      case 'D':
        return Box(e - s);
      case 'MD': {
        let days = d2.day - d1.day;
        if (days < 0) {
          const prev_month = d2.month === 1 ? 12 : d2.month - 1;
          const prev_year = d2.month === 1 ? d2.year - 1 : d2.year;
          days += DaysInMonth(prev_year, prev_month);
        }
        return Box(days);
      }
      case 'YM': {
        let months = d2.month - d1.month;
        if (d2.day < d1.day) months--;
        if (months < 0) months += 12;
        return Box(months);
      }
      case 'YD': {
        let end_serial = DateToSerial(d1.year, d2.month, d2.day);
        if (end_serial < s) {
          end_serial = DateToSerial(d1.year + 1, d2.month, d2.day);
        }
        return Box(end_serial - s);
      }
      default:
        return ValueError();
    }
  },
});

function SerialToJsDate(serial: number): Date {
  const d = SerialToDate(Math.trunc(serial));
  return new Date(d.year, d.month - 1, d.day);
}

function DayOfWeek(serial: number): number {
  const d = SerialToJsDate(serial);
  return d.getDay();
}

AddExtendedFunction('WEEKDAY', {
  description: 'Returns the day of the week for a date',
  arguments: [
    { name: 'serial_number', description: 'The date', unroll: true },
    { name: 'return_type', description: 'Numbering system (1=Sun-Sat 1-7, 2=Mon-Sun 1-7, 3=Mon-Sun 0-6)' },
  ],
  fn: (serial?: number, return_type?: number): UnionValue => {
    if (serial === undefined) return ValueError();
    const dow = DayOfWeek(Math.trunc(serial));
    const rt = return_type === undefined ? 1 : Math.trunc(return_type);

    switch (rt) {
      case 1: return Box(dow + 1);
      case 2: return Box(dow === 0 ? 7 : dow);
      case 3: return Box(dow === 0 ? 6 : dow - 1);
      default: return ValueError();
    }
  },
});

AddExtendedFunction('ISOWEEKNUM', {
  description: 'Returns the ISO week number of a date',
  arguments: [
    { name: 'date', description: 'The date', unroll: true },
  ],
  fn: (serial?: number): UnionValue => {
    if (serial === undefined) return ValueError();
    const d = SerialToJsDate(Math.trunc(serial));
    const temp = new Date(d.getTime());
    temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
    const jan4 = new Date(temp.getFullYear(), 0, 4);
    const day_diff = Math.round((temp.getTime() - jan4.getTime()) / 86400000);
    return Box(Math.ceil((day_diff + 1) / 7));
  },
});

AddExtendedFunction('WEEKNUM', {
  description: 'Returns the week number of a date',
  arguments: [
    { name: 'serial_number', description: 'The date', unroll: true },
    { name: 'return_type', description: '1=week starts Sunday (default), 2=week starts Monday' },
  ],
  fn: (serial?: number, return_type?: number): UnionValue => {
    if (serial === undefined) return ValueError();
    const rt = return_type === undefined ? 1 : Math.trunc(return_type);
    const d = SerialToJsDate(Math.trunc(serial));
    const jan1 = new Date(d.getFullYear(), 0, 1);
    const day_of_year = Math.floor((d.getTime() - jan1.getTime()) / 86400000);

    let week_start_offset: number;
    if (rt === 1) {
      week_start_offset = jan1.getDay();
    } else if (rt === 2) {
      week_start_offset = (jan1.getDay() + 6) % 7;
    } else {
      return ValueError();
    }

    return Box(Math.floor((day_of_year + week_start_offset) / 7) + 1);
  },
});

function ParseWeekendSpec(weekend?: number | string): boolean[] {
  const result = [false, false, false, false, false, false, false];
  if (weekend === undefined || weekend === 1) {
    result[0] = true; result[6] = true;
    return result;
  }
  if (typeof weekend === 'string') {
    const s = String(weekend);
    if (s.length !== 7 || !/^[01]{7}$/.test(s)) return [];
    for (let i = 0; i < 7; i++) {
      result[(i + 1) % 7] = s[i] === '1';
    }
    if (result.every(v => v)) return [];
    return result;
  }
  const num = Math.trunc(weekend as number);
  const map: Record<number, [number, number]> = {
    1: [6, 0], 2: [0, 1], 3: [1, 2], 4: [2, 3], 5: [3, 4], 6: [4, 5], 7: [5, 6],
    11: [0, -1], 12: [1, -1], 13: [2, -1], 14: [3, -1], 15: [4, -1], 16: [5, -1], 17: [6, -1],
  };
  const entry = map[num];
  if (!entry) return [];
  result[entry[0]] = true;
  if (entry[1] >= 0) result[entry[1]] = true;
  return result;
}

function IsWeekend(dow: number, weekend_days: boolean[]): boolean {
  return weekend_days[dow];
}

function ExtractHolidaySerials(holidays?: UnionValue): number[] {
  if (!holidays) return [];
  if (holidays.type === ValueType.number) return [Math.trunc(holidays.value)];
  if (holidays.type === ValueType.array) {
    return extractNumbers(holidays).map(n => Math.trunc(n));
  }
  return [];
}

function IsHoliday(serial: number, holidays: number[]): boolean {
  return holidays.includes(serial);
}

AddExtendedFunction('NETWORKDAYS', {
  description: 'Returns the number of working days between two dates',
  arguments: [
    { name: 'start_date', description: 'The start date', unroll: true },
    { name: 'end_date', description: 'The end date' },
    { name: 'holidays', description: 'Optional range of holiday dates', boxed: true },
  ],
  fn: (start_date?: number, end_date?: number, holidays?: UnionValue): UnionValue => {
    if (start_date === undefined || end_date === undefined) return ValueError();
    const s = Math.trunc(start_date);
    const e = Math.trunc(end_date);
    const holiday_list = ExtractHolidaySerials(holidays);
    const weekend_days = ParseWeekendSpec(1);

    const direction = s <= e ? 1 : -1;
    const from = Math.min(s, e);
    const to = Math.max(s, e);
    let count = 0;
    for (let d = from; d <= to; d++) {
      const dow = DayOfWeek(d);
      if (!IsWeekend(dow, weekend_days) && !IsHoliday(d, holiday_list)) count++;
    }
    return Box(count * direction);
  },
});

AddExtendedFunction('NETWORKDAYS.INTL', {
  description: 'Returns the number of working days between two dates with custom weekends',
  arguments: [
    { name: 'start_date', description: 'The start date', unroll: true },
    { name: 'end_date', description: 'The end date' },
    { name: 'weekend', description: 'Weekend specification (number or 7-char string)' },
    { name: 'holidays', description: 'Optional range of holiday dates', boxed: true },
  ],
  fn: (start_date?: number, end_date?: number, weekend?: number | string, holidays?: UnionValue): UnionValue => {
    if (start_date === undefined || end_date === undefined) return ValueError();
    const s = Math.trunc(start_date);
    const e = Math.trunc(end_date);
    const weekend_days = ParseWeekendSpec(weekend);
    if (weekend_days.length === 0) return ValueError();
    const holiday_list = ExtractHolidaySerials(holidays);

    const direction = s <= e ? 1 : -1;
    const from = Math.min(s, e);
    const to = Math.max(s, e);
    let count = 0;
    for (let d = from; d <= to; d++) {
      const dow = DayOfWeek(d);
      if (!IsWeekend(dow, weekend_days) && !IsHoliday(d, holiday_list)) count++;
    }
    return Box(count * direction);
  },
});

AddExtendedFunction('WORKDAY', {
  description: 'Returns a date that is a given number of working days from the start date',
  arguments: [
    { name: 'start_date', description: 'The start date', unroll: true },
    { name: 'days', description: 'Number of working days' },
    { name: 'holidays', description: 'Optional range of holiday dates', boxed: true },
  ],
  fn: (start_date?: number, days?: number, holidays?: UnionValue): UnionValue => {
    if (start_date === undefined || days === undefined) return ValueError();
    let current = Math.trunc(start_date);
    let remaining = Math.trunc(days);
    const holiday_list = ExtractHolidaySerials(holidays);
    const weekend_days = ParseWeekendSpec(1);
    const direction = remaining >= 0 ? 1 : -1;
    remaining = Math.abs(remaining);

    while (remaining > 0) {
      current += direction;
      const dow = DayOfWeek(current);
      if (!IsWeekend(dow, weekend_days) && !IsHoliday(current, holiday_list)) {
        remaining--;
      }
    }
    return Box(current);
  },
});

AddExtendedFunction('WORKDAY.INTL', {
  description: 'Returns a date that is a given number of working days from the start date with custom weekends',
  arguments: [
    { name: 'start_date', description: 'The start date', unroll: true },
    { name: 'days', description: 'Number of working days' },
    { name: 'weekend', description: 'Weekend specification (number or 7-char string)' },
    { name: 'holidays', description: 'Optional range of holiday dates', boxed: true },
  ],
  fn: (start_date?: number, days?: number, weekend?: number | string, holidays?: UnionValue): UnionValue => {
    if (start_date === undefined || days === undefined) return ValueError();
    let current = Math.trunc(start_date);
    let remaining = Math.trunc(days);
    const weekend_days = ParseWeekendSpec(weekend);
    if (weekend_days.length === 0) return ValueError();
    const holiday_list = ExtractHolidaySerials(holidays);
    const direction = remaining >= 0 ? 1 : -1;
    remaining = Math.abs(remaining);

    while (remaining > 0) {
      current += direction;
      const dow = DayOfWeek(current);
      if (!IsWeekend(dow, weekend_days) && !IsHoliday(current, holiday_list)) {
        remaining--;
      }
    }
    return Box(current);
  },
});
