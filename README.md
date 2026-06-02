# AI UX Research Copilot

An AI-powered full-stack platform that assists UX researchers in analyzing user feedback, generating insights, and producing structured research reports.

---

## 🚀 Overview

AI UX Research Copilot is a full-stack application designed to streamline UX research workflows. It enables users to upload documents, extract insights using AI, and generate structured reports for product and design decision-making.

The system consists of:

* **Frontend**: Modern React + TypeScript UI (Vite)
* **Backend**: Node.js + Express API service
* **AI Layer**: OpenAI-powered analysis engine (supports mock mode for development)

---

## ✨ Key Features

* 📄 Upload UX research documents (PDF, text, etc.)
* 🧠 AI-powered analysis of user feedback
* 📊 Structured insight generation (themes, pain points, opportunities)
* 📝 Auto-generated UX research reports
* ⚡ Fast development mode with mock AI fallback
* 🔌 RESTful API architecture

---

## 🧱 Tech Stack

### Frontend

* React
* TypeScript
* Vite
* Axios

### Backend

* Node.js
* Express
* TypeScript
* Multer (file uploads)
* OpenAI SDK

### AI / Processing

* OpenAI GPT models
* PDF parsing (`pdf-parse`)
* Document extraction (`mammoth`)

---

## 📁 Project Structure

```
ai-ux-research-copilot/
│
├── backend/
│   ├── src/
│   ├── package.json
│   └── dist/
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   ├── api/
│   │   └── components/
│   ├── package.json
│   └── vite.config.ts
│
└── README.md
```

---

## ⚙️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/ai-ux-research-copilot.git
cd ai-ux-research-copilot
```

---

### 2. Install dependencies

#### Backend

```bash
cd backend
npm install
```

#### Frontend

```bash
cd ../frontend
npm install
```

---

### 3. Run development servers

#### Backend

```bash
cd backend
npm run dev
```

Server runs at:

```
http://localhost:3001
```

#### Frontend

```bash
cd frontend
npm run dev
```

Frontend runs at:

```
http://localhost:5173
```

---

## 🔑 Environment Variables

Create a `.env` file in the `backend` directory:

```env
OPENAI_API_KEY=your_api_key_here
PORT=3001
```

If no API key is provided, the system will run in **Mock AI mode**.

---

## 🧪 Development Mode

When no OpenAI key is configured, the backend automatically switches to:

```
Mock AI Mode
```

This allows full frontend-backend testing without API costs.

---

## 📦 API Endpoints

### Upload file

```
POST /api/upload
```

### Analyze document

```
POST /api/analyze
```

### Generate report

```
POST /api/report
```

---

## 🛠️ Future Improvements

* Real-time collaborative UX research workspace
* Vector database integration (Pinecone / Weaviate)
* Advanced clustering of user feedback
* Export to Notion / Figma / Google Docs
* Authentication system

---

## 👨‍💻 Author

Built by **kaylee lujie**

---

## 📄 License

This project is for educational and portfolio purposes.

## 🧠 AI Workflow Architecture
                ┌────────────────────────┐
                │      Frontend (React)  │
                │  - Upload UX files     │
                │  - View insights       │
                │  - Generate reports    │
                └──────────┬─────────────┘
                           │
                           │ REST API (Axios)
                           ▼
        ┌────────────────────────────────────┐
        │        Backend (Node.js)          │
        │  Express API Layer                │
        │  - /upload                       │
        │  - /analyze                      │
        │  - /report                       │
        └──────────┬────────────────────────┘
                   │
                   │ File Processing Pipeline
                   ▼
     ┌──────────────────────────────────────┐
     │     Document Processing Layer        │
     │  - PDF Parser (pdf-parse)           │
     │  - DOCX Parser (mammoth)            │
     │  - Text Extraction                  │
     └──────────┬──────────────────────────┘
                │
                ▼
     ┌──────────────────────────────────────┐
     │        AI Analysis Layer             │
     │  - OpenAI GPT (or Mock Mode)        │
     │  - Thematic Analysis                │
     │  - Pain Point Extraction            │
     │  - Insight Generation               │
     └──────────┬──────────────────────────┘
                │
                ▼
     ┌──────────────────────────────────────┐
     │     Insight Structuring Layer       │
     │  - UX Themes                        │
     │  - Opportunity Mapping              │
     │  - Summary Generation               │
     └──────────┬──────────────────────────┘
                │
                ▼
        ┌────────────────────────┐
        │   Structured Output     │
        │  - Insights JSON        │
        │  - UX Report            │
        └────────────────────────┘



# 💼 Project Highlights (Portfolio Ready)
This project demonstrates a real-world AI product workflow, combining document processing, AI-driven analysis, and structured UX insight generation.

---

### 🎯 Problem Statement
UX researchers spend significant time manually analyzing qualitative user feedback from interviews, surveys, and research reports.

### 💡 Solution: AI UX Research Copilot
The **AI UX Research Copilot** automates this workflow by:
* **Extracting** raw insights from UX documents.
* **Identifying** patterns and pain points using AI.
* **Generating** structured UX research outputs.
* **Reducing** manual analysis time from hours to minutes.

---

### ⚙️ System Design Thinking
This project demonstrates advanced engineering principles across the technical stack:
* **Full-stack architecture design** – Scalable structure built for real-world reliability.
* **AI pipeline integration** – Orchestrating document content seamlessly with generative models.
* **Document ingestion & parsing system** – Secure, efficient parsing of unstructured text.
* **Structured data generation** – Advanced LLM output shaping to ensure predictable schema formats.
* **Fallback strategy** – Automated Mock AI mode for offline stability and offline development.

---

### 🧠 AI Design Approach
Instead of using AI as a simple conversational chatbot, this system treats the LLM as a highly sophisticated **Structured Insight Engine**. It actively executes:
* 🧩 **Thematic clustering** of open-ended feedback.
* 📊 **Sentiment + pain point** detection.
* 🚀 **Opportunity identification** for product feature mapping.
* 📝 **UX report synthesis** tailored to stakeholders.

---

### 🔥 Engineering Highlights
* **Modular Backend API Design** – Built using a scalable architecture that isolates responsibilities.
* **Multi-Format Document Support** – Native processing capability for PDF, DOCX, and raw text files.
* **AI Fallback Mode** – Ensures resilience and local reliability during offline testing or API service limits.
* **Separation of Concerns** – Clear, maintainable boundaries between the core business logic and the AI orchestration layer.
* **TypeScript-Based Safety** – Full-stack type safety ensuring predictability from data ingestion to UI display.
