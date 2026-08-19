# Quick Start (5 minutes)

For: Pam and other experienced devs. Full guide in DEPLOYMENT.md.

## TL;DR Setup

```bash
# 1. Clone
cd /opt && git clone <repo> vps-monitor && cd vps-monitor

# 2. Credentials
node -e "console.log(Buffer.from(require('bcryptjs').hashSync('mypassword', 10)).toString('base64'))"
# Copy hash ↓
openssl rand -base64 48
# Copy secret ↓

# 3. Config
cat > .env <<EOF
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH_B64=$(node -e "console.log(Buffer.from(require('bcryptjs').hashSync('mypassword', 10)).toString('base64'))")
SESSION_SECRET=$(openssl rand -base64 48)
NGINX_SITES_ENABLED_DIR=/etc/nginx/sites-enabled
NGINX_SERVICE_NAME=nginx
PM2_ALLOWED_APPS=
EOF
# Note: the hash is base64-encoded because bcrypt's "$" characters would
# otherwise be mangled by Next.js's $VAR expansion when it loads .env.

# 4. Sudoers (for nginx control)
sudo ./deploy/setup-sudoers.sh $(whoami)

# 5. Deploy
./deploy/install.sh

# 6. Nginx + TLS (one-time)
sudo cp deploy/nginx-vps-monitor.conf /etc/nginx/sites-available/vps-monitor
sudo nano /etc/nginx/sites-available/vps-monitor  # set domain
sudo ln -s /etc/nginx/sites-available/vps-monitor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d monitor.yourdomain.com

# Done! Visit https://monitor.yourdomain.com
```

## Folder structure

```
vps-monitor/
├── app/
│   ├── api/          # All Route Handlers (auth, system, pm2, nginx)
│   ├── login/        # Login page (Client Component)
│   ├── dashboard/    # Dashboard (Client Component with polling)
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # / → /dashboard redirect
│   └── globals.css   # Dark ops console theme
├── lib/
│   ├── session.ts    # JWT (jose) + cookies
│   ├── system.ts     # systeminformation
│   ├── pm2.ts        # pm2 CLI via execFile
│   ├── nginx.ts      # systemctl + sudo -n
│   ├── auth.ts       # Middleware helper
│   └── format.ts     # formatBytes, formatDuration
├── components/
│   ├── TopBar.tsx    # Header
│   ├── MetricCard.tsx
│   ├── Pm2Table.tsx
│   ├── NginxPanel.tsx
│   └── StatusPill.tsx
├── middleware.ts     # Auth enforcement (Next.js native)
├── deploy/
│   ├── install.sh    # Deploy script
│   ├── setup-sudoers.sh
│   └── nginx-vps-monitor.conf
├── ecosystem.config.js  # PM2 config
├── package.json
├── tsconfig.json
├── next.config.js
├── README.md
├── DEPLOYMENT.md
└── .env.example
```

## Tech stack

- **Frontend**: Next.js 14 (App Router), React 18, pure CSS (no Tailwind, no UI library)
- **Backend**: Node.js 18+, TypeScript 5
- **Auth**: bcryptjs + jose (JWT via httpOnly cookie)
- **System**: systeminformation (reads /proc, no elevated privileges)
- **Process control**: pm2 CLI (execFile, no shell injection risk)
- **System control**: systemctl + sudo -n (scoped sudoers)
- **Runtime**: PM2 as process manager

## Design notes

**Dark ops console aesthetic** — muted purples & greens, monospace for data, minimal animations. Intentionally not templated-looking.

**Zero JS dependencies for UI** — No framework outside React. CSS is hand-written to keep bundle small and give full control.

**Polling architecture** — Dashboard does 4-second polling via `fetch`. No WebSocket (simpler, stateless, works behind any nginx).

**Safety first**:
- `execFile` for PM2 (no shell metacharacters)
- Rate limiting on login
- httpOnly session cookie
- Scoped sudoers for nginx
- No database (single-user)

## Common customizations

**Change polling interval**: Edit app/dashboard/page.tsx, line ~12 `POLL_MS`

**Change session timeout**: Edit .env `SESSION_TTL_SECONDS` (default 28800 = 8 hours)

**Restrict to IP**: Add allow/deny to `/etc/nginx/sites-available/vps-monitor`

**Limit PM2 apps**: Set `PM2_ALLOWED_APPS=app1,app2,app3` in .env

**Change port**: Edit ecosystem.config.js `args: "start -p 3011"` → `args: "start -p 3012"`

## Redeploy

```bash
cd /path/to/vps-monitor
git pull
./deploy/install.sh
# Done, pm2 auto-reloads
```

## Logs & debugging

```bash
pm2 logs vps-monitor
pm2 logs vps-monitor --lines 200 --err  # errors only
pm2 describe vps-monitor  # show all config & env vars
pm2 stop vps-monitor      # manual stop
pm2 restart vps-monitor   # manual restart
```

## API endpoints (all authenticated)

```
GET  /api/system          → {hostname, cpu, memory, disks, network, uptime}
GET  /api/pm2             → {processes: [...]}
POST /api/pm2/[name]      → {action: "restart"|"stop"|"start"}
GET  /api/pm2/[name]      → {logs: "..."}
GET  /api/nginx           → {status, sites}
POST /api/nginx/action    → {action: "reload"|"restart"|"stop"|"start"|"test"}
POST /api/auth/login      → {ok: true} + sets httpOnly cookie
POST /api/auth/logout     → {ok: true} + clears cookie
```

## Common issues

| Issue | Fix |
|-------|-----|
| "Invalid username or password" | Regenerate .env, rebuild: `npm run build && pm2 restart vps-monitor` |
| Nginx buttons error "permission denied" | Run `sudo ./deploy/setup-sudoers.sh $(whoami)` again |
| "Failed to list pm2 processes" | Is the app running as the same user as your pm2 daemon? |
| High memory | Edit ecosystem.config.js `max_memory_restart: "500M"` and `pm2 reload ecosystem.config.js` |

That's it. More details in DEPLOYMENT.md and README.md.
