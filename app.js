const STOP_WORDS = new Set([
  "the","a","an","and","or","but","if","then","else","when","at","by","for","from","in","into","of","on","onto","to","with","without",
  "is","are","was","were","be","been","being","this","that","these","those","it","its","as","about","over","under","after","before",
  "all","most","many","few","some","any","every","no","not","only","just","more","less","very","new","next","now"
]);

const SENSATIONAL_TERMS = [
  "share","forward","urgent","immediately","breaking","shocking","secret","banned","alert","warning","evacuate",
  "miracle","cure","guarantee","limited","free","cash","giveaway","click","register","verify","claim"
];

function isExtremeClaim(text) {
  const lower = text.toLowerCase();
  const patterns = [
    /earth (is )?ending/, /end of the world/, /world will end/, /doomsday/, /apocalypse/,
    /sun (will )?explode/, /planet (will )?end/, /meteor (will )?hit/, /asteroid (will )?hit/,
    /aliens (have )?landed/, /zombies/, /time traveler/, /cows? (are )?falling/, /rain of cows/,
    /everyone will die/, /mass extinction/, /global annihilation/
  ];
  return patterns.some(r => r.test(lower));
}
function isTimeSensitiveClaim(text) {
  const lower = text.toLowerCase();
  return /\b(president|prime minister|pm|chief minister|cm|governor|ceo|chairman|mayor|monarch|king|queen)\b/.test(lower);
}

function hasExplicitYear(text) {
  return /\b(19|20)\d{2}\b/.test(text);
}

function shouldDeferTimeSensitive(text) {
  return isTimeSensitiveClaim(text) && !hasExplicitYear(text);
}

function parseDate(value) {
  const d = new Date(value);
  return isNaN(d) ? null : d;
}

function consensusLatestDate(consensus) {
  let latest = 0;
  (consensus.reviews || []).forEach(r => {
    const d = parseDate(r.date);
    if (d && d.getTime() > latest) latest = d.getTime();
  });
  return latest ? new Date(latest) : null;
}

function isConsensusOutdated(consensus, maxAgeDays) {
  const latest = consensusLatestDate(consensus);
  if (!latest) return false;
  const ageDays = (Date.now() - latest.getTime()) / 86400000;
  return ageDays > maxAgeDays;
}

function detectPatterns(text) {
  const lower = text.toLowerCase();
  const patterns = [];
  const sensationalHits = SENSATIONAL_TERMS.filter(t => lower.includes(t));
  if (sensationalHits.length) patterns.push("Sensational or urgent wording");
  if (/[A-Z]{6,}/.test(text)) patterns.push("Excessive capital letters");
  if (/\b(all|every|always|never|guaranteed)\b/i.test(text)) patterns.push("Absolute or guaranteed claims");
  if (/\b(share|forward)\b/i.test(text)) patterns.push("Call-to-share behavior");
  if (/https?:\/\//i.test(text)) patterns.push("External links included");
  if (!/\b(source|report|official|statement|study)\b/i.test(text)) patterns.push("No clear source attribution");
  if (isExtremeClaim(text)) patterns.push("Extreme or implausible claim");
  return patterns;
}

function computeViralitySignals(text, patterns) {
  const lower = text.toLowerCase();
  const signals = [];
  const sensationalHits = SENSATIONAL_TERMS.filter(t => lower.includes(t));
  const hasCallToShare = /\b(share|forward)\b/i.test(text);
  const hasLinks = /https?:\/\//i.test(text);
  const hasCaps = /[A-Z]{6,}/.test(text);
  const hasNumbers = /\b\d{3,}\b/.test(text);
  const length = text.length;

  if (sensationalHits.length) signals.push("Urgent / sensational wording");
  if (hasCallToShare) signals.push("Call to share/forward");
  if (hasLinks) signals.push("External link present");
  if (hasCaps) signals.push("Excessive capital letters");
  if (hasNumbers) signals.push("Large numeric claim");
  if (!patterns.includes("No clear source attribution")) {
    signals.push("Source mentioned");
  } else {
    signals.push("No source cited");
  }

  let score = 20;
  score += Math.min(30, sensationalHits.length * 8);
  if (hasCallToShare) score += 18;
  if (hasLinks) score += 10;
  if (hasCaps) score += 10;
  if (hasNumbers) score += 8;
  if (length < 60) score += 6;
  if (length > 240) score -= 6;
  if (!patterns.includes("No clear source attribution")) score -= 8;
  score = Math.max(5, Math.min(95, score));

  let label = "Low";
  if (score >= 70) label = "High";
  else if (score >= 45) label = "Medium";

  return { score, label, signals };
}

function scoreFromHeuristics(patterns, length) {
  let score = 35;
  score += Math.min(55, patterns.length * 12);
  if (length < 40) score += 6;
  if (length > 240) score -= 4;
  return Math.max(5, Math.min(90, score));
}

function calibrateScore(score) {
  const s = Math.max(0, Math.min(100, score));
  const adjusted = Math.round(Math.pow(s / 100, 1.15) * 100);
  return Math.max(8, Math.min(95, adjusted));
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function renderDial(score, label) {
  const dial = document.querySelector("#dial");
  const value = document.querySelector("#dial-value");
  const tag = document.querySelector("#dial-label");
  dial.style.setProperty("--dial", `${score}%`);
  value.textContent = formatPercent(score);
  tag.textContent = label;
}

function renderPatterns(patterns) {
  const list = document.querySelector("#pattern-list");
  list.innerHTML = "";
  if (!patterns.length) {
    const li = document.createElement("li");
    li.textContent = "No strong risk signals detected.";
    list.appendChild(li);
    return;
  }
  patterns.forEach(p => {
    const li = document.createElement("li");
    li.textContent = p;
    list.appendChild(li);
  });
}

function renderVirality(virality) {
  const meter = document.querySelector("#virality-score");
  const label = document.querySelector("#virality-label");
  const list = document.querySelector("#virality-signals");

  meter.style.width = `${virality.score}%`;
  label.textContent = `${virality.label} (${Math.round(virality.score)}%)`;
  list.innerHTML = "";
  virality.signals.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    list.appendChild(li);
  });
}

