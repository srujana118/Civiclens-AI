import type { CivicReport } from '@/lib/supabase';
import { formatDate } from '@/lib/utils';

export type Cluster = {
  id: string;
  reportCount: number;

  priorityLevel: 'High' | 'Medium' | 'Low';
  priorityScore: number;
  priorityReason: string;

  centerLocation: string;
  centerLatitude: number | null;
  centerLongitude: number | null;

  dominantCategory: string;
  issueTypes: string[];
  averageUrgency: string;
  recentCount: number;

  dateRangeStart: string;
  dateRangeEnd: string;

  reportIds: string[];
  reports: CivicReport[];
};

const EARTH_RADIUS_KM = 6371;

/*
 * Reports within this distance can belong
 * to the same geographic hotspot.
 */
const CLUSTER_RADIUS_KM = 1.5;

const RECENT_DAYS = 7;

const URGENCY_VALUES: Record<string, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4,
};

/* --------------------------------------------------
   CATEGORY
-------------------------------------------------- */

function getCategory(report: CivicReport): string {
  return (
    report.ai_category?.trim() ||
    report.category?.trim() ||
    'Other'
  );
}

function normalizeCategory(category: string): string {
  return category
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/* --------------------------------------------------
   DISTANCE
-------------------------------------------------- */

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.asin(Math.sqrt(a))
  );
}

/* --------------------------------------------------
   TEXT LOCATION
-------------------------------------------------- */

function normalizeLocation(location: string): string {
  return location
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .split(',')[0]
    .trim();
}

/* --------------------------------------------------
   RECENT
-------------------------------------------------- */

function isRecent(dateStr: string): boolean {
  const created = new Date(dateStr).getTime();

  if (Number.isNaN(created)) {
    return false;
  }

  const diff = Date.now() - created;

  return (
    diff >= 0 &&
    diff <= RECENT_DAYS * 24 * 60 * 60 * 1000
  );
}

/* --------------------------------------------------
   URGENCY
-------------------------------------------------- */

function avgUrgencyValue(
  reports: CivicReport[],
): string {
  const values: number[] = [];

  for (const report of reports) {
    const urgency = report.ai_urgency;

    if (
      urgency &&
      URGENCY_VALUES[urgency] !== undefined
    ) {
      values.push(URGENCY_VALUES[urgency]);
    }
  }

  if (values.length === 0) {
    return 'Unknown';
  }

  const average =
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length;

  const rounded = Math.round(average);

  const result = Object.entries(
    URGENCY_VALUES,
  ).find(([, value]) => value === rounded);

  return result?.[0] ?? 'Medium';
}

/* --------------------------------------------------
   PRIORITY
-------------------------------------------------- */

function calculatePriority(
  reportCount: number,
  averageUrgency: string,
  recentCount: number,
): {
  level: 'High' | 'Medium' | 'Low';
  score: number;
  reason: string;
} {
  const reportScore =
    Math.min(reportCount / 10, 1) * 40;

  const urgencyScore =
    ((URGENCY_VALUES[averageUrgency] ?? 0) / 4) *
    40;

  const recentScore =
    reportCount > 0
      ? Math.min(recentCount / reportCount, 1) *
        20
      : 0;

  const score = Math.round(
    reportScore +
      urgencyScore +
      recentScore,
  );

  let level: 'High' | 'Medium' | 'Low';

  if (score >= 70) {
    level = 'High';
  } else if (score >= 45) {
    level = 'Medium';
  } else {
    level = 'Low';
  }

  const reasons: string[] = [];

  if (reportCount >= 5) {
    reasons.push('high report concentration');
  }

  if (
    averageUrgency === 'High' ||
    averageUrgency === 'Critical'
  ) {
    reasons.push('high average urgency');
  }

  if (recentCount >= 2) {
    reasons.push('recent citizen activity');
  }

  const reason =
    reasons.length > 0
      ? reasons.join(', ')
      : 'limited current report activity';

  return {
    level,
    score,
    reason,
  };
}

/* --------------------------------------------------
   BUILD CLUSTER
-------------------------------------------------- */

