# BloomVoice — Full Flower Workforce App

BloomVoice is a full-stack React + Express + MongoDB application for a flower business. It includes login, admin approval, worker profiles, daily attendance, Morga and Jasmine quantities, multilingual browser speech recognition, optional AI parsing, audit logs, and date-specific Excel reports.

## Requirements
- Node.js 20+ (Node 18+ may work with native `fetch`)
- npm 9+
- MongoDB Atlas or local MongoDB

## 1. Install
From the project root:

```bash
npm install
```

## 2. Configure environment
Copy `.env.example` to `.env` in the project root. Fill in your own values. Do not commit `.env`.

Required values:
- `MONGODB_URI`: your MongoDB connection string
- `JWT_SECRET`: a random secret at least 32 characters long
- `ADMIN_EMAIL` and `ADMIN_PASSWORD`: initial admin credentials
- `CLIENT_ORIGIN=http://localhost:5173` for local development

Optional AI values:
- `AI_API_KEY`: Gemini API key
- `AI_MODEL=gemini-2.5-flash`
- `AI_BASE_URL=https://generativelanguage.googleapis.com/v1beta/openai/`

The app can run without AI configured. Manual records and browser speech transcription still work; the server AI parse endpoint returns a clear configuration message until the key is configured. Never put the AI key in `client/` or use a `VITE_` prefix for secrets.

**Security:** The MongoDB password, JWT secret and AI key pasted into the chat should be treated as exposed. Rotate them in the relevant providers and place the replacement values only in your local `.env` and Render environment settings. Change the initial admin password before production use.

## 3. Run locally

```bash
npm run dev
```

- React UI: http://localhost:5173
- Express API: http://localhost:5000/api/health

The backend connects to MongoDB and creates the configured admin account if it does not already exist. It does not overwrite an existing admin password.

## 4. Accounts and approval
- Initial admin is created from `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD` if that email does not exist.
- Public registration creates a pending user. An admin approves/rejects the request in Administration.
- Admin can create worker profiles and manage worker attendance.
- A regular user needs to be linked to a worker by an administrator to view/edit that worker's records. Unlinked accounts cannot access other workers' data.
- The first admin is created from environment variables; never allow public registration to choose an admin role.

## 5. Daily records
- Choose a report date.
- Add workers under the Workers tab (admin only).
- Record Present/Absent and Morga/Jasmine quantities. Quantities default to kg; the UI notes that units should be consistent with your business process.
- A worker/date has one daily summary document, which can contain both flower types. Saving again updates that summary rather than creating duplicate daily summaries.
- Absent status forces both quantities to zero.
- A date report includes all active workers. Workers without a saved record are shown as `unmarked`; they are not silently assumed absent.
- Export Excel creates a `Worker Details` sheet and a `Daily Summary` sheet, including absent and unmarked workers.

## 6. Voice and languages
Browser Speech Recognition is used for transcription, with locale choices for English, Telugu, Hindi, Tamil, Kannada, Malayalam and Urdu. Browser support varies; Chrome/Edge on localhost or HTTPS is recommended. The transcript is editable. AI parsing is a separate server endpoint, and all parsed entries must be reviewed before saving. Flower names and quantities may still need correction, especially with local dialects or noisy environments. Manual entry remains available.

## 7. API overview
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/registrations` (admin)
- `PATCH /api/auth/users/:id` (admin)
- `GET /api/workers`
- `POST /api/workers` (admin)
- `PATCH /api/workers/:id` (admin)
- `GET /api/workers/report/daily?date=YYYY-MM-DD`
- `PUT /api/workers/record/daily`
- `GET /api/workers/report/daily.xlsx?date=YYYY-MM-DD`
- `POST /api/ai/parse-voice`
- `GET /api/admin/dashboard` (admin)
- `GET /api/admin/audit-logs` (admin)
- `GET /api/health`

## 8. Production build / Render

```bash
npm run build
npm start
```

`render.yaml` describes a single Node service that builds the Vite frontend and serves `client/dist` from Express. Connect the repository to Render and set `MONGODB_URI`, `JWT_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and optional `AI_API_KEY` in the Render dashboard. Set `CLIENT_ORIGIN` to the deployed app origin (or leave it set to the same origin if the frontend and API are served together). Use HTTPS in production; secure cookies are enabled automatically when `NODE_ENV=production`.

## Notes and limitations
- This project is a working starter, not a substitute for security review before handling sensitive business data.
- No demo workers or fake production records are inserted.
- Quantities are stored as numbers. If your business needs precise fractional weights, confirm the unit/rounding rules and consider storing scaled integer units.
- Excel output is generated from MongoDB-backed report data; it does not contain hardcoded examples.
- AI voice parsing uses an OpenAI-compatible Gemini endpoint and needs a valid API key and model enabled in your Google AI project.
