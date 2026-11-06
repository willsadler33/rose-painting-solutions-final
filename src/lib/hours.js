import { business } from '../data/site.js'

/** Returns true if the business is open right now in its own time zone. */
export function isOpenNow(date = new Date()) {
  const { openDays, openHour, closeHour, timeZone } = business.hours
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: 'numeric',
      minute: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(date)
    const get = (t) => parts.find((p) => p.type === t)?.value
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
    const minutes = Number(get('hour')) * 60 + Number(get('minute'))
    return openDays.includes(day) && minutes >= openHour * 60 && minutes < closeHour * 60
  } catch {
    return null
  }
}
