# SocraticAI

> The AI tutor that never gives you the answer.

---

### Live Application
Check out the live app here: [https://socratic-ai-seven.vercel.app](https://socratic-ai-seven.vercel.app)

---

## What is SocraticAI?

Most AI tutors dump answers. SocraticAI flips the model - it debates, challenges, and questions you until you arrive at the answer yourself. Paired with structured hint unlocking, rubric-based grading, and automatic mastery tracking, it's a full learning companion designed for college students.

---

## Features

### Socratic Debate
Pick a topic or enter your own question. The AI will never explain directly - it responds with counter-questions, deliberate misconceptions, and intellectual friction. Every exchange is analyzed for reasoning gaps in real time. End the session to see your accuracy score and a breakdown of weak points.

### Stepwise Hint System
Upload or type a question. The AI generates 3 progressive hints - a subtle nudge, a structural clue, and the full solution. Hints are locked behind an unlock system so you're forced to think before revealing the next level. In Exam Mode, the final solution is permanently withheld.

### Rubric-Based Feedback
Paste an essay, code snippet, or short answer. Choose from built-in rubrics (Essay, Code, Short Answer) or write your own. The AI grades each criterion individually, shows score breakdowns with progress bars, and lists specific strengths and improvements.

### Mastery Tracker
Automatically populated from your Socratic debate sessions. Tracks every concept discussed, calculates your confidence score per topic, and highlights weak areas. No manual input needed — it builds as you learn.

### InsightCanvas
An interactive whiteboard for visualizing complex problems. Use the canvas to draw relationships, brainstorm ideas, and receive real-time AI feedback on your thought process. It bridges the gap between abstract concepts and visual understanding.

### Integrity Mode
Switch between Learning Mode (full hints + solutions) and Exam Mode (hints only, no solution reveal). The mode applies globally across the Hint System and Socratic Debate - set it once before your session.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 (App Router) |
| UI | Custom CSS (Vanilla CSS & Tailwind) |
| Auth | Clerk & NextAuth (Legacy/Fallback) |
| Database | PostgreSQL (Neon/Local) & Neo4j (Graph) |
| ORM | Prisma 7 |
| Cache/Queue | Redis |
| AI | Groq API — llama-3.3-70b-versatile |

---

## Getting Started

### 1. Prerequisites
- Node.js 18+ — [nodejs.org](https://nodejs.org)
- Docker Desktop (for local DB/Graph/Redis) — [docker.com](https://www.docker.com/)
- Clerk Account (for Auth) — [clerk.com](https://clerk.com)
- Groq API key — [console.groq.com](https://console.groq.com)

### 2. Installation

```bash
# Clone the repository
git clone https://github.com/meghana-attili/SocraticAI.git
cd SocraticAI

# Install all dependencies
npm install
```

### 3. Environment Setup

Create a .env file in the root directory and add the following:

```env
# Database (Local Docker or Neon)
DATABASE_URL="postgresql://socratic:password123@localhost:5432/socratic_db"

# Neo4j Graph Database
NEO4J_URI="neo4j://localhost:7687"
NEO4J_USERNAME="neo4j"
NEO4J_PASSWORD="testing1234"

# Redis Cache
REDIS_URL="redis://localhost:6379"

# AI Keys
GROQ_API_KEY="your_groq_api_key"
NEXT_PUBLIC_GROQ_API_KEY="your_groq_api_key"

# Clerk Auth
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="your_clerk_publish_key"
CLERK_SECRET_KEY="your_clerk_secret_key"
NEXT_PUBLIC_CLERK_SIGN_IN_URL="/login"
NEXT_PUBLIC_CLERK_SIGN_UP_URL="/sign-up"
```

### 4. Infrastructure (Docker)

Spin up the required database, graph, and caching services:

```bash
docker-compose up -d
```
This will start:
- PostgreSQL (v15 with pgvector) on port 5432
- Neo4j (v5.26) on port 7687 (Bolt) and 7474 (Browser)
- Redis (v7) on port 6379

### 5. Database Initialization

```bash
# Push schema to database and generate client
npx prisma db push
npx prisma generate
```

### 6. Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Team
- Attili Valli Sai Meghana
- Harineesha Nutakki

---

## License
Copyrights Reserved
Built for AMD Slingshot 2026
