# VPS Monitor — Deployment & Operations Guide

## What is VPS Monitor?

A lightweight self-hosted operations dashboard (Next.js 14 + Node.js) for monitoring and controlling a single VPS:

- **System stats**: CPU load, memory, disk usage, uptime (4-second polling)
- **PM2 control**: View process status, restart/stop/start apps
- **Nginx control**: View status, reload/restart/stop/start, view enabled sites, test config

**Single-tenant, single-user**: One login credential, full access. Built for your own ops use, not a multi-customer product.

## Architecture

```
Internet
   ↓ HTTPS (port 443)
nginx (reverse proxy, TLS termination)
   ↓ HTTP (localhost:3011)
Next.js app (Node.js 18+, pm2)
   ↓
├─ systemd/systemctl (nginx control, no special privileges)
├─ pm2 CLI (same user, same daemon)
└─ /proc filesystem (system stats, read-only)
```

## Prerequisites

- Linux VPS (Debian/Ubuntu 20.04+, or RHEL/CentOS with adjustments)
- Node.js 18+ and npm
- PM2 installed globally (`npm i -g pm2`)
- nginx installed and running
- A domain name (for HTTPS via Let's Encrypt)
- A non-root Linux user that runs your pm2 apps (this app will run as that user too)

## Step-by-Step Deployment

### 1. Clone / Download the app

```bash
cd /opt  # or wherever you keep apps
git clone <repo-url> vps-monitor
cd vps-monitor
```

### 2. Generate credentials

#### 2a. Admin password hash

```bash
node -e "console.log(Buffer.from(require('bcryptjs').hashSync(process.argv[1], 10)).toString('base64'))" 'your-strong-password-here'
```

Copy the output.

> **Why base64 and not the raw hash?** bcrypt hashes contain literal `$`
> characters (e.g. `$2a$10$...`). Next.js does shell-style `$VAR`
> expansion when it loads `.env` files, which silently corrupts a raw
> hash — everything from the first unmatched `$NAME` onward gets treated
> as a variable reference and stripped. Base64-encoding it avoids that
> entirely; the app decodes it back at login time.

#### 2b. Session secret (for cookie signing)

```bash
openssl rand -base64 48
```

Copy the output.

### 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Fill in:
- `ADMIN_USERNAME`: username (e.g., `admin`)
- `ADMIN_PASSWORD_HASH_B64`: paste the base64 output from step 2a
- `SESSION_SECRET`: paste the secret from step 2b
- `NGINX_SITES_ENABLED_DIR`: where your nginx enabled sites live (e.g., `/etc/nginx/sites-enabled`)
- `NGINX_SERVICE_NAME`: systemd unit name for nginx (usually `nginx`)
- `PM2_ALLOWED_APPS`: optional comma-separated allow-list of process names this dashboard can touch (leave blank to allow all)

Example:

```
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH_B64=JDJhJDEwJGFiY2RlZmdoaWprbG1ub3BxcnN0dXZ3eHl6MTIzNDU2Nzg5MGFiY2RlZmdoaWprbG1ub3BxcnN0
SESSION_SECRET=aBcDeFgHiJkLmNoPqRsTuVwXyZ1234567890+/aBcDeFgHi
SESSION_TTL_SECONDS=28800
NGINX_SITES_ENABLED_DIR=/etc/nginx/sites-enabled
NGINX_SERVICE_NAME=nginx
PM2_ALLOWED_APPS=
```

### 4. Grant sudo for nginx control (one-time, as root)

This allows the app to reload/restart/stop/start nginx without prompting for a password. It's scoped to *exactly* those commands, nothing else.

```bash
sudo ./deploy/setup-sudoers.sh $(whoami)
```

Verify it worked:

```bash
sudo -n systemctl status nginx
# Should show status without prompting for password
```

If you skip this, the status panel still works (read-only), but control buttons will fail.

### 5. Build and install

```bash
./deploy/install.sh
```

This runs:
- `npm ci` (clean install)
- `npm run build` (Next.js static export)
- `pm2 start ecosystem.config.js` (or reload if already running)
- `pm2 save` (save to startup list)

Check status:

```bash
pm2 status vps-monitor
pm2 logs vps-monitor
```

### 6. Set up nginx reverse proxy + TLS

```bash
sudo cp deploy/nginx-vps-monitor.conf /etc/nginx/sites-available/vps-monitor
sudo nano /etc/nginx/sites-available/vps-monitor
# Edit server_name to your domain
sudo ln -s /etc/nginx/sites-available/vps-monitor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Get a free TLS certificate:

```bash
sudo apt-get install certbot python3-certbot-nginx -y
sudo certbot --nginx -d monitor.yourdomain.com
```

Now visit `https://monitor.yourdomain.com` and sign in with your admin username and password.

## Updating

```bash
cd /path/to/vps-monitor
git pull origin main
./deploy/install.sh
```

## Operations

### Check status

```bash
pm2 status vps-monitor
pm2 logs vps-monitor --lines 100
```

### Restart the app

```bash
pm2 restart vps-monitor
```

### View all running pm2 apps

```bash
pm2 list
```

### Stop/remove from autostart

```bash
pm2 delete vps-monitor
pm2 save
```

## Security Considerations

### In scope (you should do these)

✅ **Always use HTTPS** — the login posts a password. nginx + Let's Encrypt is free.

✅ **Restrict network access** — add IP-based allow/deny in nginx.conf, or run behind a VPN/Tailscale.

```nginx
# In /etc/nginx/sites-available/vps-monitor:
location / {
    allow 203.0.113.10;      # Only your IP
    deny all;
    proxy_pass ...
}
```

✅ **Use a strong password** — `openssl rand -base64 32 | tr -dc 'a-zA-Z0-9!@#$%^&*'`

✅ **Session TTL** — Default 8 hours. Set `SESSION_TTL_SECONDS` to something shorter if the dashboard sits on a shared network.

✅ **PM2_ALLOWED_APPS** — If the same pm2 daemon runs critical apps you don't want exposed, list only the safe ones.

### Security guarantees

✅ **No command injection** — PM2 control uses `execFile(..., [args])` (no shell), so app names can't be used as commands.

✅ **Sudo is scoped** — The sudoers file grants ONLY `systemctl {start,stop,restart,reload} nginx` and `nginx -t`.

✅ **Session cookies are httpOnly** — Can't be stolen by XSS (and there's no user input rendering in the dashboard anyway).

