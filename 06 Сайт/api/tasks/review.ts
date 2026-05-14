import type { VercelRequest, VercelResponse } from "@vercel/node";

const repo = process.env.MEDS_GITHUB_REPO || "Ulyana19svlv/MedsDataBase";
const branch = process.env.MEDS_GITHUB_BRANCH || "main";
const token = process.env.MEDS_GITHUB_TOKEN;
const candidatesPath = "08 Задачи/task_candidates.json";
const tasksPath = "08 Задачи/tasks.json";

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
  if (!token) {
    throw new Error("MEDS_GITHUB_TOKEN is not configured.");
  }

  const response = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "User-Agent": "MedsDataBase-task-review",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload?.message || "GitHub API request failed.");
  }
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

function candidateStatus(record: JsonRecord) {
  return String(record.candidate_status || record.review_status || record.status || "needs_review");
}

function taskFromCandidate(candidate: JsonRecord) {
  const {
    candidate_id,
    candidate_status,
    review_status,
    reviewed_at,
    reviewed_by,
    review_comment,
    ...task
  } = candidate;

  return {
    ...task,
    id: task.id || `task-${task.dedupe_key || candidate_id}`,
    status: "open",
    source_agent: task.source_agent || "tasks-agent",
    approved_at: new Date().toISOString(),
  };
}

function normalizeAction(value: unknown) {
  const action = String(value || "").trim().toLowerCase();
  if (action === "approve" || action === "approved") return "approved";
  if (action === "reject" || action === "rejected") return "rejected";
  return "";
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return json(res, 405, { error: "Method not allowed." });
  }

  const candidateId = String(req.body?.candidateId || req.body?.candidate_id || "").trim();
  const action = normalizeAction(req.body?.action);

  if (!candidateId) {
    return json(res, 400, { error: "Не указан кандидат рекомендации." });
  }
  if (!action) {
    return json(res, 400, { error: "Нужно выбрать: сделать задачей или отклонить." });
  }

  try {
    const [{ current: candidatesCurrent, data: candidatesData }, { current: tasksCurrent, data: tasksData }] =
      await Promise.all([readGithubJson(candidatesPath), readGithubJson(tasksPath)]);

    const candidates = Array.isArray(candidatesData.records) ? candidatesData.records : [];
    const candidateIndex = candidates.findIndex((record: JsonRecord) => record.candidate_id === candidateId || record.id === candidateId);
    if (candidateIndex === -1) {
      return json(res, 404, { error: "Рекомендация уже не найдена. Обновите страницу." });
    }

    const now = new Date().toISOString();
    const candidate = candidates[candidateIndex];
    if (candidateStatus(candidate) !== "needs_review") {
      return json(res, 409, { error: "Эта рекомендация уже разобрана." });
    }

    const reviewedCandidate = {
      ...candidate,
      candidate_status: action,
      review_status: action,
      status: action,
      reviewed_at: now,
      reviewed_by: "site",
      updated_at: now,
    };
    candidates[candidateIndex] = reviewedCandidate;

    candidatesData.schema_version = candidatesData.schema_version || 1;
    candidatesData.updated_at = now;
    candidatesData.records = candidates;

    let taskRecord: JsonRecord | null = null;
    let taskCommit = "";

    if (action === "approved") {
      taskRecord = taskFromCandidate(reviewedCandidate);
      tasksData.schema_version = tasksData.schema_version || 1;
      tasksData.updated_at = now;
      tasksData.records = Array.isArray(tasksData.records) ? tasksData.records : [];
      tasksData.records = tasksData.records.filter((record: JsonRecord) => {
        if (taskRecord?.dedupe_key && record.dedupe_key === taskRecord.dedupe_key) return false;
        return record.id !== taskRecord?.id;
      });
      tasksData.records.push(taskRecord);

      const updatedTasks = await writeGithubJson(
        tasksPath,
        tasksCurrent.sha,
        tasksData,
        `Approve task recommendation: ${taskRecord.title || candidateId}`,
      );
      taskCommit = updatedTasks?.commit?.sha || "";
    }

    const updatedCandidates = await writeGithubJson(
      candidatesPath,
      candidatesCurrent.sha,
      candidatesData,
      `${action === "approved" ? "Approve" : "Reject"} task recommendation: ${candidate.title || candidateId}`,
    );

    return json(res, 200, {
      ok: true,
      action,
      candidate: reviewedCandidate,
      task: taskRecord,
      commit: updatedCandidates?.commit?.sha || taskCommit,
      taskCommit,
    });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : "Не удалось обновить рекомендацию.",
    });
  }
}
