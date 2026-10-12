# B2B Pharmaceutical Shipment Protection AIoT System

An enterprise cold-chain monitoring and automated protection platform that continuously tracks Bluetooth Low Energy (BLE) temperature telemetry, projects future thermal curves using scikit-learn machine learning, and autonomously actuates motorized protection trays into insulated cold-pack compartments before temperature limits are breached.

---

## 🌟 Key Features & Core Workflow

```
BLE Temperature Sensor / Simulator
          │
          ▼
   FastAPI Ingestion
          │
          ▼
 PostgreSQL Database
          │
          ▼
Telemetry Trend Analysis
          │
          ▼
scikit-learn AI Forecast (Polynomial Regression + Slope Extrapolation)
          │
          ▼
Automated Decision Engine
          │
          ▼
Motorized Tray Controller / Simulator
          │
          ▼
Protected Cold-Pack Enclosure (Actuated Retraction)
          │
          ▼
Temperature Recovery & Stabilization Verification
          │
          ▼
Real-Time WebSocket Dashboard + 21 CFR Part 11 Audit Trail & Alerts
```

1. **Operations Dashboard (`/dashboard`)**:
   - Fleet metrics: Active Shipments, Normal, At Risk, Protected In Chamber.
   - Live telemetry fleet table with current temp, upper limit, AI 15m forecast, risk badges, and motorized tray state.
   - Recent AIoT Alerts and automated tray protection action logs.
2. **Flagship Shipment Console (`/shipments/[id]`)**:
   - **Current Temperature**, **Temperature Limit** (8.0°C), **AI Forecast**, **Forecast Horizon** (15 min), **Risk Level**, and **Tray Position**.
   - **Recharts Temperature History Chart** with upper threshold and lower safe boundaries.
   - **AI Forecast Trajectory Chart** showing historical samples and projected 15-minute polynomial curve with breach indicators.
   - **Interactive Hardware Simulation Bench**: Trigger thermal excursions, step +1 tick, run continuous auto-sim loops, and reset demo.
   - **Real-Time Event Timeline**: Unified audit trail of automated protection actuations and alerts.
3. **Motorized Tray Control (`/trays`)**:
   - Actuator states: `EXTENDED` (0%), `MOVING_IN` (1%-99%), `PROTECTED` (100%), `MOVING_OUT`, `ERROR`.
   - Manual override controls (**Retract IN**, **Extend OUT**, **Reset**).
4. **BLE Sensor Tags & Gateways (`/devices`, `/gateways`)**:
   - Clean hardware adapter pattern (`BaseGatewayAdapter`, `BaseTrayAdapter`).
   - Software simulator adapter + GAO BLE Gateway adapter integration interface.
5. **Alerts Center & 21 CFR Part 11 Audit Logs (`/alerts`, `/audit-logs`)**:
   - De-duplicated alerts for predicted excursions and tray actuations with operator acknowledgments.
   - Immutable audit trail recording user logins, predictions, tray commands, and configuration adjustments.
6. **GxP Regulatory Compliance Reports (`/reports`)**:
   - Compliance rate calculation (100%), telemetry volume metrics, and printable compliance certificates.
7. **Authentication & RBAC (`/users`, `/login`)**:
   - JWT tokens with 5-tier access control: `SUPER_ADMIN`, `COMPANY_ADMIN`, `MANAGER`, `OPERATOR`, `VIEWER`.

---

## 💻 Tech Stack

- **Backend**: Python 3.12 / 3.13, FastAPI, SQLAlchemy 2.x, Alembic, WebSockets, Pydantic v2, bcrypt.
- **AI / Machine Learning**: scikit-learn (Polynomial Regression + Ridge, slope estimation, confidence scoring, root-finding for breach ETA).
- **Database**: PostgreSQL (with graceful SQLite fallback for local developer machines).
- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS, Recharts, Lucide Icons.
- **Theme**: Clean enterprise white B2B palette (`#ffffff` background, `#e2e8f0` slate borders, `#1d4ed8` / `#2563eb` brand blue).
- **Deployment**: Docker & Docker Compose (`postgres`, `redis`, `backend`, `frontend`).

---

## 🚀 Quick Start

### ⚡ Single Command (Run Frontend + Backend Together)
You can run both the FastAPI backend and Next.js frontend concurrently using a single command:

```bash
python server.py
# or double-click run.bat on Windows
```

