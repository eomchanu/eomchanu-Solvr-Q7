import React, { useEffect, useState } from "react";
import axios from "axios";
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, Legend
} from "recharts";

// --- 서버 API 응답 타입 ---
interface DashboardStats {
    yearStats: { year: string; count: number }[];
    monthStats: Record<string, { month: string; count: number }[]>;
    allYears: string[];
    weekdayStats: { weekday: string; count: number }[];
    releaseTypeStats: { type: string; count: number }[];
    top3Months: { month: string; count: number }[];
    avgReleaseInterval: number;
}

// --- 색상 팔레트 ---
const COLORS = [
    "#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#D92B2B", "#8936FF", "#FFB3DD"
];

// --- 카드 컴포넌트 ---
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

// --- 바 차트 ---
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
                <Bar dataKey={dataKey} fill={color} radius={[7, 7, 0, 0]} />
            </BarChart>
        </>
    );
}

// --- 파이 차트 ---
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
                    {data.map((_, idx) => (
                        <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                </Pie>
                <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 15 }} />
                <Tooltip />
            </PieChart>
        </>
    );
}

// --- 메인 대시보드 컴포넌트 ---
function Dashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [selectedYear, setSelectedYear] = useState<string>("");

    // 최초 로딩 시 전체 통계 fetch
    useEffect(() => {
        axios.get<DashboardStats>("/api/dashboard/stats")
            .then(res => {
                setStats(res.data);
                // 연도 선택 기본값: 최신 연도
                if (res.data.allYears.length) {
                    setSelectedYear(res.data.allYears[res.data.allYears.length - 1]);
                }
            });
    }, []);

    if (!stats) {
        return (
            <div className="w-full flex justify-center items-center" style={{ minHeight: 480 }}>
                <div className="text-xl text-neutral-600">통계 데이터를 불러오는 중...</div>
            </div>
        );
    }

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
                        GitHub Release 통계를 한눈에 시각화합니다.
                    </div>
                </div>
                {/* 카드 그리드 레이아웃 */}
                <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 32,
                    alignItems: "stretch",
                }}>
                    <Card>
                        <SimpleBarChart
                            data={stats.yearStats}
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
                                {stats.allYears.map(y => (
                                    <option key={y} value={y}>{y}년</option>
                                ))}
                            </select>
                        </div>
                        <BarChart width={380} height={220} data={stats.monthStats[selectedYear] || []}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" fill="#00C49F" radius={[7, 7, 0, 0]} />
                        </BarChart>
                    </Card>
                    <Card>
                        <SimplePieChart
                            data={stats.weekdayStats}
                            dataKey="count"
                            nameKey="weekday"
                            title="요일별 릴리즈 비율"
                        />
                    </Card>
                    <Card>
                        <SimplePieChart
                            data={stats.releaseTypeStats}
                            dataKey="count"
                            nameKey="type"
                            title="릴리즈 유형별 비율 (Draft / Prerelease / Release)"
                        />
                    </Card>
                    <Card>
                        <SimpleBarChart
                            data={stats.top3Months}
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
                                {stats.avgReleaseInterval ? `${stats.avgReleaseInterval}일` : "데이터 부족"}
                            </span>
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

export default Dashboard;