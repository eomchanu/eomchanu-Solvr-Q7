import axios from "axios";
import { createObjectCsvWriter } from "csv-writer";
import { parseISO, getYear, getWeek, format, getDay } from "date-fns";

/** --- 타입 정의 --- */
interface ReleaseAuthor {
  login: string;
}
interface ReleaseAsset {
  name: string;
  size: number;
}
interface GithubRelease {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  published_at: string;
  author: ReleaseAuthor;
  assets: ReleaseAsset[];
  html_url: string;
}
interface ReleaseInfo {
  repo: string;
  release_id: number;
  tag_name: string;
  release_name: string;
  author: string;
  created_at: string;
  published_at: string;
  is_draft: boolean;
  is_prerelease: boolean;
  body: string;
  assets_count: number;
  assets_names: string;
  html_url: string;
}

/** --- 상수 선언 --- */
const GITHUB_API = "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPOS = [
  "daangn/stackflow",
  "daangn/seed-design"
];
const WEEKEND_DAYS = [0, 6]; // 0: 일요일, 6: 토요일

/** --- 주어진 repo의 모든 Release 가져오기 --- */
async function fetchAllReleases(repo: string): Promise<GithubRelease[]> {
  let releases: GithubRelease[] = [];
  let page = 1;
  while (true) {
    try {
      const { data } = await axios.get(`${GITHUB_API}/repos/${repo}/releases`, {
        params: { per_page: 100, page },
        headers: GITHUB_TOKEN ? { Authorization: `token ${GITHUB_TOKEN}` } : {}
      });
      if (!data.length) break;
      releases = releases.concat(data);
      page++;
    } catch (e) {
      console.error(`Error fetching releases from ${repo}:`, e);
      break;
    }
  }
  return releases;
}

/** --- Github API Release 응답을 ReleaseInfo 형태로 변환 --- */
function extractReleaseInfo(repo: string, raw: GithubRelease): ReleaseInfo {
  return {
    repo,
    release_id: raw.id,
    tag_name: raw.tag_name,
    release_name: raw.name ?? "",
    author: raw.author?.login ?? "",
    created_at: raw.created_at,
    published_at: raw.published_at,
    is_draft: raw.draft,
    is_prerelease: raw.prerelease,
    body: raw.body ?? "",
    assets_count: raw.assets.length,
    assets_names: raw.assets.map(a => a.name).join(";"),
    html_url: raw.html_url
  };
}

/** --- 평일(월~금)인지 판별 --- */
function isWeekday(dateString: string): boolean {
  const day = getDay(parseISO(dateString));
  return !WEEKEND_DAYS.includes(day);
}

/** --- 연/주/일별 평일 릴리즈 통계 생성 --- */
function makeStats(releases: ReleaseInfo[]) {
  const yearly: Record<string, number> = {};
  const weekly: Record<string, number> = {};
  const daily: Record<string, number> = {};

  for (const r of releases) {
    if (!isWeekday(r.created_at)) continue; // 평일만 포함
    const d = parseISO(r.created_at);
    const y = getYear(d);
    const w = getWeek(d);
    const day = format(d, "yyyy-MM-dd");
    yearly[`${r.repo}__${y}`] = (yearly[`${r.repo}__${y}`] || 0) + 1;
    weekly[`${r.repo}__${y}-W${w}`] = (weekly[`${r.repo}__${y}-W${w}`] || 0) + 1;
    daily[`${r.repo}__${day}`] = (daily[`${r.repo}__${day}`] || 0) + 1;
  }
  return { yearly, weekly, daily };
}

/** --- 통계 정보를 repo > type > period 순으로 정렬 후 CSV로 저장 --- */
type StatRecord = { type: string; period: string; repo: string; count: number; };
async function saveStatsCSV(stats: ReturnType<typeof makeStats>, filename: string) {
  const records: StatRecord[] = [];
  for (const [k, v] of Object.entries(stats.yearly)) {
    const [repo, period] = k.split("__");
    records.push({ type: "Yearly", period, repo, count: v });
  }
  for (const [k, v] of Object.entries(stats.weekly)) {
    const [repo, period] = k.split("__");
    records.push({ type: "Weekly", period, repo, count: v });
  }
  for (const [k, v] of Object.entries(stats.daily)) {
    const [repo, period] = k.split("__");
    records.push({ type: "Daily", period, repo, count: v });
  }

  records.sort((a, b) => {
    if (a.repo !== b.repo) return a.repo.localeCompare(b.repo);
    if (a.type !== b.type) return a.type.localeCompare(b.type);
    return a.period.localeCompare(b.period);
  });

  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: [
      { id: "repo", title: "Repo" },
      { id: "type", title: "Type" },
      { id: "period", title: "Period" },
      { id: "count", title: "ReleaseCount" }
    ]
  });
  await csvWriter.writeRecords(records);
  console.log(`release-stats.csv 파일 생성됨`);
}

/** --- 메인 실행 --- */
async function main() {
  // 모든 repo에 대해 병렬로 Release 데이터 가져오기
  const allReleasesByRepo = await Promise.all(REPOS.map(fetchAllReleases));
  // ReleaseInfo로 변환
  const allReleaseInfo: ReleaseInfo[] = [];
  for (let i = 0; i < REPOS.length; i++) {
    allReleaseInfo.push(...allReleasesByRepo[i].map(r => extractReleaseInfo(REPOS[i], r)));
  }

  // 평일(월~금) 릴리즈만 포함하는 통계 CSV 생성
  const stats = makeStats(allReleaseInfo);
  await saveStatsCSV(stats, "release-stats.csv");
}

main().catch(e => {
  console.error("실행 중 오류:", e);
  process.exit(1);
});