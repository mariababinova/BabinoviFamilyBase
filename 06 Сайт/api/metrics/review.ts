import type { VercelRequest, VercelResponse } from "@vercel/node";

const repo = process.env.MEDS_GITHUB_REPO || "Ulyana19svlv/MedsDataBase";
const branch = process.env.MEDS_GITHUB_BRANCH || "main";
const token = process.env.MEDS_GITHUB_TOKEN;
const candidatesPath = "07 Показатели/metric_candidates.json";

type JsonRecord = Record<string, any>;

function json(res: VercelResponse, status: number, body: unknown) {
  res.setHeader("Cache-Control", "no-store");
  return res.status(status).json(body);
}

function contentsUrl(filePath: string) {
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  return `https://api.github.com/repos/${repo}/contents/${encodedPath}`;
}

async function githubJson(url: string, init: RequestInit = {}) {
  if (!token) throw new Error("MEDS_GITHUB_TOKEN is not configured.");
  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "MedsDataBase-metric-review",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.message || "GitHub API request failed.");
  return payload;
}

async function readGithubJson(filePath: string) {
  const current = await githubJson(`${contentsUrl(filePath)}?ref=${encodeURIComponent(branch)}`);
  const data = JSON.parse(Buffer.from(current.content, "base64").toString("utf8").replace(/^\uFEFF/, ""));
  return { current, data };
}

async function writeGithubJson(filePath: string, sha: string, data: unknown, message: string) {
  return githubJson(contentsUrl(filePath), {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(`${JSON.stringify(data, null, 2)}\n`, "utf8").toString("base64"),
      sha,
      branch,
    }),
  });
}

function normalizeAction(value: unknown) {
  const action = String(value || "").trim().toLowerCase();
  if (action === "approve" || action === "approved") return "approved";
  if (action === "reject" || action === "rejected") return "rejected";
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed." });

  const candidateId = String(req.body?.candidateId || req.body?.candidate_id || "").trim();
  const action = normalizeAction(req.body?.action);
  const reviewComment = String(req.body?.reviewComment || req.body?.review_comment || "").trim();

  if (!candidateId) return json(res, 400, { error: "Не указан кандидат показателя." });
  if (!action) return json(res, 400, { error: "Нужно выбрать: подтвердить или отклонить." });

  try {
    const { current, data } = await readGithubJson(candidatesPath);
    const candidates = Array.isArray(data.candidates) ? data.candidates : [];
    const candidateIndex = candidates.findIndex((record: JsonRecord) => record.id === candidateId || record.dedupe_key === candidateId);
    if (candidateIndex === -1) return json(res, 404, { error: "Показатель уже не найден. Обновите страницу." });

    const candidate = candidates[candidateIndex];
    if (!["needs_review", "approved", "rejected"].includes(String(candidate.status || "needs_review"))) {
      return json(res, 409, { error: "Этот показатель уже импортирован или недоступен для изменения." });
    }

    const now = new Date().toISOString();
    const reviewedCandidate = {
      ...candidate,
      status: action,
      reviewed_at: now,
      reviewed_by: "site",
      review_comment: reviewComment || candidate.review_comment || "",
      updated_at: now,
    };
    candidates[candidateIndex] = reviewedCandidate;

    data.schema_version = data.schema_version || 1;
    data.updated_at = now;
    data.candidates = candidates;

    const updated = await writeGithubJson(
      candidatesPath,
      current.sha,
      data,
      `${action === "approved" ? "Approve" : "Reject"} metric candidate: ${candidate.metric_label || candidateId}`,
    );

    return json(res, 200, { ok: true, action, candidate: reviewedCandidate, commit: updated?.commit?.sha || "" });
  } catch (error) {
    return json(res, 500, { error: error instanceof Error ? error.message : "Не удалось обновить показатель." });
  }
}
