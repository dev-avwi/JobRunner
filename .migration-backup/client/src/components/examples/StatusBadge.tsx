import StatusBadge from '../StatusBadge';

export default function StatusBadgeExample() {
  return (
    <div className="flex flex-wrap gap-2 p-4">
      <StatusBadge status="pending" />
      <StatusBadge status="in_progress" />
      <StatusBadge status="done" />
      <StatusBadge status="sent" />
      <StatusBadge status="paid" />
      <StatusBadge status="overdue" />
    </div>
  );
}