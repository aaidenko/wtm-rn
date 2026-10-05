# Security and privacy

## Deployment boundary

Publishing this repository does not publish the production database or grant access to the live group. All deployment secrets must stay in server environment variables. `.env.example` contains placeholders; local environment files, build outputs, preview data and Vercel project metadata are ignored.

WTM uses a shared invite code for a small trusted group. Names are self-reported and identified by signed browser cookies. This is not verified university login or a production multi-tenant authorization system. Group members can manage calendars, save or unsave events, and remove friend plans. Do not distribute the production invite code in an issue, README or screenshot.

The invite endpoint has no application-level attempt limiter. A strong random code is important; review authentication and rate limiting before opening an instance to a broad audience. Rotating `GROUP_CODE` invalidates existing group and member cookies.

## Integrations and stored data

- Calendar imports validate supported HTTPS hosts and reject credentials and nonstandard ports. Follow public community calendars; submitted source URLs and imported events are shared with the group.
- A dedicated Gmail account limits the scope of mailbox access. The scanner opens INBOX read-only and extracts event links. Its app password grants broader account access than the scanner uses, so never use a personal primary inbox.
- Photon webhooks verify HMAC over the raw request bytes with a timestamp window. Pairing codes expire after ten minutes and are consumed atomically. Unlinked users cannot query the feed or invoke Gemini.
- Agent jobs include incoming prompt and phone routing data and are deleted by a successful daily refresh after seven days. If refresh is interrupted, cleanup is delayed. Sender identifiers in linked state are hashed. Disconnecting removes the link, but pending job records remain subject to cleanup.
- Gemini receives the user's prompt and public event metadata, not phone numbers, secrets or the attendance roster. A prompt can itself contain personal information. Free-tier content may be used by the provider to improve products.
- Provider timeouts can cause duplicate outbound replies. Daily recovery is bounded; failed messages are not guaranteed to be retried immediately.

## Reporting a concern

Do not include live credentials, phone numbers, private messages or mailbox contents in public issues. For a sensitive report, contact the repository owner privately through an existing contact channel. If no private channel is available, request one without publishing vulnerability details.

If a credential is exposed, revoke or rotate it at its provider first; deleting a file or commit does not invalidate an exposed credential. Keep credentials out of both files and Git history.
