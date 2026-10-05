# Setup and operations

A daily event feed for a small Stanford friend group. Hosted on Vercel Hobby, with shared storage on Neon Free. No paid domain, Luma API, or AI API is required.

## Live site

https://wtm-rn.vercel.app

Set your own `GROUP_CODE` in the deployment environment and share it privately with your group. People with the code can view events, post and remove plans, and manage calendars. This is a trusted group, not verified Stanford login.

## Browse events

- Discover: browse free events with interest and location filters.
- Your Moves: shared group saves in Neon, ordered by time. Tap an outlined star to save for everyone, or a filled star to remove it. Saving keeps the event layout unchanged. Open a saved event to mark yourself attending; your name and the other attendees appear only in the event details. Tap the attending button again to remove yourself. Names are remembered with a signed browser cookie and can be edited inside that dialog. Previous private saves can be shared with the import button. Interest filters never hide group moves. The page checks for group changes every 30 seconds while visible, pauses in hidden tabs, and refreshes on returning.
- Sort by Relevant tags (number matching selected interests, with date as the tie breaker) or Date (soonest first).
- List: compact rows, with event details on click.
- Calendar: a day, seven days or the next 30 days, with events ordered by time within each day. Swipe across days on a phone.
- Cards: images and event descriptions.
- Separate Stanford & nearby, SF, and Everywhere categories.
- Today, Tomorrow, This week and Next 30 days; interest filters, search, free admission enforced across all views, and saved events.
- Mobile filters collapse to leave more room for events.

Interest matching uses keyword rules for startups, trading, CS, AI, research, food and drinks. Group saves are shared; interest preferences are per browser. Only confirmed free admission and student-accessible events appear. Unknown prices stay hidden; free food does not establish free admission. Luma ticket data is checked for an available, non-member free ticket; sold-out/closed registration and restricted audiences are excluded. Host approval is labeled. Friend plans default to free and accessible to Stanford students when submitted; the posting form has no admission confirmation checkboxes. This is organizer information, not a guarantee that a host will approve an RSVP.

## Add calendars

Choose **Manage calendars**. Give the calendar a name, paste its iCal subscription link, choose Stanford & nearby or SF, and select **Add & scan calendar**. It imports immediately and joins the daily refresh. You can remove calendars in the same screen. Up to 12 additional feeds can be followed.

Supported feed hosts: Luma (`api.luma.com` and `api.lu.ma`), Google Calendar, Stanford Events, and Outlook. Public Luma event and calendar pages are also supported. Their public page data is read without a paid API; format changes can interrupt verification. `webcal://` links are converted to HTTPS.

Luma: calendar page → Add iCal Subscription → Copy URL.
Google: calendar settings → Integrate calendar → Public address in iCal format.
Stanford and Outlook: copy the calendar's iCal subscription URL.

Use public community calendars. Imported event details are visible to everyone with the group code.

Stanford calendar entries with unknown admission and a student-accessible audience also have their official event page checked for the explicit **Free Event** ticket label. This handles listings whose API free flag disagrees with the website; listed prices are never overridden. Page checks use six workers with a 60-second deadline, and failed checks stay hidden.

Defaults: Stanford's central events calendar; the AI Club speaker host's public Luma calendar (found through the Alfred Lin event); BASES; SAGA's public Google calendar; HAI's department iCal calendar; Stanford xBuilders; and Luma SF Discover. ASES' public website is checked daily for linked Luma events. AI Club events by other hosts may require adding another calendar or an event link. HAI and SAGA items with no admission evidence remain hidden until confirmed. Luma's SF Discover feed can include nearby Bay Area events; SF is the feed category, not a guarantee that every venue is within city limits.

Partiful is supported through friends submitting event links and the visible event details. WTM does not scan signed-in Partiful accounts or automatically refresh manually entered Partiful plans. Remove and repost a plan when its details change.

## Discovery and newsletters

Manage calendars → Discovery sources & newsletters shows the source directory. Verified public sources:
- BASES current calendar: https://luma.com/bases26_27 ; mailing list: https://forms.gle/GtdRAYSKeAafjvqi7
- SAGA events: https://saga.stanford.edu/events ; mailing list: https://mngrv.one/saga
- HAI events: https://events.stanford.edu/department/hai/calendar ; newsletter: https://hai.stanford.edu/subscribe-hai-mailing-list
- ASES website and join form: https://ases.stanford.edu/
- AI Club example and speaker host calendar: https://luma.com/r01e3zn0

Joining a list does not make its messages public. Paste a Luma event from an announcement into Manage calendars to recheck that event daily. Most Partiful links still need manual plans; The Cards scanner can read public structured event data but hides events with unverified admission or student access.

