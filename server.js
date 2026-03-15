require("dotenv").config();

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

function send(res,status,body,type="application/json"){
res.writeHead(status,{
"Content-Type":type
});
res.end(body);
}

function safeJson(value){
try{
return JSON.parse(value);
}catch{
return null;
}
}

function extractJsonBlock(text){

if(!text) return null;

const first=text.indexOf("{");
const last=text.lastIndexOf("}");

if(first===-1 || last===-1) return null;

return text.slice(first,last+1);
}

/*
================================
VIRALITY RADAR
================================
*/

function calculateViralityScore(text){

const triggers = [
"breaking",
"urgent",
"share",
"forward",
"immediately",
"alert",
"emergency",
"before it is deleted",
"government hiding",
"they dont want you to know"
];

const lower = text.toLowerCase();

let score = 10;

triggers.forEach(word=>{
if(lower.includes(word)){
score += 15;
}
});

return Math.min(score,100);

}

/*
================================
GROQ PRIMARY ANALYSIS
================================
*/

async function analyzeWithGroq(claim){

if(!GROQ_API_KEY){
throw new Error("GROQ_API_KEY missing");
}

const prompt = `
Return ONLY valid JSON.

{
"label":"Likely false | Needs verification |",
"score":number(0-100),
"summary":"1-2 sentence explanation",
"risk_signals":[],
"suspicious_phrases":[],
"recommendation":"one sentence advice"
}

Claim:
${claim}
`;

const body = {

model:"llama-3.1-8b-instant",

messages:[
{role:"user",content:prompt}
],

temperature:0.2,
max_tokens:220

};

const resp = await fetch(
"https://api.groq.com/openai/v1/chat/completions",
{
method:"POST",

headers:{
"Content-Type":"application/json",
"Authorization":`Bearer ${GROQ_API_KEY}`
},

body:JSON.stringify(body)

});

const data = await resp.json();

if(!resp.ok){
throw new Error(data?.error?.message || "Groq request failed");
}

const text = data?.choices?.[0]?.message?.content || "";

let parsed = safeJson(text);

if(!parsed){

const block = extractJsonBlock(text);

if(block) parsed = safeJson(block);

}

if(!parsed){

return {

label:"Needs verification",
score:55,
summary:"Model response could not be parsed.",
risk_signals:["AI output formatting issue"],
suspicious_phrases:[],
recommendation:"Check trusted sources."

};

}

return parsed;

}

/*
================================
FACT CHECK SECONDARY VERIFICATION
================================
*/

async function fetchFactChecks(query){

if(!FACTCHECK_API_KEY){
return [];
}

const params = new URLSearchParams({

query,
languageCode:"en",
pageSize:"3",
key:FACTCHECK_API_KEY

});

const resp = await fetch(
`https://factchecktools.googleapis.com/v1alpha1/claims:search?${params}`
);

const data = await resp.json();

if(!resp.ok){
return [];
}

const claims = data?.claims || [];

return claims.map(c=>({

text:c.text,
claimant:c.claimant,

claimReview:(c.claimReview || []).map(r=>({

publisherName:r.publisher?.name || "",
title:r.title || "",
url:r.url || "",
textualRating:r.textualRating || "",
reviewDate:r.reviewDate || ""

}))

}));

}

/*
================================
SERVER ROUTES
================================
*/

const server = http.createServer(async (req,res)=>{

const parsedUrl = url.parse(req.url,true);

/*
GROQ API
*/

if(req.method==="POST" && parsedUrl.pathname==="/api/groq"){

let body="";

req.on("data",chunk=>{
body+=chunk;
});

req.on("end",async()=>{

const data = safeJson(body) || {};

const claim=(data.claim || "").trim();

if(!claim){
return send(res,400,JSON.stringify({
error:"Claim required"
}));
}

try{

const result = await analyzeWithGroq(claim);

/*
ADD VIRALITY RADAR
*/

const virality = calculateViralityScore(claim);

result.virality_score = virality;

return send(res,200,JSON.stringify(result));

}catch(err){

return send(res,500,JSON.stringify({
error:err.message
}));

}

});

return;

}

/*
FACT CHECK API
*/

if(req.method==="POST" && parsedUrl.pathname==="/api/factcheck"){

let body="";

req.on("data",chunk=>{
body+=chunk;
});

req.on("end",async()=>{

const data=safeJson(body) || {};

const claim=(data.claim || "").trim();

if(!claim){
return send(res,400,JSON.stringify({
error:"Claim required"
}));
}

try{

const claims = await fetchFactChecks(claim);

return send(res,200,JSON.stringify({claims}));

}catch(err){

return send(res,500,JSON.stringify({
error:err.message
}));

}

});

return;

}

/*
STATIC FILE SERVER
*/

const filePath =
parsedUrl.pathname === "/"
? "/index.html"
: parsedUrl.pathname;

const fullPath = path.join(__dirname,filePath);

fs.readFile(fullPath,(err,data)=>{

if(err){

send(res,404,"Not Found","text/plain");
return;

}

const ext = path.extname(fullPath);

const type = MIME[ext] || "application/octet-stream";

send(res,200,data,type);

});

});

server.listen(PORT,()=>{

console.log(`Server running at http://localhost:${PORT}`);

});