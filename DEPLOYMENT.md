# FlixDrive deployment

This deployment uses:

- Frontend: Vercel at `https://flixdrive.minimanx.dev`
- Backend and Socket.IO: Coolify at `https://flixdrive-api.minimanx.dev`
- Database and session store: a private MongoDB resource on Coolify

The existing `*.minimanx.dev` DNS record points backend hostnames to the
Coolify server. The specific `flixdrive.minimanx.dev` record is assigned to
Vercel and takes precedence over the wildcard. Keeping both public services
under `minimanx.dev` also prevents the session cookie from becoming a
third-party cookie.

## 1. Push the deployment changes

From the repository root:

```bash
git add client server DEPLOYMENT.md
git commit -m "Prepare FlixDrive deployment"
git push origin main
```

Both Vercel and Coolify will deploy from the `main` branch.

## 2. Create MongoDB in Coolify

1. Open Coolify.
2. Create or open a `FlixDrive` project and its `Production` environment.
3. Select **New Resource**, then **Database**, then **MongoDB**.
4. Select the same server and destination that the backend will use.
5. Name the resource `flixdrive-mongodb`.
6. Keep or regenerate the automatically generated username and password.
7. Leave **Publicly Accessible** disabled and do not set a public port.
8. Leave **Enable SSL** disabled for this private, same-server connection.
9. Deploy the database.
10. Open **Persistent Storage** and confirm that MongoDB has a volume mounted
   at `/data/db`. Do not delete this volume when redeploying the backend.
11. Copy the database's **Internal URL** exactly as Coolify displays it.

The internal URL will resemble this, but its hostname and credentials will be
different:

```text
mongodb://username:password@mongodb-resource-host:27017
```

Do not create a DNS record or public domain for MongoDB. Only the backend
container should be able to reach it.

### MongoDB SSL choice

For this deployment, MongoDB traffic stays between two containers on the same
private Coolify Docker network. With public access and port `27017` disabled,
database TLS adds certificate setup without protecting an internet-facing
connection. Keep MongoDB SSL disabled initially; the backend's public domain
must still use HTTPS.

If database traffic later crosses servers or an untrusted network, enable SSL
with `verify-full`, mount Coolify's CA certificate read-only into the backend
container, and replace `MONGODB_URI` with Coolify's new SSL connection URL.
Enabling the checkbox alone is not sufficient: the application must use the
new URL and trust the generated CA certificate.

## 3. Create the Coolify backend

1. In the same Coolify project and environment, select **New Resource** and
   create an **Application**.
2. Choose **Private Repository with GitHub App** and select
   `Minimanx/ExamProject`.
3. Select the `main` branch.
4. Configure the application:

| Setting | Value |
| --- | --- |
| Build pack | `Nixpacks` |
| Base directory | `/server` |
| Static site | Disabled |
| Port exposes | `5000` |
| Install command | `npm ci --omit=dev` |
| Build command | Leave empty |
| Start command | `npm start` |
| Health check path | `/health` |
| Health check port | `5000` |

`server/package.json` lists `mongodb-memory-server` as a devDependency for
the test suite. It has a `postinstall` hook that downloads a full `mongod`
binary (roughly 148 MB) on install. A plain `npm ci` installs
devDependencies too, and `NODE_ENV=production` is only added as a runtime
variable in step 4 below, so it is not necessarily set at build time either.
Leaving the install command empty would therefore download that binary into
every deploy for no reason.

That hook is now disabled in the repository rather than per-environment —
`server/package.json` sets `config.mongodbMemoryServer.disablePostinstall`,
which the library reads in preference to its own default. It applies
everywhere, including hosts where you cannot override the install command,
so no build-time environment variable is required. The test suite downloads
the binary on first use instead, and CI fetches it explicitly before running
tests so a cold cache never races the test timeout.

The `npm ci --omit=dev` install command above is still worth setting: it
keeps roughly 130 dev packages out of the production image. It is now an
image-size optimisation rather than the thing standing between you and a
148 MB download.

5. Confirm that the application uses the same server and destination as
   `flixdrive-mongodb`.
6. Add the domain:

```text
https://flixdrive-api.minimanx.dev
```

No new DNS record is required because `*.minimanx.dev` already points to the
Coolify server. Adding the hostname to the Coolify resource allows its proxy
to route requests and request a TLS certificate.

## 4. Add backend environment variables

Open the backend application's **Environment Variables** page and add these
as runtime variables:

