import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, TrendingUp, ArrowRight, BarChart3 } from 'lucide-react';
import { supabase, type CivicReport, REPORT_CATEGORIES } from '@/lib/supabase';
import PageHeader from '@/components/PageHeader';
import { formatDate } from '@/lib/utils';

export default function Trends() {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data } = await supabase
        .from('civic_reports')
        .select('*')
        .order('created_at', { ascending: true });
      setReports(data ?? []);
      setLoading(false);
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div>
        <PageHeader title="Trends" subtitle="Track how report volumes and categories change over time." />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" />
        </div>
      </div>
    );
  }

  // Build time-series: group by day
  const dayMap = new Map<string, number>();
  reports.forEach((r) => {
    const day = formatDate(r.created_at);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  });
  const timeSeries = [...dayMap.entries()].slice(-14);

  // Category trends over time
  const catDayMap = new Map<string, Map<string, number>>();
  reports.forEach((r) => {
    const day = formatDate(r.created_at);
    if (!catDayMap.has(r.category)) catDayMap.set(r.category, new Map());
    const dayCat = catDayMap.get(r.category)!;
    dayCat.set(day, (dayCat.get(day) ?? 0) + 1);
  });

  const maxDaily = Math.max(...timeSeries.map(([, c]) => c), 1);

  // Category totals
  const catTotals = REPORT_CATEGORIES.map((cat) => {
    const catReports = reports.filter((r) => r.category === cat);
    return { category: cat, count: catReports.length };
  })
    .filter((c) => c.count > 0)
    .sort((a, b) => b.count - a.count);

  return (
    <div>
      <PageHeader title="Trends" subtitle="Track how report volumes and categories change over time." />
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 lg:px-8">
        {reports.length === 0 ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af]/5">
              <TrendingUp className="h-7 w-7 text-[#1e40af]" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-[#1e1e1e]">No trend data yet</h3>
            <p className="mt-2 max-w-md text-sm text-[#6b6b6b]">
              As reports accumulate, you'll see daily report volumes, category
              trends, and emerging patterns over time.
            </p>
            <Link to="/report" className="btn-primary mt-6">
              Report an Issue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <>
            {/* Daily volume chart */}
            <div className="card p-6">
              <h3 className="text-base font-semibold text-[#1e1e1e]">Report Volume Over Time</h3>
              <p className="mt-1 text-sm text-[#6b6b6b]">Daily count of submitted reports</p>
              <div className="mt-8 flex h-48 items-end gap-2">
                {timeSeries.map(([day, count]) => (
                  <div key={day} className="group flex flex-1 flex-col items-center gap-2">
                    <div className="relative flex w-full flex-1 items-end">
                      <div
                        className="w-full rounded-t-md bg-[#1e40af] transition-all duration-500 group-hover:bg-[#1e3a8a]"
                        style={{ height: `${(count / maxDaily) * 100}%`, minHeight: count > 0 ? '8px' : '0' }}
                      />
                      <div className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-md bg-[#1e1e1e] px-2 py-1 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 whitespace-nowrap">
                        {count} reports
                      </div>
                    </div>
                    <span className="text-[10px] text-[#9b9b9b] whitespace-nowrap">
                      {day.split(',')[0]}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Category distribution */}
              <div className="card p-6">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[#1e40af]" />
                  <h3 className="text-base font-semibold text-[#1e1e1e]">Category Distribution</h3>
                </div>
                <p className="mt-1 text-sm text-[#6b6b6b]">Total reports per category</p>
                <div className="mt-6 space-y-3">
                  {catTotals.map((cat) => {
                    const maxCount = Math.max(...catTotals.map((c) => c.count), 1);
                    return (
                      <div key={cat.category}>
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium text-[#1e1e1e]">{cat.category}</span>
                          <span className="text-[#6b6b6b]">{cat.count}</span>
                        </div>
                        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f0f0f0]">
                          <div
                            className="h-full rounded-full bg-[#1e40af] transition-all duration-700"
                            style={{ width: `${(cat.count / maxCount) * 100}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Category trends over time */}
              <div className="card p-6">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#1e40af]" />
                  <h3 className="text-base font-semibold text-[#1e1e1e]">Category Timeline</h3>
                </div>
                <p className="mt-1 text-sm text-[#6b6b6b]">When each category was reported</p>
                <div className="mt-6 space-y-3 max-h-[300px] overflow-y-auto">
                  {[...catDayMap.entries()].sort((a, b) => {
                    const aTotal = [...a[1].values()].reduce((s, n) => s + n, 0);
                    const bTotal = [...b[1].values()].reduce((s, n) => s + n, 0);
                    return bTotal - aTotal;
                  }).map(([cat, days]) => {
                    const total = [...days.values()].reduce((s, n) => s + n, 0);
                    const lastDay = [...days.keys()].pop();
                    return (
                      <div key={cat} className="flex items-center justify-between rounded-lg border border-[#e5e5e5] px-4 py-3">
                        <div>
                          <span className="text-sm font-medium text-[#1e1e1e]">{cat}</span>
                          <p className="text-xs text-[#9b9b9b]">
                            {total} report{total !== 1 ? 's' : ''} · Last: {lastDay}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          {[...days.entries()].slice(-5).map(([day, count]) => (
                            <div
                              key={day}
                              className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1e40af]/5 text-xs font-semibold text-[#1e40af]"
                              title={`${day}: ${count} reports`}
                            >
                              {count}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
