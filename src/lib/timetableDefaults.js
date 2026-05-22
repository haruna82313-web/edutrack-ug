export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const DEFAULT_PERIODS = [
  { period: 1, start: '08:00', end: '09:20' },
  { period: 2, start: '09:20', end: '10:40' },
  { period: 3, start: '10:40', end: '11:00' },
  { period: 4, start: '11:00', end: '12:00' },
  { period: 5, start: '12:00', end: '13:00' },
  { period: 6, start: '13:00', end: '14:00' },
  { period: 7, start: '14:00', end: '15:20' },
  { period: 8, start: '15:20', end: '16:40' },
];

export const MAX_STREAMS = 18;

export const slotKey = (day, period) => `${day}-${period}`;

export const parseSlotKey = (key) => {
  const [day, period] = key.split('-').map(Number);
  return { day, period };
};
