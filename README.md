# VPS Monitor

A small self-hosted dashboard to watch one VPS's vitals (CPU / RAM / disk /
uptime) and control the apps running on it: restart/stop/start PM2
processes, and reload/restart/stop/start nginx. Built with Next.js
(App Router), runs as its own PM2 process, sits behind nginx + TLS.

This is a single-tenant ops tool for **your own** server(s) — one login,
full control. It is not a multi-customer SaaS; see "Going multi-VPS" below
if that's actually what you need.

## How it works

```
 Browser ──HTTPS──▶ nginx (TLS, reverse proxy) ──▶ Next.js app (pm2, port 3011)
                                                        │
                                    ┌───────────────────┼────────────────────┐
                                    ▼                    ▼                    ▼
                          systeminformation        `pm2` CLI            `systemctl` / `nginx -t`
                          (reads /proc, no          (same user,          (needs sudo — see
                           privileges needed)         same pm2 daemon)     setup-sudoers.sh)
```

- **Auth**: single admin user, bcrypt password hash in `.env`, signed JWT
  session cookie (httpOnly, `jose`). No database.
- **System stats**: the `systeminformation` npm package reads `/proc` —
  no elevated privileges required.
- **PM2 control**: shells out to the `pm2` CLI via `execFile` (never a
  shell string, so app names can't be used for command injection). Works
  as long as this app runs under the *same* Linux user/pm2 daemon as the
  apps you want to control.
- **Nginx control**: `systemctl is-active nginx` for read-only status (no
  privileges needed). Reload/restart/stop/start run through
  `sudo -n systemctl ... nginx`, which requires a one-time sudoers grant
  (see below) scoped to *only* those exact commands.

## Setup

### 1. Configure environment

```bash
cp .env.example .env
```

Generate a password hash and a session secret:

```bash
node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1], 10)).toString('base64'))" 'your-strong-password'
openssl rand -base64 48
```

Put those into `.env` as `ADMIN_PASSWORD_HASH_B64` and `SESSION_SECRET`.
Set `ADMIN_USERNAME` to whatever you like.

> **Why base64?** bcrypt hashes contain literal `$` characters (e.g.
> `$2a$10$...`), and Next.js does shell-style `$VAR` expansion on `.env`
> files — storing the raw hash silently corrupts it. Base64-encoding it
> sidesteps that entirely; the app decodes it at login time.

### 2. Grant nginx control (one-time, as root)

```bash
sudo ./deploy/setup-sudoers.sh $(whoami)
```

This writes `/etc/sudoers.d/vps-monitor` allowing your deploy user to run
`systemctl {start,stop,restart,reload} nginx` and `nginx -t` without a
password — nothing else. Skip this if you only want monitoring, not nginx
control; the status panel still works read-only without it.

### 3. Install, build, run under pm2

```bash
npm ci
npm run build
pm2 start ecosystem.config.js
pm2 save
```

Or just run `./deploy/install.sh` which does all of the above (and
reloads instead of double-starting on redeploys).

### 4. Put nginx + TLS in front of it

```bash
sudo cp deploy/nginx-vps-monitor.conf /etc/nginx/sites-available/vps-monitor
sudo nano /etc/nginx/sites-available/vps-monitor   # set your domain
sudo ln -s /etc/nginx/sites-available/vps-monitor /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d monitor.yourdomain.com
```

Now visit `https://monitor.yourdomain.com` and sign in.

## Configuration reference (`.env`)

| Variable | Purpose |
|---|---|
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH_B64` | Login credentials (base64-wrapped bcrypt hash, not plaintext) |
| `SESSION_SECRET` | Signs the session cookie — keep long and secret |
| `SESSION_TTL_SECONDS` | How long a login stays valid (default 8h) |
| `NGINX_SITES_ENABLED_DIR` | Where to list enabled sites, e.g. `/etc/nginx/sites-enabled` |
| `NGINX_SERVICE_NAME` | systemd unit name for nginx (usually `nginx`) |
| `PM2_ALLOWED_APPS` | Optional comma-separated allow-list of pm2 app names this dashboard may touch |

## Security notes

- Always run this behind HTTPS (step 4) — the login posts a password.
- Consider adding an `allow`/`deny` IP block in the nginx config, or
  putting it behind a VPN/Tailscale, since it can restart your production
  processes.
- `PM2_ALLOWED_APPS` is worth setting if this same pm2 daemon runs
  anything you don't want exposed to this dashboard.
- The sudoers grant is scoped to exact binary paths and exact nginx
  actions — it cannot be used to run arbitrary commands as root.

## Going multi-VPS / actual multi-tenant SaaS

This build controls the box it runs on. If you want one dashboard to
monitor several VPSes (or eventually sell this to other people), the
shape changes:

- Install a lightweight agent on each VPS that exposes the same
  system/pm2/nginx data over an authenticated API (or pushes it to a
  central collector).
- The central Next.js app becomes multi-tenant: a real database (users,
  servers, API keys), per-tenant scoping on every query, and the agent
  pattern instead of direct `execFile` calls from the web process.

Happy to help scaffold that version too if this is heading toward an
actual product rather than a personal ops tool.
