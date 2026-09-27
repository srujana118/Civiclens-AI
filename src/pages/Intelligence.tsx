import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FileText,
  TrendingUp,
  Tags,
  Activity,
  ArrowRight,
  Loader2,
  MapPin,
  CircleDot,
  Zap,
  Calendar,
} from 'lucide-react';
import { supabase, type CivicReport } from '@/lib/supabase';
import { detectHotspots, type Cluster } from '@/lib/clustering';
import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { formatRelative } from '@/lib/utils';

type CategoryCount = { category: string; count: number };
type AreaCount = { location: string; count: number };

export default function Intelligence() {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [areaCounts, setAreaCounts] = useState<AreaCount[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      const { data: allReports } = await supabase
        .from('civic_reports')
        .select('*')
        .order('created_at', { ascending: false });

      const reportList = allReports ?? [];
      setReports(reportList);
      setTotalReports(reportList.length);

      // Category breakdown
      const catMap = new Map<string, number>();
      reportList.forEach((r) => {
        catMap.set(r.category, (catMap.get(r.category) ?? 0) + 1);
      });
      setCategoryCounts(
        [...catMap.entries()]
          .map(([category, count]) => ({ category, count }))
          .sort((a, b) => b.count - a.count)
      );

      // Area breakdown — extract first part of location for grouping
      const areaMap = new Map<string, number>();
      reportList.forEach((r) => {
        const area = r.location.split(',')[0].trim();
        areaMap.set(area, (areaMap.get(area) ?? 0) + 1);
      });
      setAreaCounts(
        [...areaMap.entries()]
          .map(([location, count]) => ({ location, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      );

      // Detect geographic hotspots
      setClusters(detectHotspots(reportList));

      setLoading(false);
    }
    fetchData();
  }, []);

  const maxCatCount = Math.max(...categoryCounts.map((c) => c.count), 1);
  const recentReports = reports.slice(0, 8);

  if (loading) {
    return (
      <div>
        <PageHeader title="Intelligence" subtitle="A real-time view of community-reported civic issues." />
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Intelligence" subtitle="A real-time view of community-reported civic issues." />
      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">
        {/* Stat cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Reports"
            value={totalReports}
            icon={<FileText className="h-5 w-5" />}
            trend={totalReports === 0 ? 'No reports yet' : 'All time'}
          />
          <StatCard
            label="Emerging Areas"
            value={clusters.length}
            icon={<TrendingUp className="h-5 w-5" />}
            trend={
              clusters.length === 0
                ? 'No clusters detected'
                : `${clusters.length} hotspot${clusters.length !== 1 ? 's' : ''}`
            }
          />
          <StatCard
            label="Issue Categories"
            value={categoryCounts.length}
            icon={<Tags className="h-5 w-5" />}
            trend={categoryCounts.length === 0 ? 'No categories' : 'Distinct types'}
          />
          <StatCard
            label="Recent Activity"
            value={recentReports.length}
            icon={<Activity className="h-5 w-5" />}
            trend="Latest reports"
          />
        </div>

        {totalReports === 0 ? (
          <div className="card flex flex-col items-center p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af]/5">
              <FileText className="h-7 w-7 text-[#1e40af]" />
            </div>
            <h3 className="mt-5 text-lg font-semibold text-[#1e1e1e]">No reports yet</h3>
            <p className="mt-2 max-w-md text-sm text-[#6b6b6b]">
              Once citizens start reporting issues, this dashboard will show live
              statistics, emerging areas, category breakdowns, and recent activity.
            </p>
            <Link to="/report" className="btn-primary mt-6">
              Report the First Issue
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Category breakdown */}
            <div className="card p-6 lg:col-span-2">
              <h3 className="text-base font-semibold text-[#1e1e1e]">Issue Categories</h3>
              <p className="mt-1 text-sm text-[#6b6b6b]">Distribution of reports by type</p>
              <div className="mt-6 space-y-4">
                {categoryCounts.map((cat) => (
                  <div key={cat.category}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-[#1e1e1e]">{cat.category}</span>
                      <span className="text-[#6b6b6b]">{cat.count}</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f0f0f0]">
                      <div
                        className="h-full rounded-full bg-[#1e40af] transition-all duration-700"
                        style={{ width: `${(cat.count / maxCatCount) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Emerging areas — now using real cluster detection */}
            <div className="card p-6">
              <div className="flex items-center gap-2">
                <CircleDot className="h-5 w-5 text-[#1e40af]" />
                <h3 className="text-base font-semibold text-[#1e1e1e]">Emerging Areas</h3>
              </div>
              <p className="mt-1 text-sm text-[#6b6b6b]">
                Geographic hotspots (3+ nearby reports)
              </p>

              {clusters.length === 0 ? (
                <div className="mt-6 rounded-lg bg-[#faf9f7] px-4 py-6 text-center">
                  <MapPin className="mx-auto h-6 w-6 text-[#9b9b9b]" />
                  <p className="mt-3 text-sm text-[#6b6b6b]">
                    No emerging geographic patterns detected yet.
                  </p>
                  <p className="mt-1 text-xs text-[#9b9b9b]">
                    Clusters appear when 3+ reports are found near the same location.
                  </p>
                </div>
              ) : (
                <div className="mt-6 space-y-3">
                  {clusters.map((cluster, idx) => (
                    <div
                      key={cluster.id}
                      className="rounded-lg border border-[#e5e5e5] p-4"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-[#1e40af]/5 text-xs font-semibold text-[#1e40af]">
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-[#1e1e1e]">
                              {cluster.centerLocation}
                            </p>
                            <p className="mt-0.5 text-xs text-[#6b6b6b]">
                              <span className="font-semibold text-[#1e40af]">{cluster.reportCount}</span> reports · {cluster.dominantCategory}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-xs">
                        <span className="flex items-center gap-1 text-[#6b6b6b]">
                          <Zap className="h-3 w-3 text-[#1e40af]" />
                          Avg urgency: {cluster.averageUrgency}
                        </span>
                        <span className="flex items-center gap-1 text-[#6b6b6b]">
                          <TrendingUp className="h-3 w-3 text-[#1e40af]" />
                          {cluster.recentCount} recent
                        </span>
                        <span className="flex items-center gap-1 text-[#6b6b6b]">
                          <Calendar className="h-3 w-3 text-[#1e40af]" />
                          {cluster.dateRangeStart} — {cluster.dateRangeEnd}
                        </span>
                      </div>
                    </div>
                  ))}
                  <Link
                    to="/map"
                    className="block text-center text-sm font-medium text-[#1e40af] hover:underline"
                  >
                    View on Map
                  </Link>
                </div>
              )}
            </div>

            {/* Recent activity */}
            <div className="card p-6 lg:col-span-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-semibold text-[#1e1e1e]">Recent Activity</h3>
                  <p className="mt-1 text-sm text-[#6b6b6b]">Latest citizen reports</p>
                </div>
                <Link
                  to="/trends"
                  className="text-sm font-medium text-[#1e40af] hover:underline"
                >
                  View Trends
                </Link>
              </div>
              <div className="mt-6 divide-y divide-[#e5e5e5]">
                {recentReports.map((report) => (
                  <div key={report.id} className="flex items-start gap-4 py-4">
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e40af]/5">
                      <FileText className="h-4 w-4 text-[#1e40af]" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-[#1e40af]/5 px-2 py-0.5 text-xs font-medium text-[#1e40af]">
                          {report.category}
                        </span>
                        <span className="text-xs text-[#9b9b9b]">
                          {formatRelative(report.created_at)}
                        </span>
                      </div>
                      <p className="mt-1.5 text-sm text-[#1e1e1e] line-clamp-2">
                        {report.description}
                      </p>
                      <p className="mt-1 text-xs text-[#6b6b6b]">{report.location}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
