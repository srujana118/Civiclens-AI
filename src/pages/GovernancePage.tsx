import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Building2,
  CheckCircle2,
  FileText,
  MapPin,
  RefreshCw,
  Target,
  TrendingUp,
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

import {
  formatRelative,
} from '@/lib/utils';

/* ==================================================
   HELPERS
================================================== */

function getCategory(report: CivicReport): string {
  return (
    report.ai_category?.trim() ||
    report.category?.trim() ||
    'Other'
  );
}

function getAction(category: string): string {
  const value = category.toLowerCase();

  if (value === 'potholes') {
    return 'Road repair and pothole resurfacing';
  }

  if (value === 'street lighting') {
    return 'Street-light repair and coverage improvement';
  }

  if (value === 'water') {
    return 'Water and drainage infrastructure assessment';
  }

  if (value === 'sanitation') {
    return 'Sanitation and waste-management intervention';
  }

  if (value === 'traffic') {
    return 'Traffic and road-safety intervention';
  }

  if (value === 'public safety') {
    return 'Public-safety infrastructure assessment';
  }

  if (value === 'parks') {
    return 'Public-space maintenance and improvement';
  }

  if (value === 'graffiti') {
    return 'Public-space cleanup and maintenance';
  }

  if (value === 'noise') {
    return 'Noise-source assessment and mitigation';
  }

  return 'Local infrastructure assessment';
}

function priorityColor(
  priority: Cluster['priorityLevel'],
): string {
  if (priority === 'High') {
    return 'text-red-600';
  }

  if (priority === 'Medium') {
    return 'text-amber-600';
  }

  return 'text-green-600';
}

/* ==================================================
   PAGE
================================================== */

export default function Governance() {
  const [reports, setReports] = useState<CivicReport[]>([]);
  const [clusters, setClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);

  /* ==================================================
     DATA
  ================================================== */

  const loadData = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('civic_reports')
      .select('*')
      .order('created_at', {
        ascending: false,
      });

    if (error) {
      console.error(
        'Governance dashboard error:',
        error,
      );

      setReports([]);
      setClusters([]);
      setLoading(false);

      return;
    }

    const list = data ?? [];

    setReports(list);
    setClusters(detectHotspots(list));
    setUpdated(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();

    const interval = setInterval(
      loadData,
      15000,
    );

    return () => clearInterval(interval);
  }, [loadData]);

  /* ==================================================
     CATEGORY DISTRIBUTION
  ================================================== */

  const categoryData = useMemo(() => {
    const map = new Map<string, number>();

    reports.forEach((report) => {
      const category = getCategory(report);

      map.set(
        category,
        (map.get(category) ?? 0) + 1,
      );
    });

    return [...map.entries()]
      .sort((a, b) => b[1] - a[1]);
  }, [reports]);

  /* ==================================================
     PRIORITY SUMMARY
  ================================================== */

  const prioritySummary = useMemo(() => {
    return {
      high: clusters.filter(
        (cluster) =>
          cluster.priorityLevel === 'High',
      ).length,

      medium: clusters.filter(
        (cluster) =>
          cluster.priorityLevel === 'Medium',
      ).length,

      low: clusters.filter(
        (cluster) =>
          cluster.priorityLevel === 'Low',
      ).length,
    };
  }, [clusters]);

  /* ==================================================
     TOP NEED
  ================================================== */

  const topNeed = categoryData[0];

  /* ==================================================
     RECENT ACTIVITY
  ================================================== */

  const recentReports = useMemo(() => {
    const now = Date.now();

    return reports.filter((report) => {
      const created =
        new Date(
          report.created_at,
        ).getTime();

      return (
        now - created >= 0 &&
        now - created <=
          7 * 24 * 60 * 60 * 1000
      );
    }).length;
  }, [reports]);

  /* ==================================================
     RENDER
  ================================================== */

  return (
    <div>

      <PageHeader
        title="Governance Intelligence"
        subtitle="A policy-level view of citizen demand, infrastructure gaps and priority intervention areas."
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">

        {/* HEADER */}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

          <div>
            <p className="text-sm text-[#6b6b6b]">
              CivicLens AI governance layer
            </p>

            {updated && (
              <p className="mt-1 text-xs text-[#9b9b9b]">
                Last updated{' '}
                {formatRelative(
                  updated.toISOString(),
                )}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#d6d6d6] bg-white px-4 py-2 text-sm font-medium hover:border-[#1e40af] disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${
                loading
                  ? 'animate-spin'
                  : ''
              }`}
            />
            Refresh
          </button>

        </div>

        {/* ==================================================
            GOVERNANCE METRICS
        ================================================== */}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">

          <div className="card p-5">
            <FileText className="h-5 w-5 text-[#1e40af]" />

            <p className="mt-4 text-2xl font-bold">
              {reports.length}
            </p>

            <p className="mt-1 text-xs text-[#6b6b6b]">
              Citizen reports
            </p>
          </div>

          <div className="card p-5">
            <Target className="h-5 w-5 text-[#1e40af]" />

            <p className="mt-4 text-2xl font-bold">
              {clusters.length}
            </p>

            <p className="mt-1 text-xs text-[#6b6b6b]">
              Demand hotspots
            </p>
          </div>

          <div className="card p-5">
            <AlertTriangle className="h-5 w-5 text-red-600" />

            <p className="mt-4 text-2xl font-bold">
              {prioritySummary.high}
            </p>

            <p className="mt-1 text-xs text-[#6b6b6b]">
              High priority
            </p>
          </div>

          <div className="card p-5">
            <Activity className="h-5 w-5 text-[#1e40af]" />

            <p className="mt-4 text-2xl font-bold">
              {recentReports}
            </p>

            <p className="mt-1 text-xs text-[#6b6b6b]">
              Reports in 7 days
            </p>
          </div>

          <div className="card p-5">
            <Building2 className="h-5 w-5 text-[#1e40af]" />

            <p className="mt-4 truncate text-2xl font-bold">
              {topNeed?.[0] ?? '—'}
            </p>

            <p className="mt-1 text-xs text-[#6b6b6b]">
              Highest demand category
            </p>
          </div>

        </div>

        {/* ==================================================
            PRIORITY OVERVIEW
        ================================================== */}

        <section className="mt-8">

          <div className="card p-5">

            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-[#1e40af]" />

              <div>
                <h2 className="text-sm font-semibold">
                  Infrastructure Priority Overview
                </h2>

                <p className="mt-1 text-xs text-[#6b6b6b]">
                  Current citizen demand grouped into actionable governance signals.
                </p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">

              <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                <p className="text-xs text-red-700">
                  High Priority
                </p>

                <p className="mt-2 text-3xl font-bold text-red-700">
                  {prioritySummary.high}
                </p>

                <p className="mt-1 text-xs text-red-600">
                  Requires attention
                </p>
              </div>

              <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                <p className="text-xs text-amber-700">
                  Medium Priority
                </p>

                <p className="mt-2 text-3xl font-bold text-amber-700">
                  {prioritySummary.medium}
                </p>

                <p className="mt-1 text-xs text-amber-600">
                  Monitor and plan
                </p>
              </div>

              <div className="rounded-lg border border-green-100 bg-green-50 p-4">
                <p className="text-xs text-green-700">
                  Low Priority
                </p>

                <p className="mt-2 text-3xl font-bold text-green-700">
                  {prioritySummary.low}
                </p>

                <p className="mt-1 text-xs text-green-600">
                  Lower current demand
                </p>
              </div>

            </div>

          </div>

        </section>

        {/* ==================================================
            TOP INFRASTRUCTURE NEEDS
        ================================================== */}

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">

          <div className="card p-5">

            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-[#1e40af]" />

              <div>
                <h2 className="text-sm font-semibold">
                  Top Infrastructure Needs
                </h2>

                <p className="mt-1 text-xs text-[#6b6b6b]">
                  Based on citizen report volume.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">

              {categoryData.length === 0 ? (

                <p className="text-xs text-[#9b9b9b]">
                  No data available.
                </p>

              ) : (

                categoryData
                  .slice(0, 6)
                  .map(
                    (
                      [category, count],
                      index,
                    ) => (
                      <div
                        key={category}
                        className="flex items-center justify-between rounded-lg border border-[#e5e5e5] p-3"
                      >

                        <div className="flex items-center gap-3">

                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1e40af]/5 text-xs font-semibold text-[#1e40af]">
                            {index + 1}
                          </div>

                          <span className="text-sm font-medium">
                            {category}
                          </span>

                        </div>

                        <span className="text-xs text-[#6b6b6b]">
                          {count} reports
                        </span>

                      </div>
                    ),
                  )

              )}

            </div>

          </div>

          {/* ==================================================
              HOTSPOTS
          ================================================== */}

          <div className="card p-5">

            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-[#1e40af]" />

              <div>
                <h2 className="text-sm font-semibold">
                  Priority Demand Hotspots
                </h2>

                <p className="mt-1 text-xs text-[#6b6b6b]">
                  Areas where repeated citizen reports indicate a localised need.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">

              {clusters.length === 0 ? (

                <div className="rounded-lg border border-dashed border-[#d6d6d6] p-5 text-center">
                  <Target className="mx-auto h-6 w-6 text-[#9b9b9b]" />

                  <p className="mt-2 text-xs text-[#6b6b6b]">
                    No qualifying hotspots yet.
                  </p>
                </div>

              ) : (

                clusters
                  .slice(0, 5)
                  .map((cluster) => (
                    <div
                      key={cluster.id}
                      className="rounded-lg border border-[#e5e5e5] p-4"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div>

                          <p className="text-sm font-semibold">
                            {cluster.centerLocation}
                          </p>

                          <p className="mt-1 text-xs text-[#6b6b6b]">
                            {cluster.dominantCategory}
                            {' · '}
                            {cluster.reportCount}
                            {' reports'}
                          </p>

                        </div>

                        <span
                          className={`text-xs font-semibold ${priorityColor(
                            cluster.priorityLevel,
                          )}`}
                        >
                          {cluster.priorityLevel}
                        </span>

                      </div>

                      <div className="mt-3 flex items-center justify-between">

                        <span className="text-xs text-[#6b6b6b]">
                          Priority score
                        </span>

                        <span className="text-sm font-bold">
                          {cluster.priorityScore}
                          /100
                        </span>

                      </div>

                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#eeeeee]">

                        <div
                          className="h-full rounded-full bg-[#1e40af]"
                          style={{
                            width: `${cluster.priorityScore}%`,
                          }}
                        />

                      </div>

                    </div>
                  ))

              )}

            </div>

          </div>

        </section>

        {/* ==================================================
            RECOMMENDED ACTIONS
        ================================================== */}

        <section className="mt-8">

          <div className="mb-4">
            <h2 className="text-lg font-semibold">
              Recommended Development Priorities
            </h2>

            <p className="mt-1 text-sm text-[#6b6b6b]">
              CivicLens converts repeated citizen demand into suggested administrative action.
            </p>
          </div>

          <div className="space-y-4">

            {clusters.length === 0 ? (

              <div className="card p-8 text-center">
                <CheckCircle2 className="mx-auto h-8 w-8 text-[#9b9b9b]" />

                <p className="mt-3 text-sm">
                  No development priorities detected yet.
                </p>
              </div>

            ) : (

              clusters
                .slice(0, 6)
                .map((cluster) => (
                  <div
                    key={cluster.id}
                    className="card p-5"
                  >

                    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_1.2fr_1fr]">

                      {/* LOCATION */}

                      <div>

                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9b9b]">
                          Demand hotspot
                        </p>

                        <h3 className="mt-2 text-sm font-semibold">
                          {cluster.centerLocation}
                        </h3>

                        <p className="mt-1 flex items-center gap-1 text-xs text-[#6b6b6b]">
                          <MapPin className="h-3 w-3" />
                          {cluster.dominantCategory}
                        </p>

                      </div>

                      {/* ACTION */}

                      <div className="rounded-lg bg-[#f8fafc] p-4">

                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#6b6b6b]">
                          Recommended development action
                        </p>

                        <p className="mt-2 text-sm font-semibold text-[#1e1e1e]">
                          {getAction(
                            cluster.dominantCategory,
                          )}
                        </p>

                        <p className="mt-2 text-xs leading-5 text-[#6b6b6b]">
                          Repeated citizen reports indicate a recurring local infrastructure need in this area.
                        </p>

                      </div>

                      {/* EVIDENCE */}

                      <div>

                        <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9b9b9b]">
                          Evidence
                        </p>

                        <div className="mt-2 space-y-2">

                          <div className="flex justify-between text-xs">
                            <span className="text-[#6b6b6b]">
                              Reports
                            </span>

                            <strong>
                              {cluster.reportCount}
                            </strong>
                          </div>

                          <div className="flex justify-between text-xs">
                            <span className="text-[#6b6b6b]">
                              Urgency
                            </span>

                            <strong>
                              {cluster.averageUrgency}
                            </strong>
                          </div>

                          <div className="flex justify-between text-xs">
                            <span className="text-[#6b6b6b]">
                              Recent
                            </span>

                            <strong>
                              {cluster.recentCount}
                            </strong>
                          </div>

                          <div className="flex justify-between text-xs">
                            <span className="text-[#6b6b6b]">
                              Priority
                            </span>

                            <strong>
                              {cluster.priorityScore}/100
                            </strong>
                          </div>

                        </div>

                      </div>

                    </div>

                  </div>
                ))

            )}

          </div>

        </section>

        {/* ==================================================
            DATA INTEGRATION LAYER
        ================================================== */}

        <section className="mt-8">

          <div className="card p-5">

            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-[#1e40af]" />

              <div>
                <h2 className="text-sm font-semibold">
                  Digital Public Infrastructure Context
                </h2>

                <p className="mt-1 text-xs text-[#6b6b6b]">
                  CivicLens is designed to combine citizen demand with wider governance datasets.
                </p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">

              <div className="rounded-lg border border-[#e5e5e5] p-4">
                <p className="text-xs font-semibold">
                  Citizen Feedback
                </p>

                <p className="mt-2 text-xs leading-5 text-[#6b6b6b]">
                  Current reports provide local demand, issue categories, locations and urgency signals.
                </p>

                <span className="mt-3 inline-flex rounded-full bg-green-50 px-2 py-1 text-[10px] font-medium text-green-700">
                  Connected
                </span>
              </div>

              <div className="rounded-lg border border-[#e5e5e5] p-4">
                <p className="text-xs font-semibold">
                  Demographic Data
                </p>

                <p className="mt-2 text-xs leading-5 text-[#6b6b6b]">
                  Population and demographic datasets can be joined by district or administrative area.
                </p>

                <span className="mt-3 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
                  Integration layer
                </span>
              </div>

              <div className="rounded-lg border border-[#e5e5e5] p-4">
                <p className="text-xs font-semibold">
                  Public Investment Plans
                </p>

                <p className="mt-2 text-xs leading-5 text-[#6b6b6b]">
                  Government investment and infrastructure-plan datasets can be compared with detected citizen demand.
                </p>

                <span className="mt-3 inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-medium text-amber-700">
                  Integration layer
                </span>
              </div>

            </div>

          </div>

        </section>

      </div>
    </div>
  );
}