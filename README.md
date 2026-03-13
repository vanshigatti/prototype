# TruthLens Prototype (Groq Only)

A fast, judge-ready prototype that combines instant risk signals with Groq-powered reasoning.

## Run
1. Set the API key (PowerShell):
   - `setx GROQ_API_KEY "YOUR_KEY"`
   - Restart the terminal after running `setx`.
2. Start the server:
   - `node server.js`
3. Open the app:
   - `http://localhost:3000`

## What is included
- Misinformation likelihood dial
- Groq insight summary + recommendation
- Virality Radar (shareability risk)
- Risk signals + suspicious phrases

## Notes
- If Groq times out, the UI falls back to instant analysis.
