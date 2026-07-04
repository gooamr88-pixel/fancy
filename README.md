# Fancy RSVP — Guest Lifecycle Management Platform

Welcome to the Fancy RSVP codebase. This repository is structured as an npm monorepo containing the decoupled backend API and frontend Next.js application.

---

## 📁 Repository Structure

```
├── /backend              # Node.js/Express.js REST API
├── /frontend             # Next.js 16 (App Router) User Interface
├── /supabase             # Database migrations, SQL schema, & stored procedures
├── package.json          # Root workspace configuration
└── README.md             # Developer documentation
```

---

## 🛠️ Quick Start

### 1. Prerequisites
- Node.js 18+ (LTS recommended)
- Supabase project credentials
- Stripe account (for payments testing)
- Twilio account (for SMS credits testing)

### 2. Installation
From the root directory, install all dependencies for the workspace, backend, and frontend:
```bash
npm install
```

### 3. Environment Setup
Configure your environment variables for local development:

- **Backend:** Copy `backend/.env.example` to `backend/.env` and fill in the secrets.
- **Frontend:** Create a `frontend/.env.local` containing:
  ```env
  NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
  NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
  NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
  ```

### 4. Running Locally
You can run the development servers for either service directly from the root workspace:

- **Start backend dev server:**
  ```bash
  npm run dev:backend
  ```
  The API will be available at [http://localhost:3000](http://localhost:3000).

- **Start frontend dev server:**
  ```bash
  npm run dev:frontend
  ```
  The client will be available at [http://localhost:3000](http://localhost:3000) (or next available port).

---

## ⚡ Core Architecture Details

### Seating Concurrency Control
Seating assignments are processed via an atomic stored procedure (`assign_seat`) executing advisory locks in PostgreSQL to eliminate any potential overbooking race conditions during simultaneous dashboard updates or entrance check-ins.

### QR Code Credentialing
Entrance tickets are encoded as cryptographically signed JSON Web Tokens (JWT) containing guest ID, event ID, table ID, and party size. They are only generated *after* the organizer assigns a seat to the guest.
