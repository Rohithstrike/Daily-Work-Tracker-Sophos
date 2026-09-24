import { Card, CardHeader } from '@/components/ui/Card';
import {
  CategoryDistributionChart,
  PriorityDistributionChart,
  WorkingHoursChart,
  WorkloadChart,
  type CategoryPoint,
  type DailyPoint,
  type PriorityPoint,
} from '@/features/dashboard/DashboardCharts';

/**
 * Chart panel kept in its own module so Recharts stays in a lazy chunk and is
 * never downloaded by the Today page.
 */
export default function ChartsPanel({
  dailyPoints,
  categoryPoints,
  priorityPoints,
}: {
  dailyPoints: DailyPoint[];
  categoryPoints: CategoryPoint[];
  priorityPoints: PriorityPoint[];
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card>
        <CardHeader title="Daily workload" description="Items recorded per day." />
        <WorkloadChart data={dailyPoints} />
      </Card>
      <Card>
        <CardHeader title="Work category distribution" description="Share of items by category." />
        <CategoryDistributionChart data={categoryPoints} />
      </Card>
      <Card>
        <CardHeader
          title="Priority distribution"
          description="Across Case, AR, Dupe and Peer Review only."
        />
        <PriorityDistributionChart data={priorityPoints} />
      </Card>
      <Card>
        <CardHeader title="Working hours by day" description="Working time against lunch time." />
        <WorkingHoursChart data={dailyPoints} />
      </Card>
    </div>
  );
}