This single command will:
1. Initialize and seed the database (`backend/seed.py`).
2. Launch FastAPI on `http://localhost:8000`.
3. Launch Next.js on `http://localhost:3000`.
4. Stream synchronized, color-coded logs for both services.
5. Gracefully terminate both processes when you press `Ctrl+C`.

---

### Manual Step-by-Step Setup

#### 1. Backend Server

```bash
# Activate virtual environment
.\backend_venv\Scripts\Activate.ps1

# Run database migrations and seed default data
python backend/seed.py
alembic upgrade head

# Start FastAPI server on port 8000
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir backend
```
*Backend API Docs will be available at:* `http://localhost:8000/docs`

### 2. Frontend Application

```bash
cd frontend
npm install
npm run dev
```
*Web application will be available at:* `http://localhost:3000`

---

## 🐳 Docker Compose Deployment

Run the complete four-service stack with a single command:

```bash
docker compose up --build
```

Services started:
- `frontend` (Next.js): `http://localhost:3000`
- `backend` (FastAPI): `http://localhost:8000`
- `postgres` (PostgreSQL 16): `localhost:5432`
- `redis` (Redis 7): `localhost:6379`

---

## 🧪 Demo Scenario & Testing

### Default Credentials
| Role | Email | Password |
|---|---|---|
| **Super Admin** | `admin@pharmaprotect.com` | `Admin123!` |
| **Floor Operator** | `operator@pharmaprotect.com` | `Operator123!` |
| **Cold Chain Manager** | `manager@pharmaprotect.com` | `Manager123!` |
| **Quality Auditor** | `viewer@pharmaprotect.com` | `Viewer123!` |

### Running the End-to-End Excursion Prevention Demo:
1. Navigate to **http://localhost:3000/shipments/1** in your browser.
2. Observe baseline telemetry starting at safe **5.52 °C** with tray **EXTENDED (0%)**.
3. In the **Hardware Simulation & AIoT Control Bench**, click **"Trigger Excursion"**.
4. The temperature curve begins rising.
5. Click **"Step +1 Tick"** or watch the auto-runner:
   - As temperature climbs past 6.3 °C, the **scikit-learn polynomial regression** projects temperature crossing the configured **8.0 °C** limit within the 15-minute horizon.
   - **Risk Level** turns **HIGH** (⚠️ Breach Predicted).
   - The **Automated Decision Engine** immediately triggers fail-safe protection.
   - Motorized tray state transitions: `EXTENDED` &rarr; `MOVING_IN` &rarr; `PROTECTED (100%)`.
   - In the protected cold-pack chamber (2.5 °C), temperature stabilizes and begins falling back to safe temperatures (~4 °C).
   - The system verifies cooling recovery, issues a **Cooling Verified** alert, and commits all events to the regulatory audit log.
6. Click **"Reset Scenario"** at any time to return to the 5.5 °C baseline for a repeatable demonstration.

### Automated Test Suite:
Run the end-to-end backend test verification script:
```bash
.\backend_venv\Scripts\python backend\test_e2e.py
```
This tests authentication, overview metrics, scikit-learn forecasting, simulator stepping, excursion breach detection, decision engine tray actuation, alert generation, and audit logging.

---

## 📡 REST API Structure

- `POST /api/v1/auth/login` - Authenticate & obtain JWT token
- `GET /api/v1/shipments/overview` - Dashboard fleet metrics & active consignments
- `GET /api/v1/shipments/{id}` - Complete shipment detail & bound hardware status
- `POST /api/v1/temperature/readings` - Ingest sensor reading & evaluate AI pipeline
- `GET /api/v1/temperature/history/{id}` - Historical timestamped telemetry
- `POST /api/v1/forecast/{id}/run` - Compute on-demand scikit-learn thermal forecast
- `POST /api/v1/trays/{id}/move-in` - Actuate tray into cold enclosure
- `POST /api/v1/trays/{id}/move-out` - Extend tray outward
- `POST /api/v1/simulator/step/{id}` - Step physical simulation by one tick
- `POST /api/v1/simulator/trigger-excursion/{id}` - Initiate accelerated thermal breach
- `POST /api/v1/simulator/reset/{id}` - Reset consignment to safe 5.5 °C baseline
- `GET /api/v1/alerts` - List alerts with acknowledgment status
- `GET /api/v1/reports/compliance` - GxP regulatory compliance statistics
- `GET /api/v1/audit` - 21 CFR Part 11 immutable audit trail logs
- `WS /ws/shipments/{id}` - Real-time WebSocket telemetry stream
