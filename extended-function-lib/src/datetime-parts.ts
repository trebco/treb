import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { DateToSerial } from './finance-date-utils';

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
