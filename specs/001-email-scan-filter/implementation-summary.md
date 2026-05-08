# Implementation Summary

## What Changed
Added an "Email Scan Filter" setting that lets users choose between scanning only unread emails or all emails for CV attachments. Default is "Unread Only" to preserve existing behavior.

## Files Changed (4)

| File | Changes |
|------|---------|
| `backend-api/src/email/email-processor.service.ts` | Read `email_scan_filter` setting; conditionally include `is:unread`/`isRead eq false` in Gmail/MS Graph queries |
| `frontend-web/src/components/SettingsModal.tsx` | Added `emailScanFilter` state, dropdown in Data & Sync section, wired to batch API |
| `frontend-web/messages/en.json` | 3 new translation keys |
| `frontend-web/messages/ar.json` | 3 Arabic translation keys |

## Backward Compatibility
Fully backward compatible. No database migration needed. The `email_scan_filter` key defaults to `'unread'` when absent from the settings table, maintaining existing behavior.

## Testing
- Backend lint: No new errors
- Frontend lint: No new errors
- The feature is a conditional query change — the CV ingestion pipeline (`ingestCandidate` → `analyzeForAllJobs`) is untouched
