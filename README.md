# WTM

A daily event feed for a small Stanford friend group. Hosted on Vercel Hobby, with shared storage on Neon Free. No paid domain, Luma API, or AI API is required.

## Live site

https://wtm-rn.vercel.app

The group invite code is saved separately in `WTM-access.txt`, outside the project. Share it privately with your friends. People with the code can view events, post and remove plans, and manage calendars. This is a trusted group, not verified Stanford login.

## Browse events

- Discover: browse free events with interest and location filters.
- Your Moves: shared group saves in Neon, ordered by time. Anyone can save/remove a group move. Names beside each event show who marked Going. Each person can change only their own RSVP; a signed browser identity remembers their chosen name. Names are self reported. Interest filters never hide group moves. Previous private saves can be shared with the import button. The page checks for group changes every 30 seconds.
- List: compact rows, with event details on click.
- Calendar: seven days, with events ordered by time within each day. Swipe across days on a phone.
- Cards: images and event descriptions.
- Separate Stanford & nearby, SF, and Everywhere categories.
- Today, Tomorrow and This week; interest filters, search, free admission enforced across all views, and saved events.
- Mobile filters collapse to leave more room for events.

Interest matching uses keyword rules for startups, trading, CS, AI, research, food and drinks. Group events and RSVPs are shared; interest preferences are per browser. Only confirmed free admission and student-accessible events appear. Unknown prices stay hidden; free food does not establish free admission. Luma ticket data is checked for an available, non-member free ticket; sold-out/closed registration and restricted audiences are excluded. Host approval is labeled. Friends must confirm no required attendance cost and student access. This is organizer information, not a guarantee that a host will approve an RSVP.

## Add calendars

Choose **Manage calendars**. Give the calendar a name, paste its iCal subscription link, choose Stanford & nearby or SF, and select **Add & scan calendar**. It imports immediately and joins the daily refresh. You can remove calendars in the same screen. Up to 12 additional feeds can be followed.

Supported feed hosts: Luma (`api.luma.com` and `api.lu.ma`), Google Calendar, Stanford Events, and Outlook. Public Luma event and calendar pages are also supported. Their public page data is read without a paid API; format changes can interrupt verification. `webcal://` links are converted to HTTPS.

Luma: calendar page → Add iCal Subscription → Copy URL.
Google: calendar settings → Integrate calendar → Public address in iCal format.
Stanford and Outlook: copy the calendar's iCal subscription URL.

Use public community calendars. Imported event details are visible to everyone with the group code.

Defaults: Stanford's central events calendar; the AI Club speaker host's public Luma calendar (found through the Alfred Lin event); BASES; SAGA's public Google calendar; HAI's department iCal calendar; Stanford xBuilders; and Luma SF Discover. ASES' public website is checked daily for linked Luma events. AI Club events by other hosts may require adding another calendar or an event link. HAI and SAGA items with no admission evidence remain hidden until confirmed. Stanford xBuilders had no upcoming events when checked on October 3, 2026. Luma's SF Discover feed can include nearby Bay Area events; SF is the feed category, not a guarantee that every venue is within city limits.

Partiful is supported through friends submitting event links and the visible event details. WTM does not scan signed-in Partiful accounts or automatically refresh manually entered Partiful plans. Remove and repost a plan when its details change.

## Discovery and newsletters

Manage calendars → Discovery sources & newsletters shows the source directory. Verified public sources:
- BASES current calendar: https://luma.com/bases26_27 ; mailing list: https://forms.gle/GtdRAYSKeAafjvqi7
- SAGA events: https://saga.stanford.edu/events ; mailing list: https://mngrv.one/saga
- HAI events: https://events.stanford.edu/department/hai/calendar ; newsletter: https://hai.stanford.edu/subscribe-hai-mailing-list
- ASES website and join form: https://ases.stanford.edu/
- AI Club example and speaker host calendar: https://luma.com/r01e3zn0

Optional dedicated Gmail scanning is implemented but **not connected until credentials are set**. Joining a list does not make its messages public. Paste a Luma event from an announcement into Manage calendars to recheck that event daily. Partiful links remain manual plans.

The designated subscription inbox is **wtminbox@gmail.com**. When adding a relevant free mailing-list source, subscribe this inbox through its official signup form, check for an existing signup first, and record the result. Stanford-only lists may require a Stanford address and selective forwarding to this inbox. These third-party forms are handled during source setup; adding a calendar in WTM does not automatically submit a newsletter form. Required CAPTCHA or confirmation steps must be completed before claiming an active subscription.

