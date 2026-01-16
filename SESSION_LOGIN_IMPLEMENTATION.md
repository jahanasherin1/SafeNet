# Session Login Implementation & API Fixes

## Overview
Implemented persistent session login with automatic authentication on app startup and fixed the location API issue.

## Changes Made

### 1. **Session Context** (`services/SessionContext.tsx`)
- Created a React Context for managing authentication state globally
- Handles user data and token persistence using AsyncStorage
- Provides `useSession()` hook for easy access throughout the app
- Auto-initializes session on app startup
- Methods: `login()`, `logout()`, and session state tracking

### 2. **API Interceptors** (`services/api.ts`)
- Added request interceptor to automatically include auth token in all API calls
- Added response interceptor to handle 401 (unauthorized) responses
- Clears session data when token expires
- Ensures consistent authentication across all API requests

### 3. **Login Screen** (`app/auth/login.tsx`)
- Updated to use `useSession()` hook instead of direct AsyncStorage
- Calls `login()` method to persist session data
- Automatically redirects to dashboard on successful login

### 4. **Location Screen** (`app/dashboard/location.tsx`)
- **Fixed API Issue**: Now sends location data to backend after fetching
- Uses session context to get user email
- Sends location update with proper format: `{ email, latitude, longitude }`
- Gracefully handles backend failures without breaking UI
- Falls back to AsyncStorage if session context unavailable

### 5. **Main Screen** (`app/main/index.tsx`)
- Added session check on component mount
- Auto-redirects logged-in users to dashboard
- Prevents unnecessary re-authentication

### 6. **Profile Screen** (`app/dashboard/profile.tsx`)
- Updated logout to use session context
- Redirects to main screen after logout
- Uses session context for user data with AsyncStorage fallback

### 7. **App Layout** (`app/_layout.tsx`)
- Wrapped entire app with `SessionProvider`
- Ensures session context is available throughout the app

### 8. **Backend Auth** (`backend/routes/auth.js`)
- Updated login endpoint to return a token
- Token format: Base64 encoded `userId:timestamp`
- Returns user object with essential fields only

### 9. **Backend Users Route** (`backend/routes/users.js`)
- Fixed location update endpoint to accept correct parameters
- Now accepts: `{ email, latitude, longitude }`
- Updates user location with server timestamp

## How It Works

### Login Flow
1. User enters credentials and taps login
2. API call to `/auth/login` with email and password
3. Backend returns user data and token
4. Session context saves both to AsyncStorage
5. App automatically redirects to dashboard
6. Token is included in all subsequent API requests

### Session Persistence
1. On app startup, SessionProvider checks AsyncStorage
2. If user and token exist, session is restored
3. User is automatically logged in without re-entering credentials
4. If token expires (401 response), session is cleared

### Location Update
1. User opens location screen
2. App requests location permission
3. Gets current GPS coordinates
4. Sends to backend: `POST /api/user/update-location`
5. Backend updates user's currentLocation with server timestamp

## Testing Checklist

- [ ] Login with valid credentials → redirects to dashboard
- [ ] Close and reopen app → user stays logged in
- [ ] Logout → redirects to main screen
- [ ] Login again → session restored
- [ ] Open location screen → location updates on backend
- [ ] Check user location in database → coordinates saved with timestamp
- [ ] Invalid credentials → shows error message
- [ ] Token expiration → clears session and redirects to login

## Files Modified
- `services/api.ts` - Added interceptors
- `services/SessionContext.tsx` - New file
- `app/_layout.tsx` - Added SessionProvider
- `app/auth/login.tsx` - Uses session context
- `app/main/index.tsx` - Auto-redirect for logged-in users
- `app/dashboard/location.tsx` - Fixed API issue
- `app/dashboard/profile.tsx` - Uses session context for logout
- `backend/routes/auth.js` - Returns token
- `backend/routes/users.js` - Fixed location endpoint

## Notes
- Token is simple Base64 encoding (for production, use JWT)
- Session persists across app restarts
- All API requests automatically include auth token
- Location updates happen silently without blocking UI
