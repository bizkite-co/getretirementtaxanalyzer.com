# Testimonials/Feedback intake (Apps Script)

Replaces `formsubmit.co`. Confirmed via direct testing (2026-09-29): that
service returned HTTP 500 for every submission before *and* after
activating the account, and the activation flow itself was broken (blank
confirmation page, "invalid link" on retry, no way to log in and review
history). No prior submission is recoverable from it. Nobody here has an
account with them; don't reintroduce a dependency on it.

## What this is

`Code.gs` is bound to a Google Sheet you own (`bizkitellc@gmail.com`). Each
form submission becomes one row, plus an email notification via `MailApp`
(your own Gmail quota — not a third party). The Sheet is queryable
directly, or via the Sheets API, at any time.

## Deploy (one-time, manual — Google requires this click-through)

1. Create a new Google Sheet (any name, e.g. "RTA Testimonials").
2. Extensions → Apps Script.
3. Delete the default `myFunction() {}` stub, paste in the contents of
   `Code.gs`.
4. Run → `testDoPost` once, to authorize the script and confirm it can
   write to the Sheet and send mail without needing a real HTTP round-trip
   yet. Check the Sheet gained a "Submissions" tab with a smoke-test row,
   and check the Apps Script "Executions" log for errors.
5. Deploy → New deployment → type **Web app** → Execute as: **Me**,
   Who has access: **Anyone** → Deploy.
6. Copy the resulting `.../exec` URL.
7. In `src/assets/script.js`, replace `FEEDBACK_ENDPOINT`'s placeholder
   value with that URL.
8. Re-verify with a real curl POST before considering this done — see
   below.

## Verifying after deploy

```bash
curl -s -X POST "<the /exec URL>" \
  -H "Content-Type: text/plain;charset=utf-8" \
  -d '{"name":"Verify Test","firm":"Test","email":"test@example.com","message":"Post-deploy verification.","permission_to_quote":"No","utm_source":"test","utm_medium":"test","utm_campaign":"test","utm_content":"verify","utm_term":"verify","page_url":"https://getretirementtaxanalyzer.com/testimonials/"}'
```

Expect `{"success":true}` and a new row in the Sheet. If you get a
redirect/HTML response instead of JSON, the deployment's access setting
probably isn't "Anyone" — check step 5.

## Why `text/plain`, not `application/json`

Apps Script Web Apps don't implement a CORS-preflight (`OPTIONS`) handler.
A `fetch()` with `Content-Type: application/json` is a "non-simple"
request under the CORS spec and triggers a preflight — which Apps Script
has no handler for, so the real POST is never sent and the browser reports
a CORS failure. `text/plain` is a "simple request" and skips preflight
entirely; `doPost()` still parses the body as JSON regardless of the
declared content type.
