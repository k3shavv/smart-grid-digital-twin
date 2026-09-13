# Smart Grid Digital Twin

This repository holds the microservices architecture for our Smart Grid Digital Twin project. We are using a Monorepo structure.

## 📁 Repository Structure Rules

Every team member must keep their service isolated inside their respective subfolder at the root level. Do not commit files directly to the root directory.

```text
smart-grid-digital-twin/
│
├── frontend-ui/            # Nayanaa: React UI codebase
├── server-database/        # Keshav: Express API + MySQL + Redis Cache layer
├── server-queue/           # Siddhant: BullMQ + Redis background worker pipeline
├── server-optimization/    # Lavanya: Python engine executing graph routing mathematics
└── README.md
```

## How to Contribute

- Pull the latest changes from `main` before starting work:
  ```bash
  git pull origin main
  ```
- Navigate into your specific directory to install or run code.
- Keep the root clean: maintain the global `.gitignore` at the root, and manage your service-specific dependencies locally within your folder.

## ⚡ Server & Database (`server-database/`)

### Prerequisites

- MySQL Server running on port `3306` with database `smart_grid` created.
- Redis Server running locally on port `6379`.

### Local Setup

1. Navigate to the backend directory:
   ```bash
   cd server-database
   npm install
   ```
2. Configure environment variables:

   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

   Open `.env` and set your local database credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=smart_grid
   PORT=5000
   ```
3. Seed the substation topology dataset into MySQL:
   ```bash
   node seed.js
   ```
4. Start the backend server:
   ```bash
   node server.js
   ```

The service will listen on `http://localhost:5000`. CORS is enabled for cross-origin frontend requests.

### 📡 API Reference

All routes are prefixed with `/api/grid`. Responses backed by topology data are cached in Redis (15s TTL) and the cache is purged on any mutating action.

| Method | Endpoint | Description | Payload / Params |
|--------|----------|--------------|-------------------|
| `GET`  | `/api/grid/status` | Health check endpoint | None |
| `GET`  | `/api/grid/topology` | Fetches all substations and power lines (cached in Redis, 15s TTL) | None |
| `GET`  | `/api/grid/history/:id` | Returns up to 50 historical telemetry points for plotting time-series charts | URL param: `id` (Substation ID) |
| `POST` | `/api/grid/substation/:id/fail` | Simulates an outage by setting the node to `OFFLINE` and purging cache | URL param: `id` (Substation ID) |
| `POST` | `/api/grid/reset` | Resets all substations to `ONLINE` with baseline 400 kW load and purges cache | None |
| `POST` | `/api/grid/reroute` | Batch updates substation loads from optimization calculations and purges cache | `{ "updates": [{ "id": 1, "current_load_kw": 600 }] }` |
| `POST` | `/api/grid/lines/check-overload` | Scans all lines, trips any line where flow > max capacity, and purges cache | None |
| `POST` | `/api/grid/history/:id/log` | Inserts a new telemetry timestamp and load snapshot into `load_logs` | `{ "load_kw": 450.00 }` |
