import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ACTIVITY_RULES, PRIORITIES, type ActivityType } from '@/lib/activityRules';

const PRIORITY_COLOURS: Record<string, string> = {
  P1: '#dc2626',
  P2: '#f59e0b',
  P3: '#0ea5e9',
  P4: '#64748b',
};

export interface DailyPoint {
  date: string;
  label: string;
  items: number;
  workHours: number;
  lunchHours: number;
}

export interface CategoryPoint {
  type: ActivityType;
  label: string;
  value: number;
}

export interface PriorityPoint {
  priority: string;
  value: number;
}

const axisProps = {
  stroke: 'currentColor',
  tick: { fontSize: 11 },
  className: 'text-slate-500 dark:text-slate-400',
};

export function WorkloadChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip formatter={(value: number) => [`${value} items`, 'Recorded']} />
        <Bar dataKey="items" name="Items recorded" fill="#4f46e5" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryDistributionChart({ data }: { data: CategoryPoint[] }) {
  const nonZero = data.filter((point) => point.value > 0);
  if (nonZero.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={nonZero} dataKey="value" nameKey="label" innerRadius={55} outerRadius={95} paddingAngle={2}>
          {nonZero.map((point) => (
            <Cell key={point.type} fill={ACTIVITY_RULES[point.type].chartColor} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Tooltip formatter={(value: number, name: string) => [`${value} items`, name]} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function PriorityDistributionChart({ data }: { data: PriorityPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
        <XAxis dataKey="priority" {...axisProps} />
        <YAxis allowDecimals={false} {...axisProps} />
        <Tooltip formatter={(value: number) => [`${value} items`, 'Recorded']} />
        <Bar dataKey="value" name="Items" radius={[4, 4, 0, 0]}>
          {data.map((point) => (
            <Cell key={point.priority} fill={PRIORITY_COLOURS[point.priority] ?? '#4f46e5'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function WorkingHoursChart({ data }: { data: DailyPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -12 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-slate-200 dark:stroke-slate-800" />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} unit="h" />
        <Tooltip formatter={(value: number, name: string) => [`${value} h`, name]} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Line type="monotone" dataKey="workHours" name="Working hours" stroke="#4f46e5" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="lunchHours" name="Lunch hours" stroke="#f59e0b" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export const PRIORITY_KEYS = PRIORITIES;
