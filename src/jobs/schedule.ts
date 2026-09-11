import { KeliError } from "../core/errors.ts";

export type IntervalSchedule = { kind: "interval"; seconds: number };
export type DailySchedule = { kind: "daily"; hour: number; minute: number };
export type ParsedSchedule = IntervalSchedule | DailySchedule;

export function parseSchedule(raw: string): ParsedSchedule {
  const input = raw.trim();
  const every = input.match(/^every:(\d+)(s|m|h)$/i);
  if (every) {
    const amount = Number(every[1]);
    const unit = every[2].toLowerCase();
    const seconds = unit === "s" ? amount : unit === "m" ? amount * 60 : amount * 3600;
    if (seconds < 1) {
      throw new KeliError("Interval must be at least 1 second", "invalid_request");
    }
    return { kind: "interval", seconds };
  }

  const daily = input.match(/^daily:(\d{2}):(\d{2})$/);
  if (daily) {
    const hour = Number(daily[1]);
    const minute = Number(daily[2]);
    if (hour > 23 || minute > 59) {
      throw new KeliError("daily:HH:MM hour/minute out of range", "invalid_request");
    }
    return { kind: "daily", hour, minute };
  }

  throw new KeliError(
    `Unsupported schedule '${raw}'. Use every:<n>s|m|h or daily:HH:MM (UTC).`,
    "invalid_request",
  );
}

/** Next scheduled instant strictly after `after` (UTC). */
export function nextOccurrence(schedule: ParsedSchedule, after: Date): Date {
  if (schedule.kind === "interval") {
    return new Date(after.getTime() + schedule.seconds * 1000);
  }

  const next = new Date(after);
  next.setUTCSeconds(0, 0);
  next.setUTCHours(schedule.hour, schedule.minute, 0, 0);
  if (next.getTime() <= after.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next;
}

/** Latest due slot at or before `now`, coalescing any missed intermediate ticks (D8). */
export function coalescedDueOccurrence(
  schedule: ParsedSchedule,
  anchor: Date,
  now: Date,
): { dueAt: Date; missedSlots: number } | null {
  let dueAt = nextOccurrence(schedule, anchor);
  if (dueAt.getTime() > now.getTime()) return null;

  let missedSlots = 1;
  while (true) {
    const next = nextOccurrence(schedule, dueAt);
    if (next.getTime() > now.getTime()) break;
    dueAt = next;
    missedSlots += 1;
  }
  return { dueAt, missedSlots };
}