### Out of scope (not this dashboard's job)

❌ Multi-tenant — this is single-user only.

❌ Audit logging — consider adding `syslog` integration if you need to track who did what.

❌ Rate limiting on nginx actions — there's a rate limiter on login, but not on control actions; if you want that, add a middleware.

## Troubleshooting

### "Invalid username or password" even with correct credentials

1. Regenerate the password hash and .env, rebuild:
   ```bash
   node -e "console.log(Buffer.from(require('bcryptjs').hashSync('newpass', 10)).toString('base64'))"
   # Update ADMIN_PASSWORD_HASH_B64 in .env
   npm run build
   pm2 restart vps-monitor
   ```

2. Check NODE_ENV and .env loading:
   ```bash
   pm2 describe vps-monitor
   # Look for "env" section, should show your vars
   ```

### Nginx control buttons say "permission denied"

1. Did you run `sudo ./deploy/setup-sudoers.sh`?
2. Verify sudoers:
   ```bash
   sudo visudo -f /etc/sudoers.d/vps-monitor
   # Should show three lines for nginx actions
   ```

### "Failed to list pm2 processes"

1. Is `pm2` in PATH?
   ```bash
   which pm2
   pm2 --version
   ```

2. Are you running the app as the same user that owns the pm2 daemon?
   ```bash
   ps aux | grep pm2
   ps aux | grep "vps-monitor"
   # Should be same user
   ```

### High memory usage

Check the app's `max_memory_restart` in ecosystem.config.js (default 300M). Adjust if needed:

```bash
nano ecosystem.config.js
# Change max_memory_restart to 500M, then:
pm2 reload ecosystem.config.js
pm2 save
```

### System stats show "—" (dashes)

The `systeminformation` package reads from `/proc`. If you're in a container with limited proc access, some metrics may not be available. This is normal and non-fatal.

## Multi-VPS / SaaS-ifying this

If you want to eventually:
- Monitor multiple VPSes from one dashboard
- Sell access to other people
- Add per-server API keys and users

…the architecture would need to change:

1. **Install agents** on remote VPSes that expose a secured API
2. **Central dashboard** queries agents, stores server metadata in a database
3. **Auth system** becomes multi-tenant (users, organizations, API keys)

Happy to help scaffold that version if this grows beyond a personal tool.

## Support / Issues

Check the main README.md for architecture details. Look at logs:

```bash
pm2 logs vps-monitor --follow
```

Curl individual API endpoints to isolate issues:

```bash
curl -b ~/.cookies http://localhost:3011/api/system
curl -b ~/.cookies http://localhost:3011/api/pm2
curl -b ~/.cookies http://localhost:3011/api/nginx
```
