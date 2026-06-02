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