```dotenv
NODE_ENV=production
PORT=5000
CLIENT_ORIGINS=https://flixdrive.minimanx.dev,https://flix-drive-lyart.vercel.app
MONGODB_URI=PASTE_THE_COOLIFY_INTERNAL_MONGODB_URL_HERE
SESSION_SECRET=PASTE_A_RANDOM_SECRET_HERE
OMDB_API_KEY=PASTE_THE_OMDB_API_KEY_HERE
EMAIL_USER=flixdrive.mailer@gmail.com
EMAIL_PASSWORD=PASTE_THE_GMAIL_APP_PASSWORD_HERE
```

Generate `SESSION_SECRET` locally in Terminal:

```bash
openssl rand -hex 32
```

This prints a 64-character random value. Paste the complete output into the
Coolify `SESSION_SECRET` value. This secret is generated by you; it does not
come from Google, Vercel, or Coolify. Never commit or share it. Changing it
later is safe, but immediately logs out every existing session.

Create the movie API key at <https://www.omdbapi.com/apikey.aspx>. Select the
free plan, confirm the email OMDb sends, and put the activated key in Coolify
as `OMDB_API_KEY`. The free plan currently allows 1,000 requests per day. Keep
the key only in Coolify and never commit or share it.

### Create the Gmail app password

The server cannot use a passkey for SMTP. A passkey signs you into Google's
website; Nodemailer needs a dedicated Google app password.

1. Sign in to `flixdrive.mailer@gmail.com` with the passkey.
2. Open <https://myaccount.google.com/security>.
3. Under **How you sign in to Google**, confirm that **2-Step Verification**
   is enabled. App passwords require 2-Step Verification.
4. Open <https://myaccount.google.com/apppasswords>.
5. Reauthenticate with the passkey when Google asks.
6. Enter `FlixDrive Coolify` as the app name and select **Create**.
7. Copy the generated 16-character app password. Google only shows it once.
8. Paste it into Coolify as `EMAIL_PASSWORD`, without display spaces.
9. Set `EMAIL_USER=flixdrive.mailer@gmail.com`.

The app password is only for the Coolify mailer. It is not your normal Google
password and does not replace the passkey used for interactive sign-in.

The server connects to Gmail at `smtp.gmail.com:587` using STARTTLS. Hetzner
allows outbound port `587`; its default SMTP restriction blocks ports `25` and
`465`, so do not change the mailer to port `465` on this server.

If the App Passwords page is unavailable, check whether 2-Step Verification
is off, the account is managed by work or school, 2-Step Verification permits
only security keys, or the account uses Google's Advanced Protection Program.
Advanced Protection blocks app passwords; supporting that account would
require changing the mailer to OAuth2 or using a transactional email provider.

Important details:

- Do not add quotation marks around values in the Coolify UI.
- Do not add trailing slashes to `CLIENT_ORIGINS`. Keep the current Vercel
  alias in the comma-separated list while it is still used for testing.
- Use the MongoDB **Internal URL**, not a public IP or public URL.
- `EMAIL_PASSWORD` must be the Gmail app password created above, not the
  normal account password or passkey.
- Secrets belong only in Coolify. Never commit a real `.env` file.

Deploy the backend. It connects to MongoDB before it opens port `5000`, so a
bad database URI causes the deployment to remain unhealthy instead of serving
traffic without a database.

## 5. Verify the backend

Wait for Coolify to report the application as healthy, then run:

```bash
curl https://flixdrive-api.minimanx.dev/health
```

Expected response:

```json
{"status":"ok"}
```

Test the Socket.IO handshake and allowed browser origin:

```bash
curl -i \
  -H 'Origin: https://flixdrive.minimanx.dev' \
  'https://flixdrive-api.minimanx.dev/socket.io/?EIO=4&transport=polling'
```

The body should begin with `0{` and the headers should allow
`https://flixdrive.minimanx.dev`.

## 6. Create the Vercel frontend

1. In Vercel, select **Add New**, then **Project**.
2. Import `Minimanx/ExamProject`.
3. Set **Root Directory** to `client`. The repository holds the client and the
   server side by side, so Vercel has to be told which one is the site. This is
   the only build setting that needs changing.
4. Leave **Framework Preset**, **Build Command** and **Output Directory** alone.
   Vercel detects SvelteKit, and `@sveltejs/adapter-vercel` writes Vercel's own
   Build Output format, so the defaults are already correct.
5. Add this Production environment variable:

```dotenv
PUBLIC_API_URL=https://flixdrive-api.minimanx.dev
```

6. Deploy the project.

The `PUBLIC_API_URL` value is embedded into the browser bundle at build time. Always
redeploy the Vercel project after changing it.

