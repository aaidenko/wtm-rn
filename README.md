# WTM

A daily event feed for a small Stanford friend group. Hosted on Vercel Hobby, with shared storage on Neon Free. No paid domain, Luma API, or AI API is required.

## Live site

https://wtm-rn.vercel.app

The group invite code is saved separately in `WTM-access.txt`, outside the project. Share it privately with your friends. People with the code can view events, post and remove plans, and manage calendars. This is a trusted group, not verified Stanford login.

## Browse events

- Discover: browse free events with interest and location filters.
- Your Moves: shared group saves in Neon, ordered by time. Tap an outlined star to save for everyone, or a filled star to remove it. Saving keeps the event layout unchanged. Previous private saves can be shared with the import button. Interest filters never hide group moves. The page checks for group changes every 30 seconds.
- Sort by Relevant tags (number matching selected interests, with date as the tie breaker) or Date (soonest first).
- List: compact rows, with event details on click.
- Calendar: seven days, with events ordered by time within each day. Swipe across days on a phone.
- Cards: images and event descriptions.
- Separate Stanford & nearby, SF, and Everywhere categories.
- Today, Tomorrow and This week; interest filters, search, free admission enforced across all views, and saved events.
- Mobile filters collapse to leave more room for events.

Interest matching uses keyword rules for startups, trading, CS, AI, research, food and drinks. Group saves are shared; interest preferences are per browser. Only confirmed free admission and student-accessible events appear. Unknown prices stay hidden; free food does not establish free admission. Luma ticket data is checked for an available, non-member free ticket; sold-out/closed registration and restricted audiences are excluded. Host approval is labeled. Friends must confirm no required attendance cost and student access. This is organizer information, not a guarantee that a host will approve an RSVP.

## Add calendars

Choose **Manage calendars**. Give the calendar a name, paste its iCal subscription link, choose Stanford & nearby or SF, and select **Add & scan calendar**. It imports immediately and joins the daily refresh. You can remove calendars in the same screen. Up to 12 additional feeds can be followed.

Supported feed hosts: Luma (`api.luma.com` and `api.lu.ma`), Google Calendar, Stanford Events, and Outlook. Public Luma event and calendar pages are also supported. Their public page data is read without a paid API; format changes can interrupt verification. `webcal://` links are converted to HTTPS.

Luma: calendar page → Add iCal Subscription → Copy URL.
Google: calendar settings → Integrate calendar → Public address in iCal format.
Stanford and Outlook: copy the calendar's iCal subscription URL.

Use public community calendars. Imported event details are visible to everyone with the group code.

Stanford calendar entries with unknown admission and a student-accessible audience also have their official event page checked for the explicit **Free Event** ticket label. This handles listings whose API free flag disagrees with the website; listed prices are never overridden. Page checks use six workers with a 30-second deadline, and failed checks stay hidden.

Defaults: Stanford's central events calendar; the AI Club speaker host's public Luma calendar (found through the Alfred Lin event); BASES; SAGA's public Google calendar; HAI's department iCal calendar; Stanford xBuilders; and Luma SF Discover. ASES' public website is checked daily for linked Luma events. AI Club events by other hosts may require adding another calendar or an event link. HAI and SAGA items with no admission evidence remain hidden until confirmed. Stanford xBuilders had no upcoming events when checked on October 3, 2026. Luma's SF Discover feed can include nearby Bay Area events; SF is the feed category, not a guarantee that every venue is within city limits.

Partiful is supported through friends submitting event links and the visible event details. WTM does not scan signed-in Partiful accounts or automatically refresh manually entered Partiful plans. Remove and repost a plan when its details change.

## Discovery and newsletters

Manage calendars → Discovery sources & newsletters shows the source directory. Verified public sources:
- BASES current calendar: https://luma.com/bases26_27 ; mailing list: https://forms.gle/GtdRAYSKeAafjvqi7
- SAGA events: https://saga.stanford.edu/events ; mailing list: https://mngrv.one/saga
- HAI events: https://events.stanford.edu/department/hai/calendar ; newsletter: https://hai.stanford.edu/subscribe-hai-mailing-list
- ASES website and join form: https://ases.stanford.edu/
- AI Club example and speaker host calendar: https://luma.com/r01e3zn0

Dedicated Gmail scanning is connected and was verified with a successful production scan on October 4, 2026. Joining a list does not make its messages public. Paste a Luma event from an announcement into Manage calendars to recheck that event daily. Most Partiful links still need manual plans; The Cards scanner can read public structured event data but hides events with unverified admission or student access.

The designated subscription inbox is **wtminbox@gmail.com**. When adding a relevant free mailing-list source, subscribe this inbox through its official signup form, check for an existing signup first, and record the result. Stanford-only lists may require a Stanford address and selective forwarding to this inbox. These third-party forms are handled during source setup; adding a calendar in WTM does not automatically submit a newsletter form. Required CAPTCHA or confirmation steps must be completed before claiming an active subscription.

Subscription status as of October 4, 2026: BASES recorded the signup request; HAI confirmed the Research, News, and Events subscription. SAGA accepted the newsletter contact form with the designated inbox as the personal email and the owner's Stanford address for eligibility; the actual delivery destination remains unverified. The AI Club list is https://mailman.stanford.edu/mailman/listinfo/saic-members and requires CAPTCHA plus email confirmation. ASES's current Join us link opens a bootcamp application, so it is not offered as a newsletter signup in WTM.

The Cards is scanned daily from https://ose.stanford.edu/cards and the current edition embedded by ASSU at https://itc.joshuabahk.workers.dev/ . Up to 32 linked event pages are checked with four workers under a 25-second deadline; a linked organizer page may be followed one additional hop to a supported event page. Supported public pages include Luma, Partiful, Stanford Events, Arbor Live, Hoover, Monarch and Dancebreak. Luma uses native ticket checks; other pages require public structured event data with explicit dates, free admission and student access. Old/ambiguous headings, unknown costs, sold-out offers, private pages, Google Drive flyers and unstructured signup forms are not imported as verified events. Source reports count checked, unverified, unsupported and skipped links. The Cards subscription form for 2026–27 is https://forms.gle/SD7SmT3xv9Ew2M1i8 and uses the signed-in Google account; the owner reported completing the WTM-inbox signup on October 4, 2026. Do not submit a duplicate signup.

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

Commit and push each completed code change after appropriate checks. Secrets, build outputs and preview data remain ignored. Repository: https://github.com/aaidenko/wtm-rn (private). Push completed changes to origin/main.

Vercel is connected to this repository. Pushes to main trigger automatic production builds and deployment to https://wtm-rn.vercel.app . Verify the deployment for the pushed commit is READY before reporting a live update; routine changes do not require a separate manual deployment. Gmail credentials remain server-only in Vercel.

Friend plans can span multiple days within the next 90 days. Their end must be after the start and still in the future. Calendar day filters include every date the plan overlaps; an end at midnight does not occupy the following day. Form errors identify the invalid field, and date/time inputs use Stanford time.

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