Subscription status as of October 4, 2026: BASES recorded the signup request; HAI confirmed the Research, News, and Events subscription. SAGA accepted the newsletter contact form with the designated inbox as the personal email and the owner's Stanford address for eligibility; the actual delivery destination remains unverified. The AI Club list is https://mailman.stanford.edu/mailman/listinfo/saic-members and requires CAPTCHA plus email confirmation. ASES's current Join us link opens a bootcamp application, so it is not offered as a newsletter signup in WTM.

## Connect a free dedicated Gmail inbox

1. Create a personal Gmail account just for WTM. Subscribe it to club lists, or forward announcements from your Stanford mailbox when a list requires a Stanford address.
2. Turn on Google 2-Step Verification and create an app password named WTM: https://myaccount.google.com/apppasswords . Some account types do not offer app passwords.
3. In the WTM Vercel project's Production environment variables, set `WTM_INBOX_EMAIL` to that Gmail address and `WTM_INBOX_APP_PASSWORD` to the generated app password. Mark the password Sensitive. Do not paste it into chat or commit it. Redeploy to apply changes.
4. Vercel's existing daily refresh opens INBOX read-only over TLS, scans up to 50 messages from the past 14 days (maximum 256 KiB per message), extracts direct Luma links, and verifies public event registration. No emails are sent, deleted, marked read or displayed to the group. The app password itself grants broader mailbox access than these read-only operations; use the dedicated account.
5. Only confirmed free, student-accessible events appear. Existing discovered links are retained and rechecked; duplicate calendar events are merged. Plain-text announcements with no direct Luma link, tracking-only links, and Partiful invitations currently need manual entry. No paid AI parser is used.

Inbox credentials are server-only. Without them, email scanning stays off and calendars continue normally. Settings show the last inbox scan or a connection error. A successful live inbox scan cannot be tested until the dedicated account is connected.

References: [Google app passwords](https://support.google.com/accounts/answer/185833), [Gmail clients and IMAP](https://support.google.com/mail/answer/7126229).

## Git workflow

Commit and push each completed code change after appropriate checks. Secrets, build outputs and preview data remain ignored. Repository: https://github.com/aaidenko/wtm-rn (private). Push completed changes to origin/main.

## Daily updates

Vercel runs `/api/refresh` once daily at 14:17 UTC: 7:17 a.m. PDT / 6:17 a.m. PST. On Hobby, invocation can occur anywhere within that hour. The job runs on the production deployment, independently of your computer.

The importer fetches every Stanford page for the coming week and each configured feed, then reads public Luma event pages to verify ticket cost, availability and restrictions. Six workers and a bounded deadline keep those checks within the function limit. Calendar settings and event snapshots persist in Neon. A failed feed keeps its last successful events and shows a warning. Stanford refreshes older than 30 hours are marked overdue. A new calendar scans immediately. Old friend plans are cleaned up after 30 days.

Organizers remain the source of truth for event changes, availability, registration and admission. Follow the event link before attending.

## Develop and deploy

`npm install`, `npm test`, and `npm run build`.

Required server-only production variables: `DATABASE_URL` (provided by Neon), `GROUP_CODE` (at least 8 characters), and `CRON_SECRET` (separate random secret, at least 32 characters). Never put these in browser code or commit them. The tables initialize automatically on first use.

Deploy the project with Vercel CLI or a Git repository. Framework: Other. Build: `npm run build`. Output: `dist`. The configuration includes the daily job. Stay on Vercel Hobby and Neon Free; do not enable paid upgrades.

A local preview is available by serving `public` and opening `?preview=1` on localhost. Preview plans and calendar settings stay in that browser; production writes use Neon. Preview data is excluded from the deployment. Source tests cover times, matching, pagination, feed parsing, safe calendar URLs and region filtering.

Free plans have usage caps and can interrupt service at their limits. This app is intended for a small personal group. No paid services were selected during setup.

References: [Stanford API](https://events-help.stanford.edu/programmatic-connections), [Luma feeds](https://help.luma.com/p/ical-syncing), [Vercel daily job limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Neon on Vercel](https://vercel.com/marketplace/neon).
