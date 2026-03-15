const FACTCHECK_API_KEY = "xxxxxxxxxxxxxxxx";

const SENSATIONAL_TERMS = [
"share","forward","urgent","breaking","shocking","secret","banned",
"alert","warning","evacuate","miracle","cure","guarantee",
"free","cash","giveaway","click","register","verify"
];

function detectPatterns(text){

const lower = text.toLowerCase();
const patterns = [];

if (SENSATIONAL_TERMS.some(t=>lower.includes(t)))
patterns.push("Sensational wording");

if (/[A-Z]{6,}/.test(text))
patterns.push("Excessive capital letters");

if (/\b(all|every|always|never|guaranteed)\b/i.test(text))
patterns.push("Absolute claim");

if (/https?:\/\//i.test(text))
patterns.push("External links present");

if (!/\b(source|report|official|study)\b/i.test(text))
patterns.push("No clear source cited");

return patterns;

}

function scoreFromHeuristics(patterns,length){

let score = 35;

score += patterns.length * 10;

if(length < 50) score += 5;
if(length > 200) score -= 5;

return Math.max(5,Math.min(90,score));

}

function calibrateScore(score){

return Math.round(Math.pow(score/100,1.15)*100);

}

function renderDial(score,label){

const dial = document.querySelector("#dial");
const value = document.querySelector("#dial-value");
const tag = document.querySelector("#dial-label");

dial.style.setProperty("--dial",`${score}`);
value.textContent = `${score}%`;
tag.textContent = label;

}

/*
VIRALITY RADAR RENDER
*/

function renderVirality(score){

const bar = document.querySelector("#virality-score");
const label = document.querySelector("#virality-label");

if(!bar) return;

const safeScore = Math.max(0,Math.min(100,score || 0));

bar.style.width = safeScore + "%";

if(label){

let level = "Low";

if(safeScore > 70) level = "High viral potential";
else if(safeScore > 40) level = "Moderate spread potential";

label.textContent = `${safeScore}% • ${level}`;

}

}

/*
VIRALITY SIGNALS
*/

function renderViralitySignals(text){

const list = document.querySelector("#virality-signals");

list.innerHTML="";

const triggers=[
"breaking",
"urgent",
"share",
"forward",
"alert",
"emergency"
];

triggers.forEach(t=>{

if(text.toLowerCase().includes(t)){

const li=document.createElement("li");
li.textContent=`Trigger word detected: "${t}"`;
list.appendChild(li);

}

});

if(!list.children.length){

const li=document.createElement("li");
li.textContent="No strong virality triggers detected.";
list.appendChild(li);

}

}

function renderPatterns(patterns){

const list = document.querySelector("#pattern-list");

list.innerHTML = "";

if(!patterns.length){

const li = document.createElement("li");
li.textContent = "No strong misinformation signals detected.";
list.appendChild(li);
return;

}

patterns.forEach(p=>{
const li = document.createElement("li");
li.textContent = p;
list.appendChild(li);
});

}

function renderGroqInsights(data){

document.querySelector("#groq-summary").textContent =
data.summary || "";

document.querySelector("#groq-recommendation").textContent =
data.recommendation || "";

const risks = document.querySelector("#groq-risks");
risks.innerHTML = "";

(data.risk_signals || []).forEach(r=>{
const li = document.createElement("li");
li.textContent = r;
risks.appendChild(li);
});

/*
SUSPICIOUS PHRASES
*/

const phrases = document.querySelector("#groq-phrases");

phrases.innerHTML="";

(data.suspicious_phrases || []).forEach(p=>{
const li=document.createElement("li");
li.textContent=p;
phrases.appendChild(li);
});

}

function renderEvidence(reviews){

const list = document.querySelector("#evidence-list");

list.innerHTML="";

if(!reviews.length){

const li=document.createElement("li");
li.textContent="No fact-check matches found.";
list.appendChild(li);
return;

}

reviews.slice(0,6).forEach(r=>{

const li=document.createElement("li");

li.innerHTML=`
<strong>${r.title || "Fact Check"}</strong><br>
${r.publisher || ""} | ${r.rating || ""}<br>
${r.claim || ""}
`;

list.appendChild(li);

});

}

function renderConsensus(consensus){

const label=document.querySelector("#consensus-label");

label.textContent=`Consensus: ${consensus.consensus}`;

}

function ratingClass(r){

const t=(r||"").toLowerCase();

if(/false|fake|hoax/.test(t)) return "false";
if(/misleading|mixed/.test(t)) return "mixed";
if(/true|correct/.test(t)) return "true";

return "other";

}

function computeConsensus(claims){

const counts={true:0,false:0,mixed:0,other:0};
const reviews=[];

claims.forEach(c=>{

(c.claimReview || []).forEach(r=>{

const bucket=ratingClass(r.textualRating);

counts[bucket]++;

reviews.push({
claim:c.text,
publisher:r.publisher?.name,
rating:r.textualRating,
title:r.title,
url:r.url
});

});

});

const total = counts.true+counts.false+counts.mixed;

let consensus="Unknown";

if(total>0){

if(counts.false>=counts.true && counts.false>=counts.mixed)
consensus="False";

else if(counts.true>=counts.false && counts.true>=counts.mixed)
consensus="True";

else
consensus="Mixed";

}

return{consensus,reviews};

}

async function fetchGroq(claim){

const res = await fetch("/api/groq",{

method:"POST",
headers:{"Content-Type":"application/json"},
body:JSON.stringify({claim})

});

return res.json();

}

async function fetchFactChecks(claim){

const url =
`https://factchecktools.googleapis.com/v1alpha1/claims:search?query=${encodeURIComponent(claim)}&key=${FACTCHECK_API_KEY}`;

const res = await fetch(url);

return res.json();

}

async function analyzeClaim(){

const text=document.querySelector("#claim").value.trim();

if(!text) return;

const status=document.querySelector("#status");

status.textContent="Running analysis...";

const patterns=detectPatterns(text);

renderPatterns(patterns);

renderViralitySignals(text);

const heuristic=calibrateScore(
scoreFromHeuristics(patterns,text.length)
);

renderDial(heuristic,"Initial estimate");

try{

status.textContent="Running Groq reasoning...";

const groq=await fetchGroq(text);

/*
UPDATE VIRALITY RADAR
*/

renderVirality(groq.virality_score || 0);

let score =
typeof groq.score==="number"
? calibrateScore(groq.score)
: heuristic;

let label=groq.label || "AI analysis";

renderDial(score,label);

renderGroqInsights(groq);

status.textContent="Groq complete. Checking fact-check databases...";

}catch(e){

console.error(e);

status.textContent="Groq unavailable. Using heuristic result.";

}

/*
BACKGROUND FACT CHECK
*/

fetchFactChecks(text)
.then(data=>{

const consensus=computeConsensus(data.claims || []);

renderConsensus(consensus);

renderEvidence(consensus.reviews);

status.textContent="Verification complete";

})
.catch(()=>{

status.textContent="Fact-check sources unavailable";

});

}

document
.querySelector("#analyze")
.addEventListener("click",analyzeClaim);