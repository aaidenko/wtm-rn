# WTM

A daily event feed for a small Stanford friend group. Hosted on Vercel Hobby, with shared storage on Neon Free. No paid domain, Luma API, or AI API is required.

## Live site

https://wtm-rn.vercel.app

The group invite code is saved separately in `WTM-access.txt`, outside the project. Share it privately with your friends. People with the code can view events, post and remove plans, and manage calendars. This is a trusted group, not verified Stanford login.

## Browse events

- List: compact rows, with event details on click.
- Calendar: seven days, with events ordered by time within each day. Swipe across days on a phone.
- Cards: images and event descriptions.
- Separate Stanford & nearby, SF, and Everywhere categories.
- Today, Tomorrow and This week; interest filters, search, free-entry filter, and saved events.
- Mobile filters collapse to leave more room for events.

Interest matching uses keyword rules for startups, trading, CS, AI, research, food and drinks. Saved events and interest preferences are per browser. WTM only labels free entry when the source explicitly confirms it; food being mentioned does not mean it is free.

## Add calendars

Choose **Manage calendars**. Give the calendar a name, paste its iCal subscription link, choose Stanford & nearby or SF, and select **Add & scan calendar**. It imports immediately and joins the daily refresh. You can remove calendars in the same screen. Up to 12 additional feeds can be followed.

Supported feed hosts: Luma (`api.luma.com` and `api.lu.ma`), Google Calendar, Stanford Events, and Outlook. Normal event or calendar webpages are not iCal feeds. `webcal://` links are converted to HTTPS.

Luma: calendar page → Add iCal Subscription → Copy URL.
Google: calendar settings → Integrate calendar → Public address in iCal format.
Stanford and Outlook: copy the calendar's iCal subscription URL.

Use public community calendars. Imported event details are visible to everyone with the group code.

Defaults: Stanford's central events calendar, Stanford xBuilders on Luma, and Luma's San Francisco Discover feed. Stanford xBuilders had no upcoming events when checked on October 3, 2026. Luma's SF Discover feed can include nearby Bay Area events; SF is the feed category, not a guarantee that every venue is within city limits.

Partiful is supported through friends submitting event links and the visible event details. WTM does not scan signed-in Partiful accounts or automatically refresh manually entered Partiful plans. Remove and repost a plan when its details change.

## Daily updates

Vercel runs `/api/refresh` once daily at 14:17 UTC: 7:17 a.m. PDT / 6:17 a.m. PST. On Hobby, invocation can occur anywhere within that hour. The job runs on the production deployment, independently of your computer.

The importer fetches every Stanford page for the coming week and each configured feed. Calendar settings and event snapshots persist in Neon. A failed feed keeps its last successful events and shows a warning. Stanford refreshes older than 30 hours are marked overdue. A new calendar scans immediately. Old friend plans are cleaned up after 30 days.

Organizers remain the source of truth for event changes, availability, registration and admission. Follow the event link before attending.

## Develop and deploy

`npm install`, `npm test`, and `npm run build`.

Required server-only production variables: `DATABASE_URL` (provided by Neon), `GROUP_CODE` (at least 8 characters), and `CRON_SECRET` (separate random secret, at least 32 characters). Never put these in browser code or commit them. The tables initialize automatically on first use.

Deploy the project with Vercel CLI or a Git repository. Framework: Other. Build: `npm run build`. Output: `dist`. The configuration includes the daily job. Stay on Vercel Hobby and Neon Free; do not enable paid upgrades.

A local preview is available by serving `public` and opening `?preview=1` on localhost. Preview plans and calendar settings stay in that browser; production writes use Neon. Preview data is excluded from the deployment. Source tests cover times, matching, pagination, feed parsing, safe calendar URLs and region filtering.

Free plans have usage caps and can interrupt service at their limits. This app is intended for a small personal group. No paid services were selected during setup.

References: [Stanford API](https://events-help.stanford.edu/programmatic-connections), [Luma feeds](https://help.luma.com/p/ical-syncing), [Vercel daily job limits](https://vercel.com/docs/cron-jobs/usage-and-pricing), [Neon on Vercel](https://vercel.com/marketplace/neon).
