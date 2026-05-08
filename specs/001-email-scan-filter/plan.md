# Implementation Plan

## Files Modified

### 1. `backend-api/src/email/email-processor.service.ts`
- **Line 136**: Read `email_scan_filter` from settings map (default `'unread'`)
- **Line 165-168**: Pass `emailScanFilter` to `processGoogleAccount()`
- **Line 171-174**: Pass `emailScanFilter` to `processMicrosoftAccount()`
- **Line 196-199**: `processGoogleAccount()` accepts third param `emailScanFilter = 'unread'`
- **Line 224**: Gmail query conditionally includes `is:unread `
- **Line 519-522**: `processMicrosoftAccount()` accepts third param `emailScanFilter = 'unread'`
- **Line 541**: Graph API filter conditionally includes `isRead eq false and `

### 2. `frontend-web/src/components/SettingsModal.tsx`
- **Line 38**: State: `const [emailScanFilter, setEmailScanFilter] = useState<'unread' | 'all'>('unread')`
- **Line 84**: Fetch: `setEmailScanFilter(data.email_scan_filter || 'unread')`
- **Line 154**: Save: `email_scan_filter: emailScanFilter`
- **Lines 512-522**: UI dropdown with "Unread Only" / "All Emails" options

### 3. `frontend-web/messages/en.json`
- `email_scan_filter`, `email_scan_unread`, `email_scan_all`

### 4. `frontend-web/messages/ar.json`
- Arabic translations for the same keys

## Settings Table Key
- `email_scan_filter`: `'unread'` | `'all'`