The Cards is scanned daily from https://ose.stanford.edu/cards and the current edition embedded by ASSU at https://itc.joshuabahk.workers.dev/ . Up to 32 linked event pages are checked with four workers under a 25-second deadline; a linked organizer page may be followed one additional hop to a supported event page. Supported public pages include Luma, Partiful, Stanford Events, Arbor Live, Hoover, Monarch and Dancebreak. Luma uses native ticket checks; other pages require public structured event data with explicit dates, free admission and student access. Old/ambiguous headings, unknown costs, sold-out offers, private pages, Google Drive flyers and unstructured signup forms are not imported as verified events. Source reports count checked, unverified, unsupported and skipped links. The Cards subscription form uses the signed-in Google account; subscribe a dedicated inbox when setting up your own instance.

Any group member can add a supported calendar under Manage calendars; adding it scans immediately and includes it in subsequent daily refreshes. Newsletters can subscribe or forward to the dedicated inbox: once messages arrive, the existing daily inbox scan picks up their direct Luma links without needing a per-newsletter code change. Newsletter confirmations and signups are provider-specific and are not submitted automatically by Vercel.

## Connect a free dedicated Gmail inbox

1. Create a personal Gmail account just for WTM. Subscribe it to club lists, or forward announcements from your Stanford mailbox when a list requires a Stanford address.
2. Turn on Google 2-Step Verification and create an app password named WTM: https://myaccount.google.com/apppasswords . Some account types do not offer app passwords.
3. In the WTM Vercel project's Production environment variables, set `WTM_INBOX_EMAIL` to that Gmail address and `WTM_INBOX_APP_PASSWORD` to the generated app password. Mark the password Sensitive. Do not paste it into chat or commit it. Redeploy to apply changes.
4. Vercel's existing daily refresh opens INBOX read-only over TLS, scans up to 50 messages from the past 14 days (maximum 256 KiB per message), extracts direct Luma links, and verifies public event registration. No emails are sent, deleted, marked read or displayed to the group. The app password itself grants broader mailbox access than these read-only operations; use the dedicated account.
5. Only confirmed free, student-accessible events appear. Existing discovered links are retained and rechecked; duplicate calendar events are merged. Plain-text announcements with no direct Luma link, tracking-only links, and Partiful invitations currently need manual entry. No paid AI parser is used.

Inbox credentials are server-only. Without them, email scanning stays off and calendars continue normally. Settings show the last inbox scan or a connection error. A successful live inbox scan cannot be tested until the dedicated account is connected.

