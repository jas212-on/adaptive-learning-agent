# 🎓 Adaptive Learning Agent

An AI-powered adaptive learning system that detects what you're studying in real-time and creates personalized learning paths, quizzes, explanations, and study schedules.

![Python](https://img.shields.io/badge/Python-3.10+-blue.svg)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-green.svg)
![React](https://img.shields.io/badge/React-18.2+-61DAFB.svg)
![Gemini](https://img.shields.io/badge/Gemini-AI-orange.svg)
![License](https://img.shields.io/badge/License-CC%20BY--NC%204.0-lightgrey.svg)

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [API Documentation](#-api-documentation)
- [Frontend Components](#-frontend-components)
- [Screenshots](#-screenshots)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Overview

The **Adaptive Learning Agent** is an intelligent study companion that:

1. **Detects Topics in Real-Time** - Uses OCR and screen capture to identify what you're studying
2. **Generates AI-Powered Content** - Creates explanations, quizzes, and learning resources using Google Gemini
3. **Builds Knowledge Graphs** - Visualizes concept relationships and learning dependencies
4. **Creates Smart Timetables** - Generates optimized study schedules based on deadlines and confidence levels
5. **Tracks Progress** - Uses Bayesian Knowledge Tracing (BKT) to adapt to your learning state

---

## ✨ Features

### 🔍 Real-Time Topic Detection
- Screen capture and OCR using Tesseract
- AI-powered topic identification from detected text
- Supports multiple windows: VS Code, browsers, PDFs, PowerPoint, Word

### 🧠 AI-Powered Learning
- **Explainers**: Structured explanations with prerequisites, key ideas, and common pitfalls
- **Quizzes**: Auto-generated MCQ quizzes with immediate feedback
- **Resources**: Curated learning resources via web search

### 📊 Knowledge Visualization
- Interactive dependency graphs using React Flow
- Hierarchical concept visualization
- Progress tracking per topic/subtopic

### 📅 Smart Scheduling
- Constraint-based timetable generation
- Priority scoring based on deadlines, difficulty, and confidence
- Buffer time allocation for unexpected events

### 🎯 Adaptive Learning
- Bayesian Knowledge Tracing for mastery estimation
- Confidence score updates based on quiz performance
- Personalized learning path recommendations

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (React)                         │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │  Detection  │ │  Dashboard  │ │  Timetable  │ │  Learning │ │
│  │    Page     │ │    Home     │ │   Planner   │ │    Mode   │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ REST API
┌────────────────────────────▼────────────────────────────────────┐
│                      Backend (FastAPI)                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌───────────┐ │
│  │   OCR &     │ │   Quiz      │ │   Graph     │ │ Timetable │ │
│  │  Detection  │ │  Generator  │ │   Builder   │ │ Scheduler │ │
│  └─────────────┘ └─────────────┘ └─────────────┘ └───────────┘ │
│                             │                                   │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │                    Gemini AI (LLM)                          ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| **FastAPI** | REST API framework |
| **Pydantic** | Data validation and schemas |
| **Google Gemini** | AI content generation (gemini-2.5-flash) |
| **Tesseract OCR** | Text extraction from screen captures |
| **OpenCV** | Image processing |
| **MSS** | Cross-platform screen capture |
| **PyWin32** | Windows window management |

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **React Router v7** | Client-side routing |
| **Vite** | Build tool and dev server |
| **Tailwind CSS** | Utility-first styling |
| **React Flow** | Dependency graph visualization |
| **Radix UI** | Accessible UI components |
| **GSAP** | Animations |
| **Lucide React** | Icon library |
| **React Three Fiber** | 3D graphics (decorative elements) |

---

## 📁 Project Structure

```
adaptive-learning-agent/
├── backend/
│   ├── server.py              # Main FastAPI application
│   ├── ocr.py                 # Screen capture & OCR logic
│   ├── quizz.py               # Quiz generation & BKT scoring
│   ├── schemas.py             # Pydantic request/response models
│   ├── requirements.txt       # Python dependencies
│   │
│   ├── llm/
│   │   └── gemini.py          # Gemini AI wrapper
│   │
│   ├── graph/
│   │   ├── builder.py         # Concept graph construction
│   │   └── models.py          # Graph node/edge data models
│   │
│   ├── timetable/
│   │   ├── routes.py          # Timetable API endpoints
│   │   ├── scheduler.py       # Core scheduling algorithm
│   │   ├── scoring.py         # Urgency/priority scoring
│   │   ├── models.py          # Timetable data models
│   │   ├── utils.py           # Date/time utilities
│   │   └── validate.py        # Input validation
│   │
│   ├── quiz_cache/            # Cached quiz questions per topic
│   └── captures/              # Screen capture storage
│
├── frontend/
│   ├── index.html             # Entry HTML
│   ├── package.json           # Node dependencies
│   ├── vite.config.js         # Vite configuration
│   ├── tailwind.config.js     # Tailwind configuration
│   │
│   └── src/
│       ├── main.jsx           # React entry point
│       ├── App.jsx            # Root component & routes
│       │
│       ├── components/
│       │   ├── ProtectedRoute.jsx    # Auth guard
│       │   ├── ThemeToggle.jsx       # Dark/light mode
│       │   └── ui/                   # Reusable UI components
│       │       ├── Button.jsx
│       │       ├── Card.jsx
│       │       ├── Input.jsx
│       │       ├── Badge.jsx
│       │       ├── Tabs.jsx
│       │       ├── Tooltip.jsx
│       │       ├── Accordion.jsx
│       │       ├── Spinner.jsx
│       │       └── ...
│       │
│       ├── pages/
│       │   ├── Home.jsx              # Landing page
│       │   ├── Login.jsx             # Authentication
│       │   ├── Signup.jsx            # Registration
│       │   ├── Detection.jsx         # Real-time detection UI
│       │   │
│       │   └── dashboard/
│       │       ├── DashboardHome.jsx      # Dashboard overview
│       │       ├── TopicsIndex.jsx        # All detected topics
│       │       ├── TopicDetails.jsx       # Single topic view
│       │       ├── DependencyGraph.jsx    # Knowledge graph
│       │       ├── Timetable.jsx          # Study scheduler
│       │       ├── Analytics.jsx          # Learning analytics
│       │       ├── LearningMode.jsx       # Focused learning
│       │       │
│       │       └── topic/
│       │           ├── Explainer.jsx      # AI explanations
│       │           ├── Quiz.jsx           # Interactive quizzes
│       │           ├── Resources.jsx      # Learning resources
│       │           └── RoadmapModule.jsx  # Learning roadmap
│       │
│       ├── features/
│       │   ├── detector/
│       │   │   └── DetectorContext.jsx   # Detection state management
│       │   └── roadmap/
│       │       └── progress.js           # Progress tracking utils
│       │
│       ├── providers/
│       │   ├── AuthProvider.jsx          # Authentication context
│       │   └── ThemeProvider.jsx         # Theme context
│       │
│       ├── services/
│       │   └── api.js                    # API client & mock data
│       │
│       └── layouts/
│           ├── PublicLayout.jsx          # Public pages layout
│           └── DashboardLayout.jsx       # Dashboard layout
│
└── README.md
```

---

## 🚀 Installation

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **Tesseract OCR** (Windows: [Download here](https://github.com/UB-Mannheim/tesseract/wiki))
- **Google Gemini API Key**

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install
```

---

## ⚙️ Configuration

### 1. Environment Variables

Create a `.env` file in the `backend/` directory:

```env
# Gemini API Key (required)
GOOGLE_API_KEY=your_gemini_api_key_here
# OR
GEMINI_API_KEY=your_gemini_api_key_here

# Optional: SerpAPI for resource search
SERPAPI_KEY=your_serpapi_key_here
```

### 2. Tesseract Path (Windows)

Ensure Tesseract is installed and the path is correct in `backend/ocr.py`:

```python
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
```

### 3. Frontend API URL

Create a `.env` file in the `frontend/` directory:

```env
VITE_API_BASE_URL=http://localhost:8000
```

---

## 🎮 Usage

### Start the Backend Server

```bash
cd backend
uvicorn server:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Start the Frontend Development Server

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Using the Application

1. **Sign Up/Login** - Create an account or use demo credentials
2. **Start Detection** - Click "Start Detection" to begin real-time topic detection
3. **View Dashboard** - Explore detected topics in the dashboard
4. **Learn** - Use explainers, quizzes, and resources for each topic
5. **Track Progress** - View your knowledge graph and analytics
6. **Plan Studies** - Generate optimized study timetables

---

## 📚 API Documentation

### Core Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/detect` | POST | Detect topic from text |
| `/topics` | GET | List all detected topics |
| `/topics/{id}` | GET | Get topic details |
| `/topics/{id}/explainer` | GET | Generate AI explanation |
| `/topics/{id}/quiz` | GET | Generate quiz questions |
| `/topics/{id}/quiz/submit` | POST | Submit quiz answers |
| `/topics/{id}/graph` | GET | Get concept graph |
| `/resources` | GET | Search learning resources |

### Timetable Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/timetable/generate` | POST | Generate study timetable |
| `/timetable/missed` | POST | Handle missed session |
| `/timetable/confidence` | PUT | Update topic confidence |

### Request/Response Examples

#### Detect Topic
```bash
POST /detect
{
  "text": "useEffect(() => { ... }, [userId])",
  "title": "VS Code - React Tutorial"
}
```

#### Generate Timetable
```bash
POST /timetable/generate
{
  "events": [
    {
      "event_type": "exam",
      "subject": "Mathematics",
      "topic": "Calculus",
      "target_date": "2024-02-15",
      "priority_level": 9,
      "estimated_effort_hours": 10
    }
  ],
  "availability": {
    "weekday_hours": 4,
    "weekend_hours": 6
  },
  "preferences": {
    "session_length_minutes": 45,
    "max_sessions_per_day": 6
  }
}
```

### Interactive API Docs

Visit `http://localhost:8000/docs` for Swagger UI documentation.

---

## 🎨 Frontend Components

### Pages

| Page | Route | Description |
|------|-------|-------------|
| Home | `/` | Landing page with features overview |
| Login | `/login` | User authentication |
| Detection | `/detection` | Real-time topic detection |
| Dashboard | `/dashboard` | Main dashboard home |
| Topics | `/dashboard/topics` | All detected topics |
| Topic Details | `/dashboard/topics/:id` | Single topic with learning modules |
| Dependency Graph | `/dashboard/dependency-graph` | Interactive knowledge graph |
| Timetable | `/dashboard/timetable` | Study schedule generator |
| Learning Mode | `/learn/:topicId` | Focused learning experience |

### UI Components

- **Card** - Container with header and content sections
- **Button** - Styled buttons with variants
- **Badge** - Status and category indicators
- **Tabs** - Tab navigation component
- **Accordion** - Collapsible content sections
- **Tooltip** - Hover information tooltips
- **Spinner** - Loading indicator
- **Input** - Form input fields

---

## 🖼️ Screenshots

### Detection Page
Real-time screen capture and topic detection interface.

### Dashboard
Overview of detected topics with confidence scores and learning progress.

### Dependency Graph
Interactive visualization of concept relationships.

### Learning Mode
Focused learning experience with explainers, quizzes, and resources.

### Timetable
AI-generated study schedule based on deadlines and priorities.

---

## 🔧 Development

### Running Tests

```bash
# Backend tests
cd backend
python -m pytest

# Frontend tests
cd frontend
npm run test
```

### Building for Production

```bash
# Frontend build
cd frontend
npm run build
```

### Code Style

- **Backend**: Follow PEP 8 guidelines
- **Frontend**: ESLint configuration included

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **Creative Commons Attribution-NonCommercial 4.0 International License (CC BY-NC 4.0)**.

You are free to:
- **Share** — copy and redistribute the material in any medium or format
- **Adapt** — remix, transform, and build upon the material

Under the following terms:
- **Attribution** — You must give appropriate credit, provide a link to the license, and indicate if changes were made
- **NonCommercial** — You may not use the material for commercial purposes

See the [LICENSE](LICENSE) file or visit [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/) for details.

---

## 🙏 Acknowledgments

- [Google Gemini](https://ai.google.dev/) for AI capabilities
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [React](https://react.dev/) for the frontend framework
- [Tesseract OCR](https://github.com/tesseract-ocr/tesseract) for text recognition
- [React Flow](https://reactflow.dev/) for graph visualization

---

## 📧 Contact

For questions or support, please open an issue on GitHub.

---

<p align="center">
  Made with ❤️ for learners everywhere
</p>
