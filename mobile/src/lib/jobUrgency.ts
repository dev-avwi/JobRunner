import { differenceInHours, differenceInMinutes, isToday, isTomorrow, isPast, format } from "date-fns";

export type UrgencyLevel = 'overdue' | 'starting_soon' | 'today' | 'tomorrow' | 'upcoming' | 'none';

export interface JobUrgency {
  level: UrgencyLevel;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  animate?: boolean;
}

export function getJobUrgency(scheduledAt: string | Date | null | undefined, status: string, isDark?: boolean): JobUrgency | null {
  if (!scheduledAt || status === 'done' || status === 'invoiced' || status === 'in_progress') {
    return null;
  }

  const scheduledDate = new Date(scheduledAt);
  const now = new Date();

  if (status === 'scheduled' && isPast(scheduledDate)) {
    const hoursOverdue = differenceInHours(now, scheduledDate);
    return {
      level: 'overdue',
      label: hoursOverdue > 24 
        ? `Overdue by ${Math.floor(hoursOverdue / 24)}d`
        : hoursOverdue > 0 
          ? `Overdue by ${hoursOverdue}h`
          : 'Overdue',
      shortLabel: 'Overdue',
      color: isDark ? '#f87171' : '#dc2626',
      bgColor: isDark ? 'rgba(220,38,38,0.15)' : '#fef2f2',
      animate: true,
    };
  }

  const minutesUntil = differenceInMinutes(scheduledDate, now);
  const hoursUntil = differenceInHours(scheduledDate, now);

  if (minutesUntil <= 60 && minutesUntil > 0) {
    return {
      level: 'starting_soon',
      label: minutesUntil <= 15 
        ? `Starting in ${minutesUntil}m`
        : `Starting in ${Math.round(minutesUntil / 15) * 15}m`,
      shortLabel: `${minutesUntil}m`,
      color: isDark ? '#fb923c' : '#ea580c',
      bgColor: isDark ? 'rgba(234,88,12,0.15)' : '#fff7ed',
      animate: true,
    };
  }

  if (isToday(scheduledDate)) {
    return {
      level: 'today',
      label: `Today at ${format(scheduledDate, 'h:mm a')}`,
      shortLabel: 'Today',
      color: isDark ? '#60a5fa' : '#2563eb',
      bgColor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
    };
  }

  if (isTomorrow(scheduledDate)) {
    return {
      level: 'tomorrow',
      label: `Tomorrow at ${format(scheduledDate, 'h:mm a')}`,
      shortLabel: 'Tomorrow',
      color: isDark ? '#a78bfa' : '#7c3aed',
      bgColor: isDark ? 'rgba(124,58,237,0.15)' : '#f5f3ff',
    };
  }

  if (hoursUntil <= 72) {
    return {
      level: 'upcoming',
      label: format(scheduledDate, 'EEE, MMM d'),
      shortLabel: format(scheduledDate, 'EEE'),
      color: isDark ? '#94a3b8' : '#64748b',
      bgColor: isDark ? 'rgba(100,116,139,0.15)' : '#f1f5f9',
    };
  }

  return null;
}

export function getInProgressDuration(startedAt: string | Date | null | undefined): string | null {
  if (!startedAt) return null;
  
  const start = new Date(startedAt);
  const now = new Date();
  const minutes = differenceInMinutes(now, start);
  
  if (minutes < 60) {
    return `${minutes}m`;
  }
  
  const hours = Math.floor(minutes / 60);
  const remainingMins = minutes % 60;
  
  if (hours < 24) {
    return remainingMins > 0 ? `${hours}h ${remainingMins}m` : `${hours}h`;
  }
  
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
