import React, { useEffect, useState } from "react";
import Papa from "papaparse";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend
} from "recharts";

// 데이터 타입
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

const COLORS = [
    "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#D92B2B", "#8936FF", "#FFB3DD"
];

// 주말 제외 필터 함수
function excludeWeekend(data: RawRelease[]) {
    return data.filter(
        d => d.published_weekday !== "Saturday" && d.published_weekday !== "Sunday"
    );
}

// 집계 함수들 (주말 제외 데이터 사용)
function getYearStats(data: RawRelease[]) {
    const filtered = excludeWeekend(data);
    const byYear: Record<string, { year: string; count: number }> = {};
    for (const d of filtered) {
        if (!d.published_year) continue;
        byYear[d.published_year] = byYear[d.published_year] || { year: d.published_year, count: 0 };
        byYear[d.published_year].count += 1;
    }
    return Object.values(byYear).sort((a, b) => a.year.localeCompare(b.year));
}

function getMonthStats(data: RawRelease[], year: string) {
    const filtered = excludeWeekend(data);
    const byMonth: Record<string, { month: string; count: number }> = {};
    for (const d of filtered) {
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
    // 월~금만 집계
    const filtered = excludeWeekend(data);
    const byDay: Record<string, { weekday: string; count: number }> = {};
    for (const d of filtered) {
        if (!d.published_weekday) continue;
        byDay[d.published_weekday] = byDay[d.published_weekday] || { weekday: d.published_weekday, count: 0 };
        byDay[d.published_weekday].count += 1;
    }
    const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
    return order.map(day => byDay[day] || { weekday: day, count: 0 });
}

function getReleaseTypeStats(data: RawRelease[]) {
    const filtered = excludeWeekend(data);
    let draft = 0, prerelease = 0, release = 0;
    for (const d of filtered) {
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
    const filtered = excludeWeekend(data);
    const byMonth: Record<string, { month: string; count: number }> = {};
    for (const d of filtered) {
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
    // 주말 제외
    const filtered = excludeWeekend(data);
    const publishedDates = filtered
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

// Card 컴포넌트
function Card({ children }: { children: React.ReactNode }) {
    return (
        <div style={{
            background: "#fafbfc",
            borderRadius: 16,
            boxShadow: "0 2px 12px #0001",
            padding: 28,
            minHeight: 350,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
        }}>
            {children}
        </div>
    );
}

// 차트 컴포넌트들 (카드 내부)
function SimpleBarChart({ data, dataKey, xKey, title, color }: {
    data: any[]; dataKey: string; xKey: string; title: string; color: string;
}) {
    return (
        <>
            <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 18 }}>{title}</h2>
            <BarChart width={380} height={220} data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey={dataKey} fill={color} radius={[8, 8, 0, 0]} />
            </BarChart>
        </>
    );
}

function SimplePieChart({ data, dataKey, nameKey, title }: {
    data: any[]; dataKey: string; nameKey: string; title: string;
}) {
    return (
        <>
            <h2 style={{ fontSize: 19, fontWeight: 700, marginBottom: 18 }}>{title}</h2>
            <PieChart width={320} height={220}>
                <Pie
                    data={data}
                    dataKey={dataKey}
                    nameKey={nameKey}
                    cx="50%"
                    cy="50%"
                    outerRadius={75}
                >
                    {data.map((entry, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 15 }} />
                <Tooltip />
            </PieChart>
        </>
    );
}

// --- 메인 대시보드 ---
function Dashboard() {
    const [data, setData] = useState<RawRelease[]>([]);

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

    const yearList = Array.from(new Set(excludeWeekend(data).map(d => d.published_year)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
    const [selectedYear, setSelectedYear] = useState("");
    useEffect(() => {
        if (yearList.length) setSelectedYear(yearList[yearList.length - 1]);
    }, [yearList.length]);

    const avgInterval = getAverageReleaseInterval(data);

    return (
        <div style={{ background: "#f4f6fa", minHeight: "100vh", padding: "32px 0" }}>
            <div style={{
                maxWidth: 1180, margin: "0 auto", padding: 8,
            }}>
                <div style={{ marginBottom: 24 }}>
                    <div style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: "#20232a" }}>
                        Release Tracker Dashboard
                    </div>
                    <div style={{ fontSize: 17, color: "#555", marginBottom: 16 }}>
                        GitHub Release 통계를 한눈에 시각화합니다.<br />
                        <span style={{ color: "#D92B2B", fontWeight: 500, fontSize: 14 }}>
                            (모든 통계는 <b>주말 릴리즈를 제외</b>하고 집계합니다.)
                        </span>
                    </div>
                </div>
                {/* 카드 레이아웃: 2단 그리드, 자동 줄바꿈 */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 32,
                    alignItems: "stretch",
                }}>
                    <Card>
                        <SimpleBarChart
                            data={getYearStats(data)}
                            dataKey="count"
                            xKey="year"
                            title="연도별 릴리즈 수"
                            color="#0088FE"
                        />
                    </Card>
                    <Card>
                        <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                            <h2 style={{ fontSize: 19, fontWeight: 700, margin: 0, marginRight: 16 }}>
                                {selectedYear}년 월별 릴리즈 수
                            </h2>
                            <select
                                style={{ fontSize: 16, padding: "2px 12px", borderRadius: 7, border: "1px solid #eee" }}
                                value={selectedYear}
                                onChange={e => setSelectedYear(e.target.value)}
                            >
                                {yearList.map(y => (
                                    <option key={y} value={y}>{y}년</option>
                                ))}
                            </select>
                        </div>
                        <BarChart width={380} height={220} data={getMonthStats(data, selectedYear)}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#00C49F" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </Card>
                    <Card>
                        <SimplePieChart
                            data={getWeekdayStats(data)}
                            dataKey="count"
                            nameKey="weekday"
                            title="요일별 릴리즈 비율"
                        />
                    </Card>
                    <Card>
                        <SimplePieChart
                            data={getReleaseTypeStats(data)}
                            dataKey="count"
                            nameKey="type"
                            title="릴리즈 유형별 비율 (Draft / Prerelease / Release)"
                        />
                    </Card>
                    <Card>
                        <SimpleBarChart
                            data={getAllTimeMonthTop3(data)}
                            dataKey="count"
                            xKey="month"
                            title="역대 릴리즈가 가장 많았던 월 TOP 3"
                            color="#FFBB28"
                        />
                    </Card>
                    <Card>
                        <div style={{
                            width: "100%", height: "100%",
                            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center"
                        }}>
                            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>평균 릴리즈 간격</div>
                            <span style={{ fontSize: 34, color: "#0088FE", fontWeight: 900 }}>
                                {avgInterval ? `${avgInterval}일` : "데이터 부족"}
                            </span>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;