function renderGroqInsights(data) {
  const summary = document.querySelector("#groq-summary");
  const recommendation = document.querySelector("#groq-recommendation");
  const riskList = document.querySelector("#groq-risks");
  const phrases = document.querySelector("#groq-phrases");

  summary.textContent = data.summary || "";
  recommendation.textContent = data.recommendation || "";

  riskList.innerHTML = "";
  (data.risk_signals || []).forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    riskList.appendChild(li);
  });

  phrases.innerHTML = "";
  (data.suspicious_phrases || []).forEach(p => {
    const li = document.createElement("li");
    li.textContent = p;
    phrases.appendChild(li);
  });
}

function ratingClass(textualRating) {
  const t = (textualRating || "").toLowerCase();
  if (/(false|fake|hoax|incorrect|pants on fire|bogus)/.test(t)) return "false";
  if (/(misleading|half true|mostly false|partly false|mixture|mixed)/.test(t)) return "mixed";
  if (/(true|correct|accurate|verified)/.test(t)) return "true";
  return "other";
}

function computeConsensus(claims) {
  const counts = { true: 0, false: 0, mixed: 0, other: 0 };
  const reviews = [];
  claims.forEach(c => {
    (c.claimReview || []).forEach(r => {
      const bucket = ratingClass(r.textualRating);
      counts[bucket] += 1;
      reviews.push({
        claim: c.text,
        publisher: r.publisherName,
        rating: r.textualRating,
        title: r.title,
        url: r.url,
        date: r.reviewDate
      });
    });
  });

  const total = counts.true + counts.false + counts.mixed + counts.other;
  let consensus = "Unknown";
  if (total > 0) {
    if (counts.false >= Math.max(counts.true, counts.mixed)) consensus = "False";
    else if (counts.true >= Math.max(counts.false, counts.mixed)) consensus = "True";
    else consensus = "Mixed";
  }

  return { counts, total, consensus, reviews };
}

function scoreFromConsensus(consensus) {
  if (consensus === "False") return 95;
  if (consensus === "True") return 10;
  if (consensus === "Mixed") return 55;
  return null;
}

function renderConsensus(consensus) {
  const trueBar = document.querySelector("#consensus-true");
  const falseBar = document.querySelector("#consensus-false");
  const mixedBar = document.querySelector("#consensus-mixed");
  const label = document.querySelector("#consensus-label");

  const total = Math.max(1, consensus.total);
  trueBar.style.width = `${(consensus.counts.true / total) * 100}%`;
  falseBar.style.width = `${(consensus.counts.false / total) * 100}%`;
  mixedBar.style.width = `${(consensus.counts.mixed / total) * 100}%`;
  label.textContent = `Consensus: ${consensus.consensus}`;
}

function renderConsensusPlaceholder(message) {
  const trueBar = document.querySelector("#consensus-true");
  const falseBar = document.querySelector("#consensus-false");
  const mixedBar = document.querySelector("#consensus-mixed");
  const label = document.querySelector("#consensus-label");

  trueBar.style.width = "0%";
  falseBar.style.width = "0%";
  mixedBar.style.width = "0%";
  label.textContent = message;
}

