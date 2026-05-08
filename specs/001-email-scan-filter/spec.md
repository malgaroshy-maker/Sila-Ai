# Email Scan Filter Setting

## Summary
Add a setting to control whether the email CV scanner reads only unread emails or all emails (including read). Defaults to "Unread Only".

## Motivation
Currently the email processor only fetches unread emails with CV attachments. Users may want to re-scan already-read emails that were missed or skipped previously.

## Behavior
- **Unread Only** (default): Only scans unread emails — same as current behavior
- **All Emails**: Scans both read and unread emails for CV attachments

## Scope
- Backend: `email-processor.service.ts` — conditionally include/exclude read-status filter for Gmail and Microsoft Graph
- Frontend: `SettingsModal.tsx` — dropdown in Data & Sync section
- Bilingual translations (EN/AR)

## Out of Scope
- No database schema changes (uses existing key-value `settings` table)
- No changes to email sending or auth flows
- No changes to sync frequency or other sync behavior
