import axios from "axios";
import { createObjectCsvWriter } from "csv-writer";
import { parseISO, getYear, getWeek, format } from "date-fns";

/** ================================
 * 1. 타입 선언
 * ================================ */
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

/** 구조화된 릴리즈 정보 */
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

/** ================================
 * 2. 릴리즈 데이터 fetch 함수
 * ================================ */
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

/** ================================
 * 3. 릴리즈 데이터 가공 함수
 * ================================ */
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

/** ================================
 * 4. 통계 정보 가공 함수 (예시)
 * ================================ */
function makeStats(releases: ReleaseInfo[]) {
  // 연, 주, 일 단위 배포수 (대시보드 차트용)
  const yearly: Record<string, number> = {};
  const weekly: Record<string, number> = {};
  const daily: Record<string, number> = {};
  releases.forEach(r => {
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

/** ================================
 * 5. CSV 저장 함수
 * ================================ */
async function saveReleasesCSV(releases: ReleaseInfo[], filename: string) {
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
  console.log(`>> 릴리즈 상세 CSV 파일 생성: ${filename}`);
}

/** ================================
 * 6. 메인 실행 로직
 * ================================ */
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

  // 릴리즈 상세 저장 (대시보드에 활용)
  await saveReleasesCSV(allReleaseInfo, "release-details.csv");

  // 통계 정보 예시 (별도 저장/대시보드)
  const stats = makeStats(allReleaseInfo);
  const statRecords: any[] = [];
  for (const [k, v] of Object.entries(stats.yearly)) {
    const [repo, period] = k.split("__");
    statRecords.push({ type: "Yearly", period, repo, count: v });
  }
  for (const [k, v] of Object.entries(stats.weekly)) {
    const [repo, period] = k.split("__");
    statRecords.push({ type: "Weekly", period, repo, count: v });
  }
  for (const [k, v] of Object.entries(stats.daily)) {
    const [repo, period] = k.split("__");
    statRecords.push({ type: "Daily", period, repo, count: v });
  }

  const statCsvWriter = createObjectCsvWriter({
    path: "release-stats.csv",
    header: [
      { id: "type", title: "Type" },
      { id: "period", title: "Period" },
      { id: "repo", title: "Repo" },
      { id: "count", title: "ReleaseCount" }
    ]
  });
  await statCsvWriter.writeRecords(statRecords);
  console.log(">> 릴리즈 통계 CSV 파일 생성: release-stats.csv");
}

// 스크립트 실행
main().catch(e => {
  console.error("메인 실행 중 오류:", e);
  process.exit(1);
});