References: [Google app passwords](https://support.google.com/accounts/answer/185833), [Gmail clients and IMAP](https://support.google.com/mail/answer/7126229).

## Git workflow

Commit and push each completed code change after appropriate checks. Secrets, build outputs and preview data remain ignored. Repository: https://github.com/aaidenko/wtm-rn. Push completed changes to origin/main.

Vercel is connected to this repository. Pushes to main trigger automatic production builds and deployment to https://wtm-rn.vercel.app . Verify the deployment for the pushed commit is READY before reporting a live update; routine changes do not require a separate manual deployment. Gmail credentials remain server-only in Vercel.

Friend plans can span multiple days within the next 90 days. Their end must be after the start and still in the future. Calendar day filters include every date the plan overlaps; an end at midnight does not occupy the following day. Form errors identify the invalid field, and date/time inputs use Stanford time.

## Daily updates

Vercel runs `/api/refresh` once daily at 14:17 UTC: 7:17 a.m. PDT / 6:17 a.m. PST. On Hobby, invocation can occur anywhere within that hour. The job runs on the production deployment, independently of your computer.

The importer fetches every Stanford page for the next 30 days and each configured feed, then reads public Luma event pages to verify ticket cost, availability and restrictions. Six workers and a bounded deadline keep those checks within the function limit. Calendar settings and event snapshots persist in Neon. A failed feed keeps its last successful events and shows a warning. Stanford refreshes older than 30 hours are marked overdue. A new calendar scans immediately. Old friend plans are cleaned up after 30 days.

Organizers remain the source of truth for event changes, availability, registration and admission. Follow the event link before attending.

## Develop and deploy

`npm install`, `npm test`, and `npm run build`.

Required server-only production variables: `DATABASE_URL` (provided by Neon), `GROUP_CODE` (at least 8 characters), and `CRON_SECRET` (separate random secret, at least 32 characters). Never put these in browser code or commit them. The tables initialize automatically on first use.

Deploy the project with Vercel CLI or a Git repository. Framework: Other. Build: `npm run build`. Output: `dist`. The configuration includes the daily job. Stay on Vercel Hobby and Neon Free; do not enable paid upgrades.

Generate fictional events with `npm run demo`. A local preview is available by serving `public` and opening `?preview=1` on localhost. Preview plans and calendar settings stay in that browser; production writes use Neon. Preview data is excluded from the deployment. Source tests cover times, matching, pagination, feed parsing, safe calendar URLs and region filtering.

Free plans have usage caps and can interrupt service at their limits. This app is intended for a small personal group. No paid services were selected during setup.

References: [Stanford API](https://events-help.stanford.edu/programmatic-connections), [Luma feeds](https://help.luma.com/p/ical-syncing), [Vercel daily job limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Neon on Vercel](https://vercel.com/marketplace/neon).

Admission checks persist as public metadata in Neon. Events more than three days away reuse checks for up to 72 hours; events within three days reuse for at most 20 hours and are therefore rechecked by each daily scan. Luma ticket validity windows are evaluated again when cached data is used, and changing feed start dates invalidate that check. Failed checks are not cached; expired checks never establish free admission. The cache holds at most 1,200 entries and does not contain raw emails or credentials. Feed scans still run daily, with a 180-second function limit on the project’s enabled Fluid Compute. Stanford pagination is bounded to 50 pages, downloaded six at a time. The scan precomputes its campus/website event list for subsequent feed reads; group saves and friend plans remain live database reads.

## Photon DM agent (Stable)

WTM has a cloud-only iMessage agent: Photon hosts messaging, Vercel receives signed webhooks and runs the agent, Neon stores linked identities and jobs, and Gemini interprets casual prompts. No Mac or separate always-on agent server is required. Photon’s Free plan supports up to 10 DM users; keep Photon and Google AI Studio on free plans, with Google billing disabled. Gemini free-tier content may be used by Google to improve products. There is no paid model fallback.

To activate:

1. Create a free Photon project at https://photon.codes, enable its shared iMessage line and add your test users. Get the Stable project ID and project secret (not a local server token).
2. Set `SPECTRUM_PROJECT_ID` and `SPECTRUM_PROJECT_SECRET` as production Vercel environment variables. Set `GEMINI_API_KEY` from https://aistudio.google.com/api-keys. The default model is `gemini-3.5-flash-lite`; `GEMINI_MODEL` can override it.
3. Register `https://wtm-rn.vercel.app/api/photon` as a native Spectrum webhook. The Stable registration API is `POST https://spectrum.photon.codes/projects/{projectId}/webhooks/`, HTTP Basic auth with project ID and project secret, JSON body `{"webhookUrl":"https://wtm-rn.vercel.app/api/photon"}`. The response returns `data.signingSecret` once: save it directly as `SPECTRUM_WEBHOOK_SECRET`. Never paste credentials into chat, source code or a URL.
4. Redeploy after saving environment variables. Open https://wtm-rn.vercel.app/agent.html, enter your WTM name, generate a one-use 10-minute link code, and text the displayed command to your assigned Photon iMessage contact. The contact is assigned through Photon; WTM does not provision or initiate unsolicited conversations.

Prompts: “AI events tomorrow”, “food tonight”, “saved”, “save the second one”, “details 2”, “I’m attending that”, or “Add pizza at Tresidder tomorrow 6–7pm”. Adding a plan requires a title, place, future start and end; it follows the website’s free student plan policy. Listing, saved events, numbered save/unsave/attendance and help commands work even without a model key. There are no arbitrary code execution, mailing-list signup, paid event, deletion or site administration tools. Attendance only changes the linked member; use the same browser identity as your existing WTM attendance. Each request handles one intent; multiple requested changes require separate messages. The agent remembers its last numbered results, not a full conversation transcript.

Security and delivery: verify HMAC over original bytes with a five-minute timestamp window; ignore non-text messages, outbound echoes and groups. Unlinked users cannot read the feed or spend AI tokens. Pairing codes are hashed and consumed atomically. Inbound message IDs deduplicate jobs, and database mutations plus stored replies commit in one transaction. Messages from a linked sender are serialized. `waitUntil` keeps Vercel alive after acknowledging the webhook. Failed replies remain available for a duplicate delivery or the daily scan’s bounded recovery pass (up to two jobs); this is not an immediate retry guarantee. A provider timeout after successful delivery can still produce a duplicate outbound reply, since Photon’s send pipeline has no WTM-controlled idempotency key. Jobs (including prompt/phone routing information) are deleted after seven days; failed jobs older than 24 hours are not resent. Gemini receives the prompt and public event metadata, not phone numbers, secrets, or the attendance roster. Each linked sender is capped at 30 prompts/hour. Disconnect from the setup page or text `disconnect`.

Official Stable contracts: https://photon.codes/docs/webhooks/events, https://photon.codes/docs/webhooks/verifying-signatures, https://photon.codes/docs/spectrum-ts/providers/imessage/connection-and-routing.
