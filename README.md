# AI UX Research Copilot

Turns raw UX research material — interview transcripts, survey exports, feedback documents — into structured, reviewable insights.

**Live**: [add URL after deployment]
**Stack**: React · TypeScript · Vite · Node.js · Express · OpenAI

---

## Why this exists

Qualitative synthesis is the slowest part of UX research and the easiest part to do badly. Reading fifty interview transcripts to find recurring pain points takes days, and the result depends heavily on what the researcher happened to notice.

An LLM is good at the pattern-finding half of that job and bad at the judgement half. So this tool is built on one assumption: the model proposes, the researcher decides. Every design decision below follows from that.

## What it does

* Upload research documents (PDF, DOCX, plain text)
* Extract and structure raw text from mixed-format sources
* Generate thematic clusters, pain points, and opportunity areas
* Produce a structured research report from reviewed insights

---

## AI Interaction Design Decisions

This is the part of the project I care most about. Notes on what is built, what is planned, and why.

### Built

**Mock mode as a first-class path, not a debug flag**
When no API key is configured, the backend serves structured mock responses instead of failing. This started as a way to develop the front end without burning API credits, but it turned into something more useful: it forces every UI state to be reachable without depending on a live model. If a state can only be produced by a real API call, it tends not to get designed properly.
*Trade-off*: mock data can drift from real model output. It has to be updated whenever the prompt or schema changes, and that is manual today.

**Structured output over conversational output**
The LLM is not exposed as a chat interface. It returns a fixed schema — themes, pain points, opportunities — which the UI renders as reviewable objects. Why: a chat response is hard to review systematically. You cannot mark half a paragraph as "accepted" and half as "wrong". Structured output makes each claim individually reviewable, which is the whole point of the tool.
*Trade-off*: loses the flexibility of open-ended follow-up questions.

<!-- 补充你实际做过的其他决策，每条写：做了什么 / 为什么 / 取舍是什么 -->

### Planned

Ordered by how much they affect trust in the output.

1. **Streaming pipeline progress (SSE)**
   Analysis currently returns as a single response, so the user waits with no signal for as long as the model takes. Moving to server-sent events lets the UI show which stage the pipeline is in — extracting, chunking, analysing, clustering, synthesising — and surface partial results as they land.
   Why SSE over WebSocket: the data flows one way, server to client. SSE is native to HTTP, reconnects automatically, and needs no additional protocol handling.

2. **Schema validation with explicit degradation**
   LLM output will eventually fail to parse. Planned handling: validate against a Zod schema, retry once on failure, and if it fails again, show an explicit error state rather than passing malformed data to the UI. No silent partial rendering.

3. **Source attribution**
   Every generated insight should carry the passage it came from, expandable inline. An insight the researcher cannot trace back to a document is a claim, not a finding — and the interface should make that distinction visible rather than presenting all output with equal confidence.

4. **Differentiated failure states**
   "Something went wrong" tells the user nothing about whether to retry, change the file, or give up. Distinct states planned for: scanned PDFs with no extractable text, malformed model output, timeouts, and documents too short to support reliable analysis.

5. **Human-in-the-loop review**
   Each insight gets accept / edit / reject controls, and only accepted insights enter the final report. The UI shows review progress, so the researcher always knows how much of the output they have actually vetted. This is the feature the whole design rests on: it makes the researcher's judgement a required step rather than an optional one.

---

## Architecture Decisions & Trade-offs

**Express over Next.js**
The front end and back end are deployed separately, and the back end does file parsing and model orchestration that does not benefit from server-side rendering. Splitting them keeps the API independently deployable and testable.
*Trade-off*: two deployment targets, CORS configuration, and no shared types across the boundary without extra tooling.

**REST over GraphQL**
Three endpoints, one client, no over-fetching problem to solve. GraphQL would add a schema layer and resolver overhead for no benefit at this size.
*Revisit when*: the client needs to compose queries across many resources.

**TypeScript end to end**
The shape of LLM output is the least predictable part of the system, so the boundary where it enters the application is where types matter most. Typing it end to end means a schema change surfaces at compile time rather than as a runtime render error.

**Parsing on the server**
`pdf-parse` and `mammoth` run server-side rather than in the browser. Keeps the client light, keeps parsing behaviour consistent across browsers, and avoids shipping parser bundles to users who upload plain text.
*Trade-off*: every upload costs a round trip and server memory.

<!-- 部署完成后补一节：Deployment，写你实际遇到的问题和怎么解决的 -->

---

## Known limitations

* No test coverage yet — Playwright smoke tests are the next priority
* No rate limiting on the analyse endpoint; required before the public deployment is shared widely
* Mock fixtures are maintained by hand and can drift from real model output
* Single-user; no persistence between sessions

---

## Running locally

### Backend

```bash
cd backend
npm install
npm run dev          # http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

### Environment

Create `backend/.env`:

```env
OPENAI_API_KEY=your_key_here
PORT=3001
```

Without a key, the backend runs in mock mode.

---

## API

| Method | Endpoint       | Purpose                                          |
| ------ | -------------- | ------------------------------------------------- |
| POST   | `/api/upload`  | Accept and parse a research document              |
| POST   | `/api/analyze` | Run the analysis pipeline over extracted text      |
| POST   | `/api/report`  | Generate a structured report from reviewed insights |

---

## Architecture

```
Frontend (React + TypeScript + Vite)
    │  REST
    ▼
Backend (Node.js + Express)
    │
    ├── Document parsing      pdf-parse · mammoth · plain text
    ├── AI analysis layer     OpenAI · mock fallback
    └── Insight structuring   themes · pain points · opportunities
    │
    ▼
Structured insights → report
```

---

Built by [Kaylee Shao](portfolio)
