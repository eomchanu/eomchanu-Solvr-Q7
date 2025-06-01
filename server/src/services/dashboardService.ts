import fs from "fs";
import path from "path";
import Papa from "papaparse";

// 타입 정의
export interface RawRelease {
  repo: string;
  release_id: string;
  tag_name: string;
  release_name: string;
  author: string;
  created_at: string;
  published_at: string;
  is_draft: string;
  is_prerelease: string;
  body: string;
  assets_count: string;
  assets_names: string;
  html_url: string;
  published_weekday: string;
  published_date: string;
  published_year: string;
  published_month: string;
  published_week: string;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

// 주말 제외하고 데이터 파싱
function loadRawReleases(): RawRelease[] {
  const filePath = path.join(__dirname, "../../release-raw.csv");
  const csvStr = fs.readFileSync(filePath, "utf-8");
  const parsed = Papa.parse(csvStr, { header: true, skipEmptyLines: true });
  return (parsed.data as any[]).map((row) => ({
    repo: row.Repo,
    release_id: row.ReleaseID,
    tag_name: row.Tag,
    release_name: row.ReleaseName,
    author: row.Author,
    created_at: row.CreatedAt,
    published_at: row.PublishedAt,
    is_draft: row.IsDraft,
    is_prerelease: row.IsPrerelease,
    body: row.Body,
    assets_count: row.AssetsCount,
    assets_names: row.AssetsNames,
    html_url: row.HtmlUrl,
    published_weekday: row.PublishedWeekday,
    published_date: row.PublishedDate,
    published_year: row.PublishedYear,
    published_month: row.PublishedMonth,
    published_week: row.PublishedWeek,
  })).filter((row) => WEEKDAYS.includes(row.published_weekday)); // 평일만 반환
}

// === 집계 함수들 ===

function getYearStats(data: RawRelease[]) {
  const byYear: Record<string, { year: string; count: number }> = {};
  for (const d of data) {
    if (!d.published_year) continue;
    byYear[d.published_year] = byYear[d.published_year] || { year: d.published_year, count: 0 };
    byYear[d.published_year].count += 1;
  }
  return Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year));
}

function getMonthStats(data: RawRelease[], year: string) {
  const byMonth: Record<string, { month: string; count: number }> = {};
  for (const d of data) {
    if (d.published_year !== year) continue;
    const month = d.published_month.padStart(2, "0");
    byMonth[month] = byMonth[month] || { month, count: 0 };
    byMonth[month].count += 1;
  }
  return Array.from({ length: 12 }, (_, i) => {
    const m = (i + 1).toString().padStart(2, "0");
    return byMonth[m] || { month: m, count: 0 };
  });
}

function getWeekdayStats(data: RawRelease[]) {
  const byDay: Record<string, { weekday: string; count: number }> = {};
  for (const d of data) {
    if (!d.published_weekday) continue;
    byDay[d.published_weekday] = byDay[d.published_weekday] || { weekday: d.published_weekday, count: 0 };
    byDay[d.published_weekday].count += 1;
  }
  const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  return Object.values(byDay).sort((a, b) => order.indexOf(a.weekday) - order.indexOf(b.weekday));
}

function getReleaseTypeStats(data: RawRelease[]) {
  let draft = 0, prerelease = 0, release = 0;
  for (const d of data) {
    if (d.is_draft === "true") draft += 1;
    else if (d.is_prerelease === "true") prerelease += 1;
    else release += 1;
  }
  return [
    { type: "Draft", count: draft },
    { type: "Prerelease", count: prerelease },
    { type: "Release", count: release }
  ];
}

function getAllTimeMonthTop3(data: RawRelease[]) {
  const byMonth: Record<string, { month: string; count: number }> = {};
  for (const d of data) {
    if (!d.published_month) continue;
    const m = d.published_month.padStart(2, "0");
    byMonth[m] = byMonth[m] || { month: m, count: 0 };
    byMonth[m].count += 1;
  }
  return Object.values(byMonth)
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

function getAverageReleaseInterval(data: RawRelease[]) {
  const publishedDates = data
    .map(d => d.published_at)
    .filter(Boolean)
    .map(str => new Date(str).getTime())
    .sort((a, b) => a - b);
  if (publishedDates.length < 2) return 0;
  let sum = 0;
  for (let i = 1; i < publishedDates.length; ++i) {
    sum += (publishedDates[i] - publishedDates[i - 1]);
  }
  const avgMs = sum / (publishedDates.length - 1);
  return Math.round(avgMs / (1000 * 60 * 60 * 24));
}

export function getDashboardStats() {
  const data = loadRawReleases();
  const allYears = Array.from(new Set(data.map(d => d.published_year)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  return {
    allYears,
    yearStats: getYearStats(data),
    monthStats: Object.fromEntries(
      allYears.map(y => [y, getMonthStats(data, y)])
    ),
    weekdayStats: getWeekdayStats(data),
    releaseTypeStats: getReleaseTypeStats(data),
    top3Months: getAllTimeMonthTop3(data),
    avgReleaseInterval: getAverageReleaseInterval(data),
  }
}