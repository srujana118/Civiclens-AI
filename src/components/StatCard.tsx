import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type StatCardProps = {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  trend?: string;
  className?: string;
};

export default function StatCard({ label, value, icon, trend, className }: StatCardProps) {
  return (
    <div className={cn('card p-5', className)}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-[#6b6b6b]">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-[#1e1e1e]">
            {value}
          </p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1e40af]/5 text-[#1e40af]">
          {icon}
        </div>
      </div>
      {trend && (
        <p className="mt-3 text-xs font-medium text-[#6b6b6b]">{trend}</p>
      )}
    </div>
  );
}
