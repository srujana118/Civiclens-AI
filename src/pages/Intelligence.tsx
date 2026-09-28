import { useCallback, useEffect, useState } from 'react';
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
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';

import {
  supabase,
  type CivicReport,
} from '@/lib/supabase';

import {
  detectHotspots,
  type Cluster,
} from '@/lib/clustering';

import PageHeader from '@/components/PageHeader';
import StatCard from '@/components/StatCard';
import { formatRelative } from '@/lib/utils';

type CategoryCount = {
  category: string;
  count: number;
};

type AreaCount = {
  location: string;
  count: number;
};

type PriorityReport = CivicReport & {
  priorityScore: number;
  priorityReason: string;
};

export default function Intelligence() {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [totalReports, setTotalReports] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<CategoryCount[]>([]);
  const [areaCounts, setAreaCounts] = useState<AreaCount[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('civic_reports')
        .select('*')
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error('Intelligence dashboard error:', error);
        return;
      }

      const reportList = data ?? [];

      setReports(reportList);
      setTotalReports(reportList.length);

      /* CATEGORY BREAKDOWN */
      const catMap = new Map<string, number>();

      reportList.forEach((report) => {
        const category =
          report.ai_category?.trim() ||
          report.category?.trim() ||
          'Other';

        catMap.set(
          category,
          (catMap.get(category) ?? 0) + 1,
        );
      });

      setCategoryCounts(
        [...catMap.entries()]
          .map(([category, count]) => ({
            category,
            count,
          }))
          .sort((a, b) => b.count - a.count),
      );

      /* AREA BREAKDOWN */
      const areaMap = new Map<string, number>();

      reportList.forEach((report) => {
        const area =
          report.location?.split(',')[0]?.trim() ||
          'Unknown area';

        areaMap.set(
          area,
          (areaMap.get(area) ?? 0) + 1,
        );
      });

      setAreaCounts(
        [...areaMap.entries()]
          .map(([location, count]) => ({
            location,
            count,
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
      );

      /* HOTSPOTS */
      setClusters(detectHotspots(reportList));

      setLastUpdated(new Date());
    } catch (error) {
      console.error('Intelligence fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /*
   * Initial load + automatic refresh.
   * This keeps Intelligence synchronized with new citizen reports.
   */
  useEffect(() => {
    fetchData();

    const interval = window.setInterval(() => {
      fetchData();
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [fetchData]);

  const maxCatCount = Math.max(
    ...categoryCounts.map((c) => c.count),
    1,
  );

  const recentReports = reports.slice(0, 8);

  /*
   * PRIORITY CALCULATION
   *
   * 50% = urgency
   * 30% = recency
   * 20% = repeated reports
   */

  const urgencyValues: Record<string, number> = {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 4,
  };

  const calculatePriorityReports = (): PriorityReport[] => {
    const now = Date.now();

    /* Count repeated issues */
    const issueGroupCounts = new Map<string, number>();

    reports.forEach((report) => {
      const category =
        report.ai_category?.trim() ||
        report.category?.trim() ||
        'Other';

      const location =
        report.location
          ?.split(',')[0]
          ?.trim()
          .toLowerCase() ||
        'unknown';

      const key = `${location}|${category.toLowerCase()}`;

      issueGroupCounts.set(
        key,
        (issueGroupCounts.get(key) ?? 0) + 1,
      );
    });

    return reports
      .filter((report) => report.ai_urgency)
      .map((report) => {
        const urgency = report.ai_urgency ?? 'Low';

        /* URGENCY SCORE - MAX 50 */
        const urgencyScore =
          ((urgencyValues[urgency] ?? 1) / 4) * 50;

        /* RECENCY SCORE - MAX 30 */
        const createdTime =
          new Date(report.created_at).getTime();

        const ageInDays =
          (now - createdTime) /
          (1000 * 60 * 60 * 24);

        let recencyScore = 0;

        if (ageInDays <= 1) {
          recencyScore = 30;
        } else if (ageInDays <= 3) {
          recencyScore = 25;
        } else if (ageInDays <= 7) {
          recencyScore = 18;
        } else if (ageInDays <= 14) {
          recencyScore = 10;
        } else {
          recencyScore = 5;
        }

        /* REPETITION SCORE - MAX 20 */
        const category =
          report.ai_category?.trim() ||
          report.category?.trim() ||
          'Other';

        const location =
          report.location
            ?.split(',')[0]
            ?.trim()
            .toLowerCase() ||
          'unknown';

        const key =
          `${location}|${category.toLowerCase()}`;

        const repeatedCount =
          issueGroupCounts.get(key) ?? 1;

        const repetitionScore =
          Math.min(repeatedCount / 5, 1) * 20;

        /* FINAL SCORE */
        const priorityScore = Math.round(
          urgencyScore +
            recencyScore +
            repetitionScore,
        );

        const reasons: string[] = [];

        if (
          urgency === 'Critical' ||
          urgency === 'High'
        ) {
          reasons.push(
            `${urgency.toLowerCase()} urgency`,
          );
        }

        if (repeatedCount >= 2) {
          reasons.push(
            `${repeatedCount} reports for this issue in the area`,
          );
        }

        if (ageInDays <= 3) {
          reasons.push(
            'recent citizen report',
          );
        }

        if (reasons.length === 0) {
          reasons.push(
            'current citizen report',
          );
        }

        return {
          ...report,
          priorityScore,
          priorityReason:
            reasons.join(' · '),
        };
      })
      .sort((a, b) => {
        if (
          b.priorityScore !==
          a.priorityScore
        ) {
          return (
            b.priorityScore -
            a.priorityScore
          );
        }

        return (
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime()
        );
      })
      .slice(0, 5);
  };

  const priorityReports =
    calculatePriorityReports();

  const getPriorityStyle = (
    score: number,
  ) => {
    if (score >= 75) {
      return {
        label: 'High Priority',
        classes:
          'bg-red-50 text-red-700 border-red-200',
      };
    }

    if (score >= 50) {
      return {
        label: 'Medium Priority',
        classes:
          'bg-yellow-50 text-yellow-700 border-yellow-200',
      };
    }

    return {
      label: 'Low Priority',
      classes:
        'bg-green-50 text-green-700 border-green-200',
    };
  };

  const getUrgencyStyle = (
    urgency: string | null,
  ) => {
    switch (urgency) {
      case 'Critical':
        return 'bg-red-50 text-red-700';

      case 'High':
        return 'bg-orange-50 text-orange-700';

      case 'Medium':
        return 'bg-yellow-50 text-yellow-700';

      default:
        return 'bg-green-50 text-green-700';
    }
  };

  if (loading) {
    return (
      <div>
        <PageHeader
          title="Intelligence"
          subtitle="A real-time view of community-reported civic issues."
        />

        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Intelligence"
        subtitle="A real-time view of community-reported civic issues."
      />

      <div className="mx-auto max-w-7xl space-y-8 px-4 py-10 sm:px-6 lg:px-8">

        {/* TOP BAR */}
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">

          <div>
            <p className="text-sm text-[#6b6b6b]">
              Live civic intelligence
            </p>

            {lastUpdated && (
              <p className="mt-1 text-xs text-[#9b9b9b]">
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={fetchData}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d6d3d1] bg-white px-4 py-2 text-sm font-medium text-[#1e1e1e] hover:bg-[#f5f5f4]"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>

        </div>

        {/* STAT CARDS */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          <StatCard
            label="Total Reports"
            value={totalReports}
            icon={<FileText className="h-5 w-5" />}
            trend={
              totalReports === 0
                ? 'No reports yet'
                : 'All citizen reports'
            }
          />

          <StatCard
            label="Emerging Areas"
            value={clusters.length}
            icon={<TrendingUp className="h-5 w-5" />}
            trend={
              clusters.length === 0
                ? 'No hotspots detected'
                : `${clusters.length} active hotspot${
                    clusters.length !== 1
                      ? 's'
                      : ''
                  }`
            }
          />

          <StatCard
            label="Issue Categories"
            value={categoryCounts.length}
            icon={<Tags className="h-5 w-5" />}
            trend={
              categoryCounts.length === 0
                ? 'No categories'
                : 'AI-classified issue types'
            }
          />

          <StatCard
            label="Recent Activity"
            value={recentReports.length}
            icon={<Activity className="h-5 w-5" />}
            trend="Latest reports"
          />

        </div>

        {/* NO REPORTS */}
        {totalReports === 0 ? (
          <div className="card flex flex-col items-center p-12 text-center">

            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af]/5">
              <FileText className="h-7 w-7 text-[#1e40af]" />
            </div>

            <h3 className="mt-5 text-lg font-semibold text-[#1e1e1e]">
              No reports yet
            </h3>

            <p className="mt-2 max-w-md text-sm text-[#6b6b6b]">
              Once citizens start reporting issues, this dashboard will show live statistics, emerging areas, category breakdowns, and recent activity.
            </p>

            <Link
              to="/report"
              className="btn-primary mt-6"
            >
              Report the First Issue
              <ArrowRight className="h-4 w-4" />
            </Link>

          </div>
        ) : (
          <div className="space-y-6">

            {/* PRIORITY ISSUES */}
            <div className="card p-6">

              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-[#1e40af]" />

                <div>
                  <h3 className="text-base font-semibold text-[#1e1e1e]">
                    Priority Issues
                  </h3>

                  <p className="mt-1 text-sm text-[#6b6b6b]">
                    Issues prioritized using urgency, recency, and repeated reports
                  </p>
                </div>
              </div>

              {priorityReports.length === 0 ? (
                <div className="mt-6 rounded-lg bg-[#faf9f7] px-4 py-6 text-center">

                  <FileText className="mx-auto h-6 w-6 text-[#9b9b9b]" />

                  <p className="mt-3 text-sm text-[#6b6b6b]">
                    AI priority information is not available yet.
                  </p>

                  <p className="mt-1 text-xs text-[#9b9b9b]">
                    New reports will appear here after AI analysis.
                  </p>

                </div>
              ) : (
                <div className="mt-6 space-y-4">

                  {priorityReports.map((report) => {
                    const priority =
                      getPriorityStyle(
                        report.priorityScore,
                      );

                    return (
                      <div
                        key={report.id}
                        className="rounded-lg border border-[#e5e5e5] p-5"
                      >

                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">

                          <div className="min-w-0">

                            <div className="flex flex-wrap items-center gap-2">

                              <span className="rounded-md bg-[#1e40af]/5 px-2.5 py-1 text-xs font-semibold text-[#1e40af]">
                                {report.ai_category ??
                                  report.category ??
                                  'Other'}
                              </span>

                              {report.ai_issue_type && (
                                <span className="text-xs text-[#6b6b6b]">
                                  {report.ai_issue_type}
                                </span>
                              )}

                              {report.ai_urgency && (
                                <span
                                  className={`rounded-md px-2.5 py-1 text-xs font-medium ${getUrgencyStyle(
                                    report.ai_urgency,
                                  )}`}
                                >
                                  {report.ai_urgency} urgency
                                </span>
                              )}

                            </div>

                            <p className="mt-3 text-sm font-medium text-[#1e1e1e]">
                              {report.ai_summary ??
                                report.description}
                            </p>

                            <div className="mt-2 flex items-center gap-1.5 text-xs text-[#6b6b6b]">
                              <MapPin className="h-3.5 w-3.5 text-[#1e40af]" />
                              {report.location}
                            </div>

                          </div>

                          <span className="flex-shrink-0 text-xs text-[#9b9b9b]">
                            {formatRelative(
                              report.created_at,
                            )}
                          </span>

                        </div>

                        {/* PRIORITY SCORE */}
                        <div className="mt-5">

                          <div className="flex items-center justify-between">

                            <div className="flex items-center gap-2">

                              <span className="text-xs font-semibold text-[#6b6b6b]">
                                Priority Score
                              </span>

                              <span
                                className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${priority.classes}`}
                              >
                                {priority.label}
                              </span>

                            </div>

                            <span className="text-sm font-semibold text-[#1e1e1e]">
                              {report.priorityScore}/100
                            </span>

                          </div>

                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#f0f0f0]">

                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                report.priorityScore >= 75
                                  ? 'bg-red-500'
                                  : report.priorityScore >= 50
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                              }`}
                              style={{
                                width: `${report.priorityScore}%`,
                              }}
                            />

                          </div>

                        </div>

                        {/* REASON */}
                        <div className="mt-3 flex items-start gap-2 rounded-md bg-[#faf9f7] px-3 py-2.5">

                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#1e40af]" />

                          <p className="text-xs text-[#6b6b6b]">
                            {report.priorityReason}
                          </p>

                        </div>

                        {/* COMMUNITY IMPACT */}
                        {report.ai_impact && (
                          <div className="mt-3 rounded-md border border-[#e5e5e5] px-4 py-3">

                            <p className="text-xs font-semibold text-[#6b6b6b]">
                              Community Impact
                            </p>

                            <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
                              {report.ai_impact}
                            </p>

                          </div>
                        )}

                      </div>
                    );
                  })}

                </div>
              )}
            </div>

            {/* MAIN DASHBOARD GRID */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

              {/* CATEGORY BREAKDOWN */}
              <div className="card p-6 lg:col-span-2">

                <h3 className="text-base font-semibold text-[#1e1e1e]">
                  Issue Categories
                </h3>

                <p className="mt-1 text-sm text-[#6b6b6b]">
                  AI-classified distribution of citizen reports
                </p>

                <div className="mt-6 space-y-4">

                  {categoryCounts.map((cat) => (
                    <div key={cat.category}>

                      <div className="flex items-center justify-between text-sm">

                        <span className="font-medium text-[#1e1e1e]">
                          {cat.category}
                        </span>

                        <span className="text-[#6b6b6b]">
                          {cat.count}
                        </span>

                      </div>

                      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f0f0f0]">

                        <div
                          className="h-full rounded-full bg-[#1e40af] transition-all duration-700"
                          style={{
                            width: `${(cat.count / maxCatCount) * 100}%`,
                          }}
                        />

                      </div>

                    </div>
                  ))}

                </div>
              </div>

              {/* HOTSPOTS */}
              <div className="card p-6">

                <div className="flex items-center gap-2">

                  <CircleDot className="h-5 w-5 text-[#1e40af]" />

                  <h3 className="text-base font-semibold text-[#1e1e1e]">
                    Emerging Areas
                  </h3>

                </div>

                <p className="mt-1 text-sm text-[#6b6b6b]">
                  Locations with concentrated citizen reports
                </p>

                {clusters.length === 0 ? (
                  <div className="mt-6 rounded-lg bg-[#faf9f7] px-4 py-6 text-center">

                    <MapPin className="mx-auto h-6 w-6 text-[#9b9b9b]" />

                    <p className="mt-3 text-sm text-[#6b6b6b]">
                      No emerging geographic patterns detected yet.
                    </p>

                    <p className="mt-1 text-xs text-[#9b9b9b]">
                      Hotspots appear when 3 or more reports are grouped around the same area.
                    </p>

                  </div>
                ) : (
                  <div className="mt-6 space-y-4">

                    {clusters.map((cluster) => (
                      <div
                        key={cluster.id}
                        className="rounded-lg border border-[#e5e5e5] p-4"
                      >

                        <div className="flex items-start justify-between gap-3">

                          <div className="flex items-center gap-2.5">

                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-[#1e40af]/5">
                              <MapPin className="h-4 w-4 text-[#1e40af]" />
                            </div>

                            <div>

                              <p className="text-sm font-medium text-[#1e1e1e]">
                                {cluster.centerLocation}
                              </p>

                              <p className="mt-0.5 text-xs text-[#6b6b6b]">
                                {cluster.reportCount} reports ·{' '}
                                {cluster.dominantCategory}
                              </p>

                            </div>

                          </div>

                          <span
                            className={`flex-shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold ${
                              cluster.priorityLevel === 'High'
                                ? 'bg-red-50 text-red-700'
                                : cluster.priorityLevel === 'Medium'
                                  ? 'bg-yellow-50 text-yellow-700'
                                  : 'bg-green-50 text-green-700'
                            }`}
                          >
                            {cluster.priorityLevel} Priority
                          </span>

                        </div>

                        <div className="mt-4">

                          <div className="flex items-center justify-between text-xs">

                            <span className="font-medium text-[#6b6b6b]">
                              Priority Score
                            </span>

                            <span className="font-semibold text-[#1e1e1e]">
                              {cluster.priorityScore}/100
                            </span>

                          </div>

                          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[#f0f0f0]">

                            <div
                              className={`h-full rounded-full ${
                                cluster.priorityLevel === 'High'
                                  ? 'bg-red-500'
                                  : cluster.priorityLevel === 'Medium'
                                    ? 'bg-yellow-500'
                                    : 'bg-green-500'
                              }`}
                              style={{
                                width: `${cluster.priorityScore}%`,
                              }}
                            />

                          </div>

                        </div>

                        <div className="mt-3 flex items-start gap-2 rounded-md bg-[#faf9f7] px-3 py-2.5">

                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#1e40af]" />

                          <p className="text-xs text-[#6b6b6b]">
                            {cluster.priorityReason}
                          </p>

                        </div>

                        <div className="mt-3 flex flex-wrap gap-3 text-xs">

                          <span className="flex items-center gap-1 text-[#6b6b6b]">
                            <Zap className="h-3 w-3 text-[#1e40af]" />
                            Urgency: {cluster.averageUrgency}
                          </span>

                          <span className="flex items-center gap-1 text-[#6b6b6b]">
                            <TrendingUp className="h-3 w-3 text-[#1e40af]" />
                            {cluster.recentCount} recent
                          </span>

                          <span className="flex items-center gap-1 text-[#6b6b6b]">
                            <Calendar className="h-3 w-3 text-[#1e40af]" />
                            {cluster.dateRangeStart} —{' '}
                            {cluster.dateRangeEnd}
                          </span>

                        </div>

                      </div>
                    ))}

                    <Link
                      to="/map"
                      className="block text-center text-sm font-medium text-[#1e40af] hover:underline"
                    >
                      View Hotspots on Map
                    </Link>

                  </div>
                )}
              </div>

              {/* RECENT ACTIVITY */}
              <div className="card p-6 lg:col-span-3">

                <div className="flex items-center justify-between">

                  <div>

                    <h3 className="text-base font-semibold text-[#1e1e1e]">
                      Recent Activity
                    </h3>

                    <p className="mt-1 text-sm text-[#6b6b6b]">
                      Latest citizen reports
                    </p>

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
                    <div
                      key={report.id}
                      className="flex items-start gap-4 py-4"
                    >

                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#1e40af]/5">
                        <FileText className="h-4 w-4 text-[#1e40af]" />
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-wrap items-center gap-2">

                          <span className="inline-flex items-center rounded-md bg-[#1e40af]/5 px-2 py-0.5 text-xs font-medium text-[#1e40af]">
                            {report.ai_category ??
                              report.category ??
                              'Other'}
                          </span>

                          {report.ai_urgency && (
                            <span
                              className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                                report.ai_urgency === 'Critical'
                                  ? 'bg-red-50 text-red-700'
                                  : report.ai_urgency === 'High'
                                    ? 'bg-orange-50 text-orange-700'
                                    : report.ai_urgency === 'Medium'
                                      ? 'bg-yellow-50 text-yellow-700'
                                      : 'bg-green-50 text-green-700'
                              }`}
                            >
                              {report.ai_urgency}
                            </span>
                          )}

                          <span className="text-xs text-[#9b9b9b]">
                            {formatRelative(
                              report.created_at,
                            )}
                          </span>

                        </div>

                        <p className="mt-1.5 line-clamp-2 text-sm text-[#1e1e1e]">
                          {report.ai_summary ??
                            report.description}
                        </p>

                        <p className="mt-1 text-xs text-[#6b6b6b]">
                          {report.location}
                        </p>

                      </div>

                    </div>
                  ))}

                </div>
              </div>

            </div>
          </div>
        )}
      </div>
    </div>
  );
}