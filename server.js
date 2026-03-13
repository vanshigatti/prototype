const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const FACTCHECK_API_KEY = process.env.FACTCHECK_API_KEY;

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json"
};

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { "Content-Type": type });
  res.end(body);
}

function safeJson(value) {
  try {
    return JSON.parse(value);
  } catch (err) {
    return null;
  }
}

function extractJsonBlock(text) {
  if (!text) return null;
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  return text.slice(first, last + 1);
}

async function analyzeWithGroq(claim) {
  if (!GROQ_API_KEY) {
    throw new Error("GROQ_API_KEY is not set");
  }

  const prompt = [
    "Return ONLY valid JSON with this schema:",
    "{",
    "  \"label\": \"Likely false\" | \"Needs verification\" | \"Likely true\",",
    "  \"score\": number (0-100, higher = more likely misinformation),",
    "  \"summary\": string (1-2 sentences),",
    "  \"risk_signals\": string[],",
    "  \"suspicious_phrases\": string[],",
    "  \"recommendation\": string (1 sentence)",
    "}",
    "If unsure, use 'Needs verification' and keep score between 40-65.",
    "Claim:",
    claim
  ].join("\n");

  const body = {
    model: "llama-3.1-8b-instant",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.2,
    max_tokens: 220
  };

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify(body)
  });

  const data = await resp.json();
  if (!resp.ok) {
    const message = data?.error?.message || "Groq request failed";
    throw new Error(message);
  }

  const text = data?.choices?.[0]?.message?.content || "";
  let parsed = safeJson(text);
  if (!parsed) {
    const block = extractJsonBlock(text);
    if (block) parsed = safeJson(block);
  }

  if (!parsed) {
    return {
      label: "Needs verification",
      score: 55,
      summary: "Model response could not be parsed. Using fallback.",
      risk_signals: ["Model output format issue"],
      suspicious_phrases: [],
      recommendation: "Check official sources before sharing."
    };
  }

  return parsed;
}

async function fetchFactChecks(query) {
  if (!FACTCHECK_API_KEY) {
    throw new Error("FACTCHECK_API_KEY is not set");
  }

  const params = new URLSearchParams({
    query,
    languageCode: "en",
    pageSize: "3",
    maxAgeDays: "30",
    key: FACTCHECK_API_KEY
  });

  const resp = await fetch(`https://factchecktools.googleapis.com/v1alpha1/claims:search?${params.toString()}`);
  const data = await resp.json();

  if (!resp.ok) {
    const message = data?.error?.message || data?.error || "Fact Check API request failed";
    throw new Error(message);
  }

  const claims = Array.isArray(data?.claims) ? data.claims : [];

  return claims.map(c => ({
    text: c.text,
    claimant: c.claimant,
    claimDate: c.claimDate,
    claimReview: (c.claimReview || []).map(r => ({
      publisherName: r.publisher?.name || "",
      publisherSite: r.publisher?.site || "",
      title: r.title || "",
      url: r.url || "",
      textualRating: r.textualRating || "",
      reviewDate: r.reviewDate || ""
    }))
  }));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);

  if (req.method === "POST" && parsedUrl.pathname === "/api/groq") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      const data = safeJson(body) || {};
      const claim = (data.claim || "").toString().trim();
      if (!claim) {
        return send(res, 400, JSON.stringify({ error: "Claim is required." }));
      }

      try {
        const result = await analyzeWithGroq(claim);
        return send(res, 200, JSON.stringify(result));
      } catch (err) {
        return send(res, 500, JSON.stringify({ error: err.message || "Groq request failed." }));
      }
    });
    return;
  }

  if (req.method === "POST" && parsedUrl.pathname === "/api/factcheck") {
    let body = "";
    req.on("data", chunk => { body += chunk; });
    req.on("end", async () => {
      const data = safeJson(body) || {};
      const claim = (data.claim || "").toString().trim();
      if (!claim) {
        return send(res, 400, JSON.stringify({ error: "Claim is required." }));
      }

      try {
        const claims = await fetchFactChecks(claim);
        return send(res, 200, JSON.stringify({ claims }));
      } catch (err) {
        return send(res, 500, JSON.stringify({ error: err.message || "Fact check request failed." }));
      }
    });
    return;
  }

  const filePath = parsedUrl.pathname === "/" ? "/index.html" : parsedUrl.pathname;
  const fullPath = path.join(__dirname, filePath);

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      send(res, 404, "Not Found", "text/plain");
      return;
    }
    const ext = path.extname(fullPath);
    const type = MIME[ext] || "application/octet-stream";
    send(res, 200, data, type);
  });
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