function renderEvidence(reviews) {
  const list = document.querySelector("#evidence-list");
  list.innerHTML = "";
  if (!reviews.length) {
    const li = document.createElement("li");
    li.textContent = "No fact-check matches found.";
    list.appendChild(li);
    return;
  }

  reviews.slice(0, 6).forEach(r => {
    const li = document.createElement("li");
    li.innerHTML = `<strong>${r.title || "Fact check"}</strong><br><span class="muted">${r.publisher || ""} | ${r.rating || ""} | ${r.date || ""}</span><br>${r.claim || ""}`;
    list.appendChild(li);
  });
}

function renderEvidenceMessage(message) {
  const list = document.querySelector("#evidence-list");
  list.innerHTML = "";
  const li = document.createElement("li");
  li.textContent = message;
  list.appendChild(li);
}

async function fetchGroq(claim) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);

  try {
    const res = await fetch("/api/groq", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim }),
      signal: controller.signal
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Groq request failed");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchFactChecks(claim) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4000);

  try {
    const res = await fetch("/api/factcheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ claim }),
      signal: controller.signal
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Fact check request failed");
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

async function analyzeClaim() {
  const text = document.querySelector("#claim").value.trim();
  if (!text) return;

  const status = document.querySelector("#status");
  status.textContent = "Running instant analysis...";

  const patterns = detectPatterns(text);
  const virality = computeViralitySignals(text, patterns);
  const heuristicRaw = scoreFromHeuristics(patterns, text.length);
  const heuristicScore = calibrateScore(heuristicRaw);
  const heuristicLabel = heuristicScore >= 75 ? "Likely false" : "Needs verification";
  const extreme = isExtremeClaim(text);
  const timeSensitive = shouldDeferTimeSensitive(text);

  const baseScore = extreme ? 100 : heuristicScore;
  const baseLabel = extreme ? "Likely false" : heuristicLabel;

  renderDial(baseScore, baseLabel);
  renderPatterns(patterns);
  renderVirality(virality);

  const summaryEl = document.querySelector("#groq-summary");
  const recEl = document.querySelector("#groq-recommendation");

  if (timeSensitive && !extreme) {
    renderDial(Math.min(baseScore, 55), "Time-sensitive — verify date");
    summaryEl.textContent = "This claim depends on date/office holder. Add a date (e.g., 'as of 2026') or check official sources.";
    recEl.textContent = "Verify with official sources for the specific date.";
    renderConsensusPlaceholder("Consensus: Time-sensitive");
    renderEvidenceMessage("Provide a date to compare fact-checks accurately.");
  } else {
    summaryEl.textContent = "Groq analysis will refine this result.";
    recEl.textContent = "Check official sources before sharing.";
    renderConsensusPlaceholder("Consensus: Checking...");
    renderEvidenceMessage("Fetching fact-check evidence...");
  }

  status.textContent = "Groq analysis in progress...";

  try {
    const data = await fetchGroq(text);
    let score = typeof data.score === "number" ? calibrateScore(data.score) : baseScore;
    let label = data.label || baseLabel;

    if (extreme) {
      score = 100;
      label = "Likely false";
    }

    if (timeSensitive && !extreme) {
      score = Math.min(score, 60);
      label = "Time-sensitive — verify date";
    }

    renderDial(score, label);
    renderGroqInsights(data);

    if (timeSensitive && !extreme) {
      summaryEl.textContent = "This claim depends on date/office holder. Add a date (e.g., 'as of 2026') or check official sources.";
      recEl.textContent = "Verify with official sources for the specific date.";
    }

    status.textContent = "";
  } catch (err) {
    status.textContent = "Groq timed out. Showing instant analysis only.";
  }

  try {
    const fact = await fetchFactChecks(text);
    const consensus = computeConsensus(fact.claims || []);
    const outdated = isConsensusOutdated(consensus, 365);

    if (timeSensitive && !extreme) {
      renderConsensusPlaceholder("Consensus: Time-sensitive");
    } else if (outdated) {
      renderConsensusPlaceholder("Consensus: Possibly outdated");
    } else {
      renderConsensus(consensus);
    }

    renderEvidence(consensus.reviews || []);

    if (!timeSensitive && !outdated) {
      const consensusScore = scoreFromConsensus(consensus.consensus);
      if (consensusScore !== null) {
        renderDial(consensusScore, `Verified ${consensus.consensus}`);
      }
    }
  } catch (err) {
    renderConsensusPlaceholder("Consensus: Not available");
    renderEvidenceMessage("Fact-check lookup timed out.");
  }
}

document.querySelector("#analyze").addEventListener("click", analyzeClaim);