function buildCluster(
  reports: CivicReport[],
): Cluster {
  const issueTypes = new Set<string>();
  const locations: string[] = [];

  for (const report of reports) {
    if (report.ai_issue_type?.trim()) {
      issueTypes.add(
        report.ai_issue_type.trim(),
      );
    }

    const location =
      report.location
        ?.split(',')[0]
        ?.trim();

    if (
      location &&
      !locations.includes(location)
    ) {
      locations.push(location);
    }
  }

  /*
   * Every report in this cluster is already
   * guaranteed to be the same category.
   */
  const dominantCategory = getCategory(
    reports[0],
  );

  const recentCount = reports.filter(
    (report) =>
      isRecent(report.created_at),
  ).length;

  const averageUrgency =
    avgUrgencyValue(reports);

  const priority = calculatePriority(
    reports.length,
    averageUrgency,
    recentCount,
  );

  const sortedByDate = [...reports].sort(
    (a, b) =>
      new Date(a.created_at).getTime() -
      new Date(b.created_at).getTime(),
  );

  const geoReports = reports.filter(
    (report) =>
      report.latitude != null &&
      report.longitude != null,
  );

  const centerLatitude =
    geoReports.length > 0
      ? geoReports.reduce(
          (sum, report) =>
            sum + Number(report.latitude),
          0,
        ) / geoReports.length
      : null;

  const centerLongitude =
    geoReports.length > 0
      ? geoReports.reduce(
          (sum, report) =>
            sum + Number(report.longitude),
          0,
        ) / geoReports.length
      : null;

  return {
    id: `cluster-${reports
      .map((report) => report.id)
      .sort()
      .join('-')
      .slice(0, 36)}`,

    reportCount: reports.length,

    priorityLevel: priority.level,
    priorityScore: priority.score,
    priorityReason: priority.reason,

    centerLocation:
      locations.length > 0
        ? locations.join(', ')
        : 'Unknown location',

    centerLatitude,
    centerLongitude,

    dominantCategory,

    issueTypes: [...issueTypes],

    averageUrgency,
    recentCount,

    dateRangeStart: formatDate(
      sortedByDate[0].created_at,
    ),

    dateRangeEnd: formatDate(
      sortedByDate[
        sortedByDate.length - 1
      ].created_at,
    ),

    reportIds: reports.map(
      (report) => report.id,
    ),

    reports,
  };
}

/* --------------------------------------------------
   GEOGRAPHIC CLUSTERING
-------------------------------------------------- */

function clusterGeographicReports(
  reports: CivicReport[],
): CivicReport[][] {
  const groups: CivicReport[][] = [];

  /*
   * IMPORTANT:
   *
   * First separate by category.
   *
   * Therefore:
   *
   * Potholes + Parks = NEVER same hotspot
   * Potholes + Water = NEVER same hotspot
   * Water + Street Lighting = NEVER same hotspot
   */
  const categoryGroups =
    new Map<string, CivicReport[]>();

  for (const report of reports) {
    const category = normalizeCategory(
      getCategory(report),
    );

    const existing =
      categoryGroups.get(category) ?? [];

    existing.push(report);

    categoryGroups.set(
      category,
      existing,
    );
  }

  categoryGroups.forEach(
    (categoryReports) => {
      /*
       * A hotspot requires at least
       * 3 reports of this category.
       */
      if (categoryReports.length < 3) {
        return;
      }

      const visited = new Set<string>();

      for (const report of categoryReports) {
        if (visited.has(report.id)) {
          continue;
        }

        if (
          report.latitude == null ||
          report.longitude == null
        ) {
          continue;
        }

        const group: CivicReport[] = [
          report,
        ];

        const queue: CivicReport[] = [
          report,
        ];

        visited.add(report.id);

        while (queue.length > 0) {
          const current =
            queue.shift()!;

          if (
            current.latitude == null ||
            current.longitude == null
          ) {
            continue;
          }

          for (const candidate of categoryReports) {
            if (
              visited.has(candidate.id)
            ) {
              continue;
            }

            if (
              candidate.latitude == null ||
              candidate.longitude == null
            ) {
              continue;
            }

            const distance =
              haversineKm(
                Number(current.latitude),
                Number(current.longitude),
                Number(candidate.latitude),
                Number(candidate.longitude),
              );

            if (
              distance <=
              CLUSTER_RADIUS_KM
            ) {
              visited.add(
                candidate.id,
              );

              group.push(candidate);
              queue.push(candidate);
            }
          }
        }

        /*
         * Only groups with 3+ reports become
         * actual hotspots.
         */
        if (group.length >= 3) {
          groups.push(group);
        }
      }
    },
  );

  return groups;
}

/* --------------------------------------------------
   TEXT LOCATION CLUSTERING
-------------------------------------------------- */

function clusterTextReports(
  reports: CivicReport[],
): CivicReport[][] {
  const groups: CivicReport[][] = [];

  const grouped =
    new Map<string, CivicReport[]>();

  for (const report of reports) {
    const category =
      normalizeCategory(
        getCategory(report),
      );

    const location =
      normalizeLocation(
        report.location ?? '',
      );

    const key =
      `${category}|||${location}`;

    const existing =
      grouped.get(key) ?? [];

    existing.push(report);

    grouped.set(key, existing);
  }

  grouped.forEach((group) => {
    if (group.length >= 3) {
      groups.push(group);
    }
  });

  return groups;
}

/* --------------------------------------------------
   MAIN
-------------------------------------------------- */

export function detectHotspots(
  reports: CivicReport[],
): Cluster[] {
  if (reports.length < 3) {
    return [];
  }

  const geoReports = reports.filter(
    (report) =>
      report.latitude != null &&
      report.longitude != null,
  );

  const textReports = reports.filter(
    (report) =>
      report.latitude == null ||
      report.longitude == null,
  );

  const groups: CivicReport[][] = [];

  if (geoReports.length >= 3) {
    groups.push(
      ...clusterGeographicReports(
        geoReports,
      ),
    );
  }

  if (textReports.length >= 3) {
    groups.push(
      ...clusterTextReports(
        textReports,
      ),
    );
  }

  const clusters = groups.map(
    (group) => buildCluster(group),
  );

  return clusters.sort((a, b) => {
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
      b.reportCount -
      a.reportCount
    );
  });
}