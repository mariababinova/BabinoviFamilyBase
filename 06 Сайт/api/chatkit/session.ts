import type { VercelRequest, VercelResponse } from "@vercel/node";

const openaiApiKey = process.env.OPENAI_API_KEY;
const workflowId = process.env.OPENAI_CHATKIT_WORKFLOW_ID;
const allowedOrigin = process.env.CHATKIT_ALLOWED_ORIGIN || "*";

function setCors(res: VercelResponse) {
  res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!openaiApiKey || !workflowId) {
    return res.status(500).json({
      error: "Server is missing OPENAI_API_KEY or OPENAI_CHATKIT_WORKFLOW_ID.",
    });
  }

  const user =
    typeof req.body?.user === "string" && req.body.user.trim()
      ? req.body.user.trim().slice(0, 128)
      : `anonymous-${Date.now()}`;

  const response = await fetch("https://api.openai.com/v1/chatkit/sessions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "OpenAI-Beta": "chatkit_beta=v1",
      Authorization: `Bearer ${openaiApiKey}`,
    },
    body: JSON.stringify({
      workflow: {
        id: workflowId,
        state_variables: {
          safety_mode: "read_only_medical_records_no_diagnosis",
        },
      },
      user,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    return res.status(response.status).json({
      error: payload?.error?.message || "Failed to create ChatKit session.",
    });
  }

  return res.status(200).json({ client_secret: payload.client_secret });
}
