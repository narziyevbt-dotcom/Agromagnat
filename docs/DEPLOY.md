# Deploy — agromagnat.uz, fresh Ubuntu 24.04 server

Follow top to bottom. Every command is meant to be pasted as-is unless marked
CHANGE. Assumes the domain is `agromagnat.uz` and the app lives in `/opt/agromagnat`.

> **Server joylashuvi shart:** foydalanuvchi ma'lumotlari O'zbekiston hududida
> saqlanishi qonun talabi. Serverni mahalliy provayderdan oling (Ahost,
> UZINFOCOM va sh.k.) — chet eldagi VPS bu talabga javob bermaydi.

Minimum size: 2 vCPU / 4 GB RAM / 40 GB disk. Photo storage grows with listings —
watch the disk from month one.

## 1. DNS

At the registrar, point records at the server IP before starting — the TLS step
needs them resolving:

```
A     agromagnat.uz       -> <server IP>
A     www.agromagnat.uz   -> <server IP>
```

## 2. Base system

SSH in as root, then:

```bash
apt-get update && apt-get upgrade -y
apt-get install -y curl git ufw

# A non-root deploy user; all later steps run as this user.
adduser --disabled-password --gecos "" deploy
usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh

# Firewall: ssh + web only. Postgres/Redis/MinIO are never published anyway.
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable
```

Disable root SSH login once you have confirmed `ssh deploy@server` works:
`sed -i 's/^#\?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config && systemctl restart ssh`.

## 3. Docker

As `deploy`:

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy
# log out and back in so the docker group applies
docker version
```

## 4. Code and configuration

```bash
sudo mkdir -p /opt/agromagnat && sudo chown deploy:deploy /opt/agromagnat
git clone https://github.com/narziyevbt-dotcom/Agromagnat.git /opt/agromagnat
cd /opt/agromagnat

cp .env.production.example .env
nano .env        # CHANGE every value marked CHANGE; generate secrets with: openssl rand -hex 32
chmod 600 .env
```

Do not skip any CHANGE line. In particular `SMS_PROVIDER=eskiz` — with `mock`
the login code is always 000000 and anyone can sign in as anyone.

## 5. First start (HTTP only) and TLS certificate

The certificate does not exist yet, so nginx must boot with the HTTP-only
config first; certbot then answers the ACME challenge through it.

```bash
cd /opt/agromagnat

# Build and start everything with the HTTP config. First build takes minutes.
NGINX_CONF=./deploy/nginx/http docker compose -f docker-compose.prod.yml up -d --build

# Confirm the stack is alive before requesting a certificate:
curl -fsS http://localhost/health
curl -s -o /dev/null -w '%{http_code}\n' http://localhost/       # expect 200

# Issue the certificate (CHANGE the email):
docker compose -f docker-compose.prod.yml run --rm \
  --entrypoint certbot certbot certonly --webroot -w /var/www/certbot \
  -d agromagnat.uz -d www.agromagnat.uz \
  --email admin@agromagnat.uz --agree-tos --no-eff-email

# Switch nginx to the HTTPS config (the compose default) and restart it:
docker compose -f docker-compose.prod.yml up -d --force-recreate nginx
```

Verify from your own machine: `https://agromagnat.uz` loads, `http://` redirects.

Certificates renew automatically (the certbot container renews twice daily).
nginx must reload to pick up a renewed cert — add as `deploy`:

```bash
crontab -e
# reload nginx nightly; harmless when nothing changed
15 3 * * * docker compose -f /opt/agromagnat/docker-compose.prod.yml exec nginx nginx -s reload
```

## 6. Reference data

Migrations run automatically on backend start. Seed the regions, districts and
categories once:

```bash
docker compose -f docker-compose.prod.yml exec backend \
  node node_modules/typeorm/cli.js -d dist/database/data-source.js migration:show
docker compose -f docker-compose.prod.yml exec backend node dist/database/seeds/run-seed.js
```

Never run `seed:demo` in production — it exists for local dashboards only.

## 7. Backups

Nightly `pg_dump`, gzipped, uploaded to MinIO, 14-day retention on both sides:

```bash
chmod +x /opt/agromagnat/deploy/backup.sh
crontab -e
0 2 * * * /opt/agromagnat/deploy/backup.sh >> /var/log/agromagnat-backup.log 2>&1

# Run once by hand and check the output now, not the day you need it:
/opt/agromagnat/deploy/backup.sh
```

Restore procedure is documented at the top of `deploy/backup.sh`. Test it once
against a scratch database before trusting it.

> MinIO lives on the same machine, so this protects against `DROP TABLE`, not
> against the server catching fire. When there is revenue, add an off-machine
> copy (a second server or object storage — still inside Uzbekistan).

## 8. CI/CD (GitHub Actions)

`.github/workflows/deploy.yml` tests every push and deploys `main` over SSH.
One-time setup in the GitHub repo → Settings → Secrets and variables → Actions:

| Secret | Value |
|---|---|
| `DEPLOY_HOST` | server IP or hostname |
| `DEPLOY_USER` | `deploy` |
| `DEPLOY_SSH_KEY` | a private key generated for CI: `ssh-keygen -t ed25519 -f ci_key` — put `ci_key.pub` into `/home/deploy/.ssh/authorized_keys`, the private half into the secret |

After that, merging to `main` is a deploy. Manual deploy is the same thing the
workflow does:

```bash
cd /opt/agromagnat && git pull
docker compose -f docker-compose.prod.yml build backend web
docker compose -f docker-compose.prod.yml up -d
```

## 9. Monitoring (minimum viable)

- **Uptime:** point a free checker (UptimeRobot or similar) at
  `https://agromagnat.uz/health` — it answers only when Postgres and Redis are
  both reachable, so one check covers the stack. Alert to Telegram.
- **Disk:** `df -h /` weekly, or a cron that alerts above 80% — photos and
  backups are the growers.
- **Logs:** `docker compose -f docker-compose.prod.yml logs -f backend` when
  investigating; docker's default json-file driver caps are worth setting if
  logs ever balloon.

## 10. Post-deploy checklist

- [ ] `https://agromagnat.uz` bosh sahifa ochiladi, `http://` → `https://`
- [ ] `/health` — postgres va redis "up"
- [ ] Telefon bilan ro'yxatdan o'tish ishlaydi va SMS **haqiqiy** keladi (Eskiz balansini tekshiring)
- [ ] E'lon joylash + rasm yuklash ishlaydi, rasm `/storage/...` dan ochiladi
- [ ] `/api/docs` ochilMAYDI (SWAGGER_ENABLED=false)
- [ ] Backup skripti qo'lda ishlatildi va fayl bucketda ko'rindi
- [ ] GitHub Actions'dagi uch job ham yashil

## Ports and layout, for reference

| Component | Where | Exposed |
|---|---|---|
| nginx | container | 80, 443 — the only public ports |
| web (Next.js) | container :3001 | internal only |
| backend (NestJS) | container :3000 | internal only |
| Postgres / Redis / MinIO | containers | internal only |
| App code | `/opt/agromagnat` | — |
| Backups | `/opt/agromagnat/backups` + MinIO `backups` bucket | — |
