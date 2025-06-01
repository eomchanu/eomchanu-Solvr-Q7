import axios from "axios";
import { createObjectCsvWriter } from "csv-writer";
import { parseISO, getYear, getWeek, format, getDay } from "date-fns";

// 타입 선언
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

// Github Releases fetch
const GITHUB_API = "https://api.github.com";
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;

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

// Release 데이터 구조화
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

// 평일(월~금)만 포함 여부 판단
function isWeekday(dateString: string): boolean {
  const day = getDay(parseISO(dateString));
  return day !== 0 && day !== 6; // 0=일요일, 6=토요일
}

// 통계 정보 생성 (평일만)
function makeStats(releases: ReleaseInfo[]) {
  const yearly: Record<string, number> = {};
  const weekly: Record<string, number> = {};
  const daily: Record<string, number> = {};

  releases.forEach(r => {
    if (!isWeekday(r.created_at)) return; // 주말은 제외
    const d = parseISO(r.created_at);
    const y = getYear(d);
    const w = getWeek(d);
    const day = format(d, "yyyy-MM-dd");
    yearly[`${r.repo}__${y}`] = (yearly[`${r.repo}__${y}`] || 0) + 1;
    weekly[`${r.repo}__${y}-W${w}`] = (weekly[`${r.repo}__${y}-W${w}`] || 0) + 1;
    daily[`${r.repo}__${day}`] = (daily[`${r.repo}__${day}`] || 0) + 1;
  });
  return { yearly, weekly, daily };
}

// 통계정보 CSV 저장 (repo > type > period 정렬)
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

// 상세정보 CSV 저장 (선택, 필요시)
async function saveReleasesCSV(releases: ReleaseInfo[], filename: string) {
  releases.sort((a, b) => {
    if (a.repo !== b.repo) return a.repo.localeCompare(b.repo);
    return a.release_id - b.release_id;
  });
  const csvWriter = createObjectCsvWriter({
    path: filename,
    header: [
      { id: "repo", title: "Repo" },
      { id: "release_id", title: "ReleaseID" },
      { id: "tag_name", title: "Tag" },
      { id: "release_name", title: "ReleaseName" },
      { id: "author", title: "Author" },
      { id: "created_at", title: "CreatedAt" },
      { id: "published_at", title: "PublishedAt" },
      { id: "is_draft", title: "IsDraft" },
      { id: "is_prerelease", title: "IsPrerelease" },
      { id: "body", title: "Body" },
      { id: "assets_count", title: "AssetsCount" },
      { id: "assets_names", title: "AssetsNames" },
      { id: "html_url", title: "HtmlUrl" }
    ]
  });
  await csvWriter.writeRecords(releases);
  console.log(`release-details.csv 파일 생성됨`);
}

// 메인 실행
const REPOS = [
  "daangn/stackflow",
  "daangn/seed-design"
];

async function main() {
  let allReleaseInfo: ReleaseInfo[] = [];
  for (const repo of REPOS) {
    const rawReleases = await fetchAllReleases(repo);
    const infos = rawReleases.map(r => extractReleaseInfo(repo, r));
    allReleaseInfo = allReleaseInfo.concat(infos);
  }

  // 상세정보 저장
  // await saveReleasesCSV(allReleaseInfo, "release-details.csv");

  // 평일 릴리즈만 포함하는 통계 CSV 생성
  const stats = makeStats(allReleaseInfo);
  await saveStatsCSV(stats, "release-stats.csv");
}

main().catch(e => {
  console.error("실행 중 오류:", e);
  process.exit(1);
});