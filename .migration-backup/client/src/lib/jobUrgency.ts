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

export function getJobUrgency(scheduledAt: string | Date | null | undefined, status: string): JobUrgency | null {
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
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800',
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
      color: 'text-orange-600 dark:text-orange-400',
      bgColor: 'bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800',
      animate: true,
    };
  }

  if (isToday(scheduledDate)) {
    return {
      level: 'today',
      label: `Today at ${format(scheduledDate, 'h:mm a')}`,
      shortLabel: 'Today',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    };
  }

  if (isTomorrow(scheduledDate)) {
    return {
      level: 'tomorrow',
      label: `Tomorrow at ${format(scheduledDate, 'h:mm a')}`,
      shortLabel: 'Tomorrow',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-100 dark:bg-purple-900/30 border-purple-200 dark:border-purple-800',
    };
  }

  if (hoursUntil <= 72) {
    return {
      level: 'upcoming',
      label: format(scheduledDate, 'EEE, MMM d'),
      shortLabel: format(scheduledDate, 'EEE'),
      color: 'text-slate-600 dark:text-slate-400',
      bgColor: 'bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700',
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