## 7. Assign the frontend domain

1. Open the Vercel project's **Settings**, then **Domains**.
2. Add:

```text
flixdrive.minimanx.dev
```

3. `minimanx.dev` already uses Vercel nameservers, so Vercel should create or
   request the specific DNS record for this project.
4. Confirm that the new `flixdrive.minimanx.dev` record targets Vercel. This
   specific record overrides the existing `*.minimanx.dev` wildcard record.
5. Wait for Vercel to show the domain as valid and HTTPS as active.

Do not point `flixdrive-api.minimanx.dev` at Vercel. That hostname must keep
using the wildcard record to reach Coolify.

## 8. Test the complete application

Open `https://flixdrive.minimanx.dev` and test in this order:

1. Open browser developer tools and select the **Network** tab.
2. Create a user and confirm the request goes to
   `https://flixdrive-api.minimanx.dev/users`.
3. Confirm the account-created email arrives.
4. Log in and confirm the response sets a secure `connect.sid` cookie for the
   backend hostname.
5. Reload the page and confirm authenticated actions still work.
6. Search for a movie and create an event.
7. Open the application in a second browser or private window.
8. Confirm cars, theater updates, joining, and chat update in real time.
9. Confirm the invite button copies a `flixdrive.minimanx.dev` URL.
10. In Coolify's MongoDB terminal, confirm that the `FlixDrive` database has
    `users`, `theaters`, and `sessions` collections.

## 9. Configure MongoDB backups

The Docker volume survives container and application redeployments, but it
does not protect against deletion, disk failure, or loss of the server.

1. Open the MongoDB resource's **Backups** page.
2. Add a daily schedule such as `0 2 * * *`.
3. Back up all databases or at least `FlixDrive` and `admin`.
4. Set a retention limit so backups cannot fill the server disk.
5. Run one backup immediately and verify that it completes.
6. Prefer an off-server S3-compatible destination or a separate server disk.
   A backup stored only on the same VPS is not disaster recovery.

Do not remove Atlas until any Atlas data that matters has been exported and
restored into the Coolify MongoDB resource.

## 10. Future deployments

- A push to `main` rebuilds the Vercel frontend and Coolify backend when auto
  deploy is enabled.
- Backend redeployments do not recreate the MongoDB resource or its volume.
- Changes to `PUBLIC_API_URL` require a new Vercel deployment.
- Changes to backend environment variables require a Coolify redeploy.
- Keep MongoDB private; there is no normal reason to expose port `27017`.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| Coolify backend is unhealthy | Backend logs, `MONGODB_URI`, and whether both resources use the same destination |
| `ENOTFOUND` for MongoDB | Copy the Internal URL again and check the Docker hostname |
| Backend returns `503` | MongoDB health, backend health check, and exposed port `5000` |
| Browser reports CORS errors | Add the browser's exact origin to the comma-separated `CLIENT_ORIGINS` value and redeploy the backend |
| Login succeeds but does not persist | Both public URLs must use HTTPS and the frontend must call the configured API URL |
| Socket.IO does not connect | Check `/socket.io/` in Network, Coolify proxy logs, and the exact allowed origin |
| Movie searches fail | Verify that `OMDB_API_KEY` is an activated key from OMDb, then redeploy the backend |
| Email times out | Confirm the deployed code uses `smtp.gmail.com:587`; Hetzner blocks outbound port `465` by default |
| Gmail rejects email login | Verify the Gmail address, two-factor authentication, and app password |
| TLS shows a default/self-signed certificate | Confirm the exact hostname is assigned to the Coolify resource and wait for certificate issuance |

## References

- [Coolify databases](https://coolify.io/docs/databases/)
- [Coolify Nixpacks](https://coolify.io/docs/applications/build-packs/nixpacks)
- [Coolify database backups](https://coolify.io/docs/databases/backups)
- [Coolify domains](https://coolify.io/docs/knowledge-base/domains)
- [Vercel monorepos](https://vercel.com/docs/monorepos)
- [SvelteKit Vercel adapter](https://svelte.dev/docs/kit/adapter-vercel)
- [Socket.IO CORS](https://socket.io/docs/v4/handling-cors/)
- [OMDb API](https://www.omdbapi.com/)
- [OMDb API key registration](https://www.omdbapi.com/apikey.aspx)
- [Hetzner outbound mail ports](https://docs.hetzner.com/cloud/servers/faq/#why-can-i-not-send-any-mails-from-my-server)
- [Nodemailer SMTP transport](https://nodemailer.com/smtp)
