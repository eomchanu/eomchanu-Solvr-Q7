import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend
} from "recharts";

// Raw 데이터 타입: release-raw.csv 컬럼명에 camelCase로 맞춤
interface RawRelease {
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

// CSV 컬럼명을 camelCase로 변환
function normalizeRow(row: any): RawRelease {
  return {
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
  };
}

// 색상 팔레트
const COLORS = [
  "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#D92B2B", "#8936FF", "#FFB3DD"
];

// --- 집계 함수 ---

function getYearStats(data: RawRelease[]) {
  const byYear: Record<string, { year: string; count: number }> = {};
  for (const d of data) {
    if (!d.published_year) continue;
    byYear[d.published_year] = byYear[d.published_year] || { year: d.published_year, count: 0 };
    byYear[d.published_year].count += 1;
  }
  return Object.values(byYear);
}

function getMonthStats(data: RawRelease[], year: string) {
  const byMonth: Record<string, { month: string; count: number }> = {};
  for (const d of data) {
    if (d.published_year !== year) continue;
    const month = d.published_month.padStart(2, "0");
    byMonth[month] = byMonth[month] || { month, count: 0 };
    byMonth[month].count += 1;
  }
  // 1~12월 항상 포함, 값 없으면 count 0
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
  // 요일 순서: 월화수목금토일 정렬
  const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  return Object.values(byDay).sort((a, b) => order.indexOf(a.weekday) - order.indexOf(b.weekday));
}

// Release Type 비율 (draft, prerelease, release)
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

// 전체 기간 기준 월별 릴리즈 합산 Top 3
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

// 평균 릴리즈 주기(일)
function getAverageReleaseInterval(data: RawRelease[]) {
  // 최신순 정렬
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
  return Math.round(avgMs / (1000 * 60 * 60 * 24)); // 일 단위
}

// --- 차트 컴포넌트들 ---

function SimpleBarChart({ data, dataKey, xKey, title, color }: {
  data: any[]; dataKey: string; xKey: string; title: string; color: string;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2>{title}</h2>
      <BarChart width={500} height={300} data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey={xKey} />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Bar dataKey={dataKey} fill={color} />
      </BarChart>
    </div>
  );
}

function SimplePieChart({ data, dataKey, nameKey, title }: {
  data: any[]; dataKey: string; nameKey: string; title: string;
}) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2>{title}</h2>
      <PieChart width={400} height={250}>
        <Pie
          data={data}
          dataKey={dataKey}
          nameKey={nameKey}
          cx="50%"
          cy="50%"
          outerRadius={80}
        >
          {data.map((entry, idx) => (
            <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
          ))}
        </Pie>
        <Legend />
        <Tooltip />
      </PieChart>
    </div>
  );
}

// --- 대시보드 메인 ---

function Dashboard() {
  const [data, setData] = useState<RawRelease[]>([]);

  // CSV fetch & 파싱
  useEffect(() => {
    fetch("/release-raw.csv")
      .then(res => res.text())
      .then(csv => {
        Papa.parse(csv, {
          header: true,
          skipEmptyLines: true,
          complete: result => {
            const normalized = (result.data as any[]).map(normalizeRow);
            setData(normalized);
          }
        });
      });
  }, []);

  // 연도 목록 및 선택 연도 상태
  const yearList = Array.from(new Set(data.map(d => d.published_year)))
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  const [selectedYear, setSelectedYear] = useState("");
  useEffect(() => {
    if (yearList.length) setSelectedYear(yearList[yearList.length - 1]);
  }, [yearList.length]);

  const avgInterval = getAverageReleaseInterval(data);

  return (
    <div style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Release Tracker Dashboard</h1>

      {/* 연도별 */}
      <SimpleBarChart
        data={getYearStats(data)}
        dataKey="count"
        xKey="year"
        title="연도별 릴리즈 수"
        color="#0088FE"
      />

      {/* 월별 (연도 선택 가능) */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>{selectedYear}년 월별 릴리즈 수</h2>
          <select
            style={{ marginLeft: 16, fontSize: 16 }}
            value={selectedYear}
            onChange={e => setSelectedYear(e.target.value)}
          >
            {yearList.map(y => (
              <option key={y} value={y}>{y}년</option>
            ))}
          </select>
        </div>
        <BarChart width={500} height={300} data={getMonthStats(data, selectedYear)}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#00C49F" />
        </BarChart>
      </div>

      {/* 전체 월별 Top 3 */}
      <SimpleBarChart
        data={getAllTimeMonthTop3(data)}
        dataKey="count"
        xKey="month"
        title="역대 릴리즈가 가장 많았던 월 TOP 3"
        color="#FFBB28"
      />

      {/* 요일별 비율 */}
      <SimplePieChart
        data={getWeekdayStats(data)}
        dataKey="count"
        nameKey="weekday"
        title="요일별 릴리즈 비율"
      />

      {/* Release Type Pie */}
      <SimplePieChart
        data={getReleaseTypeStats(data)}
        dataKey="count"
        nameKey="type"
        title="릴리즈 유형별 비율 (Draft / Prerelease / Release)"
      />

      {/* 평균 릴리즈 주기 안내 */}
      <div style={{ marginTop: 32, fontSize: 20 }}>
        <b>평균 릴리즈 간격:</b> {avgInterval ? `${avgInterval}일` : "데이터 부족"}  
      </div>
    </div>
  );
}

export default Dashboard;