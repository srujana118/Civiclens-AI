import {
  useEffect,
  useState,
  useCallback,
} from 'react';

import { Link } from 'react-router-dom';

import {
  MapPin,
  Loader2,
  FileText,
  ArrowRight,
  Layers,
  CircleDot,
  X,
  Calendar,
  Zap,
  Tag,
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

/* --------------------------------------------------
   CATEGORY COLORS
-------------------------------------------------- */

const categoryColors: Record<
  string,
  string
> = {
  Potholes: '#b45309',
  'Street Lighting': '#ca8a04',
  Sanitation: '#16a34a',
  Graffiti: '#9333ea',
  Noise: '#db2777',
  'Public Safety': '#dc2626',
  Water: '#0891b2',
  Parks: '#15803d',
  Traffic: '#2563eb',
  Other: '#6b6b6b',
};

/* --------------------------------------------------
   SELECTED ITEM
-------------------------------------------------- */

type SelectedItem =
  | {
      type: 'report';
      data: CivicReport;
    }
  | {
      type: 'cluster';
      data: Cluster;
    }
  | null;

/* --------------------------------------------------
   HELPERS
-------------------------------------------------- */

function getReportCategory(
  report: CivicReport,
): string {
  return (
    report.ai_category?.trim() ||
    report.category?.trim() ||
    'Other'
  );
}

function getCategoryColor(
  category: string,
): string {
  return (
    categoryColors[category] ??
    '#1e40af'
  );
}

/* --------------------------------------------------
   PAGE
-------------------------------------------------- */

export default function MapPage() {
  const [reports, setReports] =
    useState<CivicReport[]>([]);

  const [clusters, setClusters] =
    useState<Cluster[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [selected, setSelected] =
    useState<SelectedItem>(null);

  /* ------------------------------------------------
     FETCH REPORTS
  ------------------------------------------------ */

  const fetchReports =
    useCallback(async () => {
      const { data, error } =
        await supabase
          .from('civic_reports')
          .select('*')
          .order('created_at', {
            ascending: false,
          });

      if (error) {
        console.error(
          'Failed to load reports:',
          error,
        );

        setReports([]);
        setClusters([]);
        setLoading(false);

        return;
      }

      const reportList =
        data ?? [];

      setReports(reportList);

      setClusters(
        detectHotspots(
          reportList,
        ),
      );

      setLoading(false);
    }, []);

  /* ------------------------------------------------
     INITIAL LOAD + REFRESH
  ------------------------------------------------ */

  useEffect(() => {
    fetchReports();

    const interval =
      setInterval(
        fetchReports,
        15000,
      );

    return () =>
      clearInterval(interval);
  }, [fetchReports]);

  /* ------------------------------------------------
     MAP DATA
  ------------------------------------------------ */

  const geoReports =
    reports.filter(
      (report) =>
        report.latitude != null &&
        report.longitude != null,
    );

  const textReports =
    reports.filter(
      (report) =>
        report.latitude == null ||
        report.longitude == null,
    );

  /* ------------------------------------------------
     LAT/LNG → MAP POSITION
  ------------------------------------------------ */

  const latLngToXY = (
    lat: number,
    lng: number,
  ) => {
    if (
      geoReports.length === 0
    ) {
      return {
        x: 50,
        y: 50,
      };
    }

    const lats =
      geoReports.map(
        (report) =>
          Number(report.latitude),
      );

    const lngs =
      geoReports.map(
        (report) =>
          Number(report.longitude),
      );

    const minLat =
      Math.min(...lats);

    const maxLat =
      Math.max(...lats);

    const minLng =
      Math.min(...lngs);

    const maxLng =
      Math.max(...lngs);

    const latRange =
      maxLat - minLat || 1;

    const lngRange =
      maxLng - minLng || 1;

    const x =
      ((lng - minLng) /
        lngRange) *
        70 +
      15;

    const y =
      85 -
      ((lat - minLat) /
        latRange) *
        70;

    return {
      x: Math.max(
        5,
        Math.min(95, x),
      ),
      y: Math.max(
        5,
        Math.min(95, y),
      ),
    };
  };

  /* ------------------------------------------------
     CLUSTERS
  ------------------------------------------------ */

  const geoClusters =
    clusters.filter(
      (cluster) =>
        cluster.centerLatitude !=
          null &&
        cluster.centerLongitude !=
          null,
    );

  const textClusters =
    clusters.filter(
      (cluster) =>
        cluster.centerLatitude ==
          null ||
        cluster.centerLongitude ==
          null,
    );

  /* ------------------------------------------------
     CLUSTER SIZE
  ------------------------------------------------ */

  const clusterSize = (
    count: number,
  ) => {
    if (count >= 10) return 56;
    if (count >= 7) return 48;
    if (count >= 5) return 42;

    return 36;
  };

  /* ------------------------------------------------
     REPORTS INSIDE HOTSPOTS
  ------------------------------------------------ */

  const hotspotReportIds =
    new Set<string>(
      clusters.flatMap(
        (cluster) =>
          cluster.reportIds,
      ),
    );

  /* ------------------------------------------------
     RENDER
  ------------------------------------------------ */

  return (
    <div>
      <PageHeader
        title="Map"
        subtitle="Citizen reports and automatically discovered geographic hotspots."
      />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* ========================================
              MAP
          ======================================== */}

          <div className="lg:col-span-2">

            <div className="mb-3 flex items-center gap-4 text-sm">

              <span className="flex items-center gap-1.5 font-medium text-[#1e1e1e]">
                <CircleDot className="h-4 w-4 text-[#1e40af]" />

                {clusters.length}

                {' '}

                hotspot
                {clusters.length !== 1
                  ? 's'
                  : ''}
              </span>

              <span className="flex items-center gap-1.5 text-[#6b6b6b]">
                <Layers className="h-4 w-4" />

                {reports.length}

                {' '}

                report
                {reports.length !== 1
                  ? 's'
                  : ''}
              </span>

              {reports.length > 0 && (
                <span className="text-xs text-[#9b9b9b]">
                  Click a marker to inspect the issue
                </span>
              )}

            </div>

            <div className="card relative flex h-[500px] items-center justify-center overflow-hidden lg:h-[600px]">

              {loading ? (

                <Loader2 className="h-8 w-8 animate-spin text-[#1e40af]" />

              ) : reports.length === 0 ? (

                <div className="flex flex-col items-center text-center">

                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#1e40af]/5">
                    <MapPin className="h-7 w-7 text-[#1e40af]" />
                  </div>

                  <h3 className="mt-5 text-lg font-semibold text-[#1e1e1e]">
                    No reports to display
                  </h3>

                  <p className="mt-2 max-w-sm text-sm text-[#6b6b6b]">
                    As citizens submit reports with location data, they will appear here.
                  </p>

                  <Link
                    to="/report"
                    className="btn-primary mt-6"
                  >
                    Report an Issue
                    <ArrowRight className="h-4 w-4" />
                  </Link>

                </div>

              ) : (

                <div className="absolute inset-0 bg-[#f5f5f4]">

                  {/* MAP GRID */}

                  <div
                    className="absolute inset-0 opacity-40"
                    style={{
                      backgroundImage: `
                        linear-gradient(to right, #e0ddd8 1px, transparent 1px),
                        linear-gradient(to bottom, #e0ddd8 1px, transparent 1px)
                      `,
                      backgroundSize:
                        '40px 40px',
                    }}
                  />

                  {/* ==================================
                      GEO HOTSPOT ZONES
                  ================================== */}

                  {geoClusters.map(
                    (cluster) => {
                      const {
                        x,
                        y,
                      } =
                        latLngToXY(
                          Number(
                            cluster.centerLatitude,
                          ),
                          Number(
                            cluster.centerLongitude,
                          ),
                        );

                      const size =
                        clusterSize(
                          cluster.reportCount,
                        );

                      const color =
                        getCategoryColor(
                          cluster.dominantCategory,
                        );

                      return (
                        <div
                          key={`zone-${cluster.id}`}
                          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                          }}
                        >
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15"
                            style={{
                              width:
                                size * 2.5,
                              height:
                                size * 2.5,
                              backgroundColor:
                                color,
                            }}
                          />
                        </div>
                      );
                    },
                  )}

                  {/* ==================================
                      TEXT HOTSPOT ZONES
                  ================================== */}

                  {textClusters.map(
                    (
                      cluster,
                      index,
                    ) => {
                      const col =
                        index % 3;

                      const row =
                        Math.floor(
                          index / 3,
                        );

                      const x =
                        20 +
                        col * 30;

                      const y =
                        20 +
                        row * 25;

                      const size =
                        clusterSize(
                          cluster.reportCount,
                        );

                      const color =
                        getCategoryColor(
                          cluster.dominantCategory,
                        );

                      return (
                        <div
                          key={`text-zone-${cluster.id}`}
                          className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                          }}
                        >
                          <div
                            className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full opacity-15"
                            style={{
                              width:
                                size * 2.5,
                              height:
                                size * 2.5,
                              backgroundColor:
                                color,
                            }}
                          />
                        </div>
                      );
                    },
                  )}

                  {/* ==================================
                      GEO HOTSPOT MARKERS
                  ================================== */}

                  {geoClusters.map(
                    (cluster) => {
                      const {
                        x,
                        y,
                      } =
                        latLngToXY(
                          Number(
                            cluster.centerLatitude,
                          ),
                          Number(
                            cluster.centerLongitude,
                          ),
                        );

                      const size =
                        clusterSize(
                          cluster.reportCount,
                        );

                      const color =
                        getCategoryColor(
                          cluster.dominantCategory,
                        );

                      return (
                        <button
                          key={`marker-${cluster.id}`}
                          type="button"
                          onClick={() =>
                            setSelected({
                              type: 'cluster',
                              data: cluster,
                            })
                          }
                          title={`${cluster.reportCount} ${cluster.dominantCategory} reports`}
                          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                          }}
                        >
                          <div
                            className="flex items-center justify-center rounded-full border-2 border-white font-semibold text-white shadow-lg"
                            style={{
                              width: size,
                              height: size,
                              backgroundColor:
                                color,
                              fontSize:
                                size >= 48
                                  ? '16px'
                                  : '14px',
                            }}
                          >
                            {
                              cluster.reportCount
                            }
                          </div>
                        </button>
                      );
                    },
                  )}

                  {/* ==================================
                      TEXT HOTSPOT MARKERS
                  ================================== */}

                  {textClusters.map(
                    (
                      cluster,
                      index,
                    ) => {
                      const col =
                        index % 3;

                      const row =
                        Math.floor(
                          index / 3,
                        );

                      const x =
                        20 +
                        col * 30;

                      const y =
                        20 +
                        row * 25;

                      const size =
                        clusterSize(
                          cluster.reportCount,
                        );

                      const color =
                        getCategoryColor(
                          cluster.dominantCategory,
                        );

                      return (
                        <button
                          key={`text-marker-${cluster.id}`}
                          type="button"
                          onClick={() =>
                            setSelected({
                              type: 'cluster',
                              data: cluster,
                            })
                          }
                          title={`${cluster.reportCount} ${cluster.dominantCategory} reports`}
                          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-110"
                          style={{
                            left: `${x}%`,
                            top: `${y}%`,
                          }}
                        >
                          <div
                            className="flex items-center justify-center rounded-full border-2 border-white font-semibold text-white shadow-lg"
                            style={{
                              width: size,
                              height: size,
                              backgroundColor:
                                color,
                              fontSize:
                                size >= 48
                                  ? '16px'
                                  : '14px',
                            }}
                          >
                            {
                              cluster.reportCount
                            }
                          </div>
                        </button>
                      );
                    },
                  )}

                  {/* ==================================
                      INDIVIDUAL GEO REPORTS
                  ================================== */}

                  {geoReports
                    .filter(
                      (report) =>
                        !hotspotReportIds.has(
                          report.id,
                        ),
                    )
                    .map(
                      (report) => {
                        const {
                          x,
                          y,
                        } =
                          latLngToXY(
                            Number(
                              report.latitude,
                            ),
                            Number(
                              report.longitude,
                            ),
                          );

                        const category =
                          getReportCategory(
                            report,
                          );

                        const color =
                          getCategoryColor(
                            category,
                          );

                        return (
                          <button
                            key={`report-${report.id}`}
                            type="button"
                            onClick={() =>
                              setSelected({
                                type: 'report',
                                data: report,
                              })
                            }
                            title={`${category}: ${
                              report.ai_issue_type ??
                              report.description
                            }`}
                            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                            }}
                          >
                            <div
                              className="h-4 w-4 rounded-full border-2 border-white shadow-md"
                              style={{
                                backgroundColor:
                                  color,
                              }}
                            />
                          </button>
                        );
                      },
                    )}

                  {/* ==================================
                      INDIVIDUAL TEXT REPORTS
                  ================================== */}

                  {textReports
                    .filter(
                      (report) =>
                        !hotspotReportIds.has(
                          report.id,
                        ),
                    )
                    .map(
                      (
                        report,
                        index,
                      ) => {
                        const cols = 8;

                        const col =
                          index % cols;

                        const row =
                          Math.floor(
                            index / cols,
                          ) +
                          (textClusters.length >
                          0
                            ? 4
                            : 0);

                        const x =
                          10 +
                          (col * 80) /
                            cols +
                          (index % 3) *
                            3;

                        const y =
                          10 +
                          row * 12 +
                          (index % 2) *
                            4;

                        const category =
                          getReportCategory(
                            report,
                          );

                        const color =
                          getCategoryColor(
                            category,
                          );

                        return (
                          <button
                            key={`text-report-${report.id}`}
                            type="button"
                            onClick={() =>
                              setSelected({
                                type: 'report',
                                data: report,
                              })
                            }
                            title={`${category}: ${
                              report.ai_issue_type ??
                              report.description
                            }`}
                            className="absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-transform hover:scale-125"
                            style={{
                              left: `${Math.min(
                                x,
                                90,
                              )}%`,
                              top: `${Math.min(
                                y,
                                85,
                              )}%`,
                            }}
                          >
                            <div
                              className="h-4 w-4 rounded-full border-2 border-white shadow-md"
                              style={{
                                backgroundColor:
                                  color,
                              }}
                            />
                          </button>
                        );
                      },
                    )}

                </div>
              )}
            </div>
          </div>

          {/* ========================================
              SIDE PANEL
          ======================================== */}

          <div className="space-y-4">

            {/* ======================================
                LEGEND
            ====================================== */}

            <div className="card p-5">

              <h3 className="text-sm font-semibold text-[#1e1e1e]">
                Legend
              </h3>

              <div className="mt-3 grid grid-cols-2 gap-2">

                {Object.entries(
                  categoryColors,
                ).map(
                  ([
                    category,
                    color,
                  ]) => (
                    <div
                      key={category}
                      className="flex items-center gap-2"
                    >
                      <div
                        className="h-3 w-3 rounded-full border border-white shadow-sm"
                        style={{
                          backgroundColor:
                            color,
                        }}
                      />

                      <span className="text-xs text-[#6b6b6b]">
                        {category}
                      </span>
                    </div>
                  ),
                )}

              </div>

              <div className="mt-3 border-t border-[#e5e5e5] pt-3">

                <div className="flex items-center gap-2">

                  <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#1e40af] text-xs font-semibold text-white shadow">
                    N
                  </div>

                  <span className="text-xs text-[#6b6b6b]">
                    Hotspot cluster (N = matching reports)
                  </span>

                </div>

                <p className="mt-2 text-[10px] leading-4 text-[#9b9b9b]">
                  A hotspot contains 3 or
                  more nearby reports of
                  the same issue category.
                </p>

              </div>
            </div>

            {/* ======================================
                HOTSPOT DETAILS
            ====================================== */}

            {selected?.type ===
              'cluster' && (
              <div className="card animate-fade-in p-5">

                <div className="flex items-center justify-between">

                  <h3 className="text-sm font-semibold text-[#1e1e1e]">
                    Hotspot Details
                  </h3>

                  <button
                    type="button"
                    onClick={() =>
                      setSelected(null)
                    }
                    className="text-[#9b9b9b] hover:text-[#1e1e1e]"
                  >
                    <X className="h-4 w-4" />
                  </button>

                </div>

                <div className="mt-4 space-y-5">

                  {/* HEADER */}

                  <div>

                    <div className="flex items-center gap-2">

                      <span
                        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium text-white"
                        style={{
                          backgroundColor:
                            getCategoryColor(
                              selected.data
                                .dominantCategory,
                            ),
                        }}
                      >
                        {
                          selected.data
                            .dominantCategory
                        }
                      </span>

                      <span className="text-xs font-medium text-[#1e40af]">
                        {
                          selected.data
                            .reportCount
                        }{' '}
                        total reports
                      </span>

                    </div>

                    <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-[#1e1e1e]">

                      <MapPin className="h-4 w-4 text-[#1e40af]" />

                      {
                        selected.data
                          .centerLocation
                      }

                    </p>

                  </div>

                  {/* WHAT IS HAPPENING */}

                  <div className="rounded-lg bg-[#f8fafc] p-3">

                    <p className="text-xs font-semibold text-[#1e1e1e]">
                      What is happening here?
                    </p>

                    <p className="mt-2 text-xs leading-5 text-[#6b6b6b]">

                      This hotspot contains{' '}

                      <strong className="text-[#1e1e1e]">
                        {
                          selected.data
                            .reportCount
                        }{' '}
                        citizen reports
                      </strong>{' '}

                      about{' '}

                      <strong className="text-[#1e1e1e]">
                        {
                          selected.data
                            .dominantCategory
                        }
                      </strong>
                      .

                    </p>

                    <p className="mt-1 text-xs leading-5 text-[#6b6b6b]">
                      These reports were
                      grouped because they
                      concern the same issue
                      category and occur within
                      the hotspot area.
                    </p>

                  </div>

                  {/* ISSUE BREAKDOWN */}

                  <div>

                    <p className="mb-2 flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                      <Tag className="h-3 w-3" />
                      Issue Breakdown
                    </p>

                    <div className="rounded-md border border-[#e5e5e5] p-3">

                      <div className="flex items-center justify-between">

                        <span className="text-xs font-medium text-[#1e1e1e]">
                          {
                            selected.data
                              .dominantCategory
                          }
                        </span>

                        <span className="text-xs font-semibold text-[#1e40af]">
                          {
                            selected.data
                              .reportCount
                          }{' '}
                          reports
                        </span>

                      </div>

                    </div>

                  </div>

                  {/* PRIORITY */}

                  <div>

                    <p className="text-xs font-medium text-[#6b6b6b]">
                      Priority Score
                    </p>

                    <div className="mt-1 flex items-center justify-between">

                      <span className="text-xl font-bold text-[#1e1e1e]">
                        {
                          selected.data
                            .priorityScore
                        }
                        /100
                      </span>

                      <span className="rounded-full bg-[#fef3c7] px-2 py-1 text-xs font-medium text-[#92400e]">
                        {
                          selected.data
                            .priorityLevel
                        }{' '}
                        Priority
                      </span>

                    </div>

                    <p className="mt-1 text-xs text-[#6b6b6b]">
                      {
                        selected.data
                          .priorityReason
                      }
                    </p>

                  </div>

                  {/* STATS */}

                  <div className="grid grid-cols-2 gap-3 text-xs">

                    <div>

                      <p className="flex items-center gap-1 font-medium text-[#6b6b6b]">
                        <Zap className="h-3 w-3" />
                        Avg Urgency
                      </p>

                      <p className="mt-1 font-medium text-[#1e1e1e]">
                        {
                          selected.data
                            .averageUrgency
                        }
                      </p>

                    </div>

                    <div>

                      <p className="flex items-center gap-1 font-medium text-[#6b6b6b]">
                        <TrendingUp className="h-3 w-3" />
                        Recent
                      </p>

                      <p className="mt-1 font-medium text-[#1e1e1e]">
                        {
                          selected.data
                            .recentCount
                        }{' '}
                        in last 7 days
                      </p>

                    </div>

                    <div className="col-span-2">

                      <p className="flex items-center gap-1 font-medium text-[#6b6b6b]">
                        <Calendar className="h-3 w-3" />
                        Date Range
                      </p>

                      <p className="mt-1 font-medium text-[#1e1e1e]">
                        {
                          selected.data
                            .dateRangeStart
                        }{' '}
                        —{' '}
                        {
                          selected.data
                            .dateRangeEnd
                        }
                      </p>

                    </div>

                  </div>

                  {/* SPECIFIC ISSUES */}

                  {selected.data
                    .issueTypes.length >
                    0 && (
                    <div>

                      <p className="flex items-center gap-1 text-xs font-medium text-[#6b6b6b]">
                        <Tag className="h-3 w-3" />
                        Specific Issues
                      </p>

                      <div className="mt-2 flex flex-wrap gap-1.5">

                        {selected.data.issueTypes.map(
                          (
                            issue,
                            index,
                          ) => (
                            <span
                              key={`${issue}-${index}`}
                              className="inline-flex items-center rounded-full bg-[#1e40af]/5 px-2.5 py-1 text-xs font-medium text-[#1e40af]"
                            >
                              {issue}
                            </span>
                          ),
                        )}

                      </div>

                    </div>
                  )}

                  {/* REPORTS IN HOTSPOT */}

                  <div>

                    <p className="text-xs font-medium text-[#6b6b6b]">
                      Reports in this hotspot
                    </p>

                    <p className="mt-1 text-[10px] text-[#9b9b9b]">
                      These reports explain why
                      this area was grouped as
                      a hotspot.
                    </p>

                    <div className="mt-3 max-h-[350px] space-y-2 overflow-y-auto">

                      {selected.data.reports.map(
                        (report) => {
                          const category =
                            getReportCategory(
                              report,
                            );

                          return (
                            <button
                              key={report.id}
                              type="button"
                              onClick={() =>
                                setSelected({
                                  type: 'report',
                                  data: report,
                                })
                              }
                              className="w-full rounded-md border border-[#e5e5e5] p-3 text-left transition-colors hover:border-[#1e40af]"
                            >

                              <div className="flex items-center justify-between gap-2">

                                <span
                                  className="inline-flex rounded-md px-2 py-0.5 text-[10px] font-medium"
                                  style={{
                                    backgroundColor:
                                      `${getCategoryColor(category)}15`,
                                    color:
                                      getCategoryColor(
                                        category,
                                      ),
                                  }}
                                >
                                  {category}
                                </span>

                                <span className="text-[10px] text-[#9b9b9b]">
                                  {
                                    report.ai_urgency ??
                                    'Unknown'
                                  }
                                </span>

                              </div>

                              <p className="mt-2 text-xs font-medium text-[#1e1e1e]">
                                {
                                  report.ai_issue_type ??
                                  'Reported issue'
                                }
                              </p>

                              <p className="mt-1 text-xs leading-4 text-[#6b6b6b]">
                                {
                                  report.ai_summary ??
                                  report.description
                                }
                              </p>

                              <p className="mt-2 flex items-center gap-1 text-[10px] text-[#9b9b9b]">
                                <MapPin className="h-3 w-3" />
                                {
                                  report.location
                                }
                              </p>

                              <p className="mt-1 text-[10px] text-[#9b9b9b]">
                                {
                                  formatRelative(
                                    report.created_at,
                                  )
                                }
                              </p>

                            </button>
                          );
                        },
                      )}

                    </div>

                  </div>

                </div>
              </div>
            )}

            {/* ======================================
                INDIVIDUAL REPORT DETAILS
            ====================================== */}

            {selected?.type ===
              'report' && (
              <div className="card animate-fade-in p-5">

                <div className="flex items-center justify-between">

                  <h3 className="text-sm font-semibold text-[#1e1e1e]">
                    Report Details
                  </h3>

                  <button
                    type="button"
                    onClick={() =>
                      setSelected(null)
                    }
                    className="text-[#9b9b9b] hover:text-[#1e1e1e]"
                  >
                    <X className="h-4 w-4" />
                  </button>

                </div>

                <div className="mt-4">

                  <div className="flex items-center gap-2">

                    <span
                      className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor:
                          `${getCategoryColor(
                            getReportCategory(
                              selected.data,
                            ),
                          )}15`,
                        color:
                          getCategoryColor(
                            getReportCategory(
                              selected.data,
                            ),
                          ),
                      }}
                    >
                      {
                        getReportCategory(
                          selected.data,
                        )
                      }
                    </span>

                    <span className="text-xs text-[#9b9b9b]">
                      {
                        formatRelative(
                          selected.data
                            .created_at,
                        )
                      }
                    </span>

                  </div>

                  <p className="mt-3 text-sm text-[#1e1e1e]">
                    {
                      selected.data
                        .description
                    }
                  </p>

                  {selected.data
                    .ai_issue_type && (
                    <p className="mt-3 text-xs text-[#6b6b6b]">

                      <strong className="text-[#1e1e1e]">
                        Issue:
                      </strong>{' '}

                      {
                        selected.data
                          .ai_issue_type
                      }

                    </p>
                  )}

                  {selected.data
                    .ai_urgency && (
                    <p className="mt-2 text-xs text-[#6b6b6b]">

                      <strong className="text-[#1e1e1e]">
                        Urgency:
                      </strong>{' '}

                      {
                        selected.data
                          .ai_urgency
                      }

                    </p>
                  )}

                  {selected.data
                    .ai_summary && (
                    <p className="mt-3 text-xs leading-5 text-[#6b6b6b]">

                      <strong className="text-[#1e1e1e]">
                        AI Summary:
                      </strong>{' '}

                      {
                        selected.data
                          .ai_summary
                      }

                    </p>
                  )}

                  <p className="mt-3 flex items-center gap-1 text-xs text-[#6b6b6b]">
                    <MapPin className="h-3 w-3" />
                    {
                      selected.data
                        .location
                    }
                  </p>

                </div>

              </div>
            )}

            {/* ======================================
                DEFAULT REPORT LIST
            ====================================== */}

            {!selected && (
              <div className="card p-5">

                <h3 className="text-sm font-semibold text-[#1e1e1e]">
                  Report List
                </h3>

                <p className="mt-1 text-xs text-[#6b6b6b]">
                  Click a pin or hotspot to
                  inspect the issue.
                </p>

                <div className="mt-4 max-h-[350px] space-y-3 overflow-y-auto">

                  {reports.length ===
                  0 ? (

                    <p className="text-xs text-[#9b9b9b]">
                      No reports available
                    </p>

                  ) : (

                    reports.map(
                      (report) => {
                        const category =
                          getReportCategory(
                            report,
                          );

                        const color =
                          getCategoryColor(
                            category,
                          );

                        return (
                          <button
                            key={report.id}
                            type="button"
                            onClick={() =>
                              setSelected({
                                type: 'report',
                                data: report,
                              })
                            }
                            className="flex w-full items-start gap-2 rounded-lg border border-[#e5e5e5] px-3 py-2 text-left transition-colors hover:border-[#1e40af]"
                          >

                            <FileText
                              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0"
                              style={{
                                color,
                              }}
                            />

                            <div className="min-w-0">

                              <p className="truncate text-xs font-medium text-[#1e1e1e]">
                                {category}
                              </p>

                              <p className="truncate text-xs text-[#6b6b6b]">
                                {
                                  report.location
                                }
                              </p>

                            </div>

                          </button>
                        );
                      },
                    )
                  )}

                </div>

              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}