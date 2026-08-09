/**
 * Date utility functions for filtering dashboard data
 */

export interface DatePartition<T> {
  recent: T[];
  older: T[];
}

/**
 * Partitions an array of items into recent (last 14 days) and older items
 * @param items Array of items with date properties
 * @param dateField The field name containing the date (e.g., 'createdAt', 'scheduledAt')
 * @returns Object with recent and older arrays
 */
export function partitionByRecent<T extends Record<string, any>>(
  items: T[],
  dateField: keyof T = 'createdAt' as keyof T
): DatePartition<T> {
  if (!items || !Array.isArray(items)) {
    return { recent: [], older: [] };
  }

  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  twoWeeksAgo.setHours(0, 0, 0, 0);

  const recent: T[] = [];
  const older: T[] = [];

  items.forEach(item => {
    const itemDate = item[dateField];
    if (!itemDate) {
      // If no date, put in older by default
      older.push(item);
      return;
    }

    const date = new Date(itemDate);
    if (isNaN(date.getTime())) {
      // Invalid date, put in older
      older.push(item);
      return;
    }

    if (date >= twoWeeksAgo) {
      recent.push(item);
    } else {
      older.push(item);
    }
  });

  // Sort recent items by date (newest first)
  recent.sort((a, b) => {
    const dateA = new Date(a[dateField]);
    const dateB = new Date(b[dateField]);
    return dateB.getTime() - dateA.getTime();
  });

  // Sort older items by date (newest first)
  older.sort((a, b) => {
    const dateA = new Date(a[dateField]);
    const dateB = new Date(b[dateField]);
    return dateB.getTime() - dateA.getTime();
  });

  return { recent, older };
}

/**
 * Formats a date for display in history sections
 */
export function formatHistoryDate(date: string | Date): string {
  if (!date) return 'No date';
  
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Invalid date';
  
  const now = new Date();
  const diffInDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffInDays === 0) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 7) return `${diffInDays} days ago`;
  if (diffInDays < 14) return `${Math.floor(diffInDays / 7)} week${Math.floor(diffInDays / 7) > 1 ? 's' : ''} ago`;
  
  return d.toLocaleDateString();
}

/**
 * Gets the status color for different item types
 */
export function getStatusColor(status: string): string {
  const statusColors: Record<string, string> = {
    'pending': 'hsl(var(--chart-3))',
    'in-progress': 'hsl(var(--chart-2))', 
    'completed': 'hsl(var(--chart-1))',
    'cancelled': 'hsl(var(--destructive))',
    'draft': 'hsl(var(--muted-foreground))',
    'sent': 'hsl(var(--chart-2))',
    'accepted': 'hsl(var(--chart-1))',
    'rejected': 'hsl(var(--destructive))',
    'paid': 'hsl(var(--chart-1))',
    'overdue': 'hsl(var(--destructive))',
  };
  
  return statusColors[status.toLowerCase()] || 'hsl(var(--muted-foreground))';
}