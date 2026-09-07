# Deployment — Openspace Agency OS (brief-hub)

Split architecture: static React build on BigRock shared hosting, FastAPI backend on
Render, MongoDB Atlas. AI + file storage stay on Emergent (via `EMERGENT_LLM_KEY`),
both verified working off-platform.

| Piece | Where | Notes |
|---|---|---|
| React build (`frontend/build/`) | BigRock `public_html` (huzefa.test.osagency.in) | `.htaccess` ships in the build |
| FastAPI (`backend/`) | Render free tier | sleeps after 15 min idle (~30–50s cold start) |
| MongoDB | Atlas M0 free tier | region ap-south-1 (Mumbai) |

## 1. MongoDB Atlas
1. Create an M0 (free) cluster in `ap-south-1`.
2. Create a database user (readWrite on `openspace_agency_os`).
3. Network access: allow `0.0.0.0/0` (Render free tier has no static IPs).
4. Copy the `mongodb+srv://` connection string.

## 2. Restore production data (BEFORE the backend first starts)
The backend seeds demo data on startup if the DB is empty, so restore first:
```bash
cd backend
# point MONGO_URL/DB_NAME in backend/.env (or env) at Atlas, then:
python restore_dump.py ../emergent_data_dump.json
```
`emergent_data_dump.json` is the full export from the Emergent environment
(gitignored — contains password hashes; keep it private).

## 3. Render backend
1. Push this repo to GitHub.
2. Render → New → Blueprint (uses `render.yaml`), or manual Web Service with:
   - Root directory: `backend`
   - Build: `pip install -r requirements.txt`
   - Start: `uvicorn server:app --host 0.0.0.0 --port $PORT`
3. Set env vars from `.deploy/render-env.txt` (gitignored). `MONGO_URL` = Atlas URI.
4. Verify: `https://<service>.onrender.com/docs` loads, and
   `POST /api/auth/login` with a known user returns a token.

## 4. Frontend build + BigRock upload
```bash
cd frontend
echo "REACT_APP_BACKEND_URL=https://<service>.onrender.com" > .env
yarn install && yarn build
```
Upload the **contents** of `frontend/build/` to `public_html/` of
huzefa.test.osagency.in via cPanel File Manager or FTP. The SPA `.htaccess`
is included in the build automatically.

## 5. Verify
- Site loads at https://huzefa.test.osagency.in and deep links (e.g. `/jobs`) survive refresh.
- Network tab: `/api/...` calls hit the Render URL and return 200, no CORS errors.
- Login works with existing (migrated) credentials.
- A job attachment opens (proves Emergent object storage still reachable).

## Post-launch checklist
- Rotate all user passwords that still use Emergent-era defaults.
- Ask Emergent about off-platform billing, storage retention/export, and key rotation.
- Consider Render Starter ($7/mo) to remove cold starts.
- Later: consolidate onto a VPS (planned).
