import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'

export const mondayStartOptions = { weekStartsOn: 1 }

export function monthLabel(date) {
  return format(date, "MMMM yyyy")
}

export function isoDate(date) {
  return format(date, 'yyyy-MM-dd')
}

export function friendlyDate(date) {
  return format(date, "EEEE, d 'de' MMMM")
}

export function buildMonthGrid(date) {
  const start = startOfWeek(startOfMonth(date), mondayStartOptions)
  const end = endOfWeek(endOfMonth(date), mondayStartOptions)
  const days = []
  let current = start

  while (current <= end) {
    days.push(current)
    current = addDays(current, 1)
  }

  return days
}

export function shiftMonth(date, amount) {
  return addMonths(date, amount)
}

export function sameDay(a, b) {
  return isSameDay(a, b)
}

export function inCurrentMonth(date, currentMonth) {
  return isSameMonth(date, currentMonth)
}
