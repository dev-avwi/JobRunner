/** Converts logged minutes into a dollar amount at an hourly rate. */
export function calculateEarnings(minutes: number, hourlyRate: number): number {
  return (minutes / 60) * hourlyRate;
}
