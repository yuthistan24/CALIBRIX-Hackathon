# Mobile Device Integration Guide - MindGuard PWA

## Overview
MindGuard is a Progressive Web App (PWA) that can be installed on mobile devices and access native device features through web APIs.

## Installation on Mobile

### Android (Chrome)
1. Open `http://localhost:3000` (or your server URL) in Chrome
2. Tap the menu (⋮) → "Add to Home screen"
3. Name it "MindGuard" and tap "Add"
4. The app icon appears on your home screen
5. Launch from home screen for full-screen experience

### iOS (Safari)
1. Open the site in Safari
2. Tap the Share button (□↑)
3. Scroll and tap "Add to Home Screen"
4. Name it "MindGuard" and tap "Add"
5. Launch from home screen

## Device Features Available

### 1. Voice Recording (Self-Introduction)
**How it works:**
- Uses `navigator.mediaDevices.getUserMedia()` to access microphone
- Records audio using `MediaRecorder` API
- Uses `SpeechRecognition` API for live transcription
- Works offline once page is loaded

**Permissions needed:**
- Microphone access (browser will prompt)

**Usage:**
1. Go to AI Chat page
2. Scroll to "3-minute self-introduction"
3. Tap "Start Recording"
4. Speak for up to 3 minutes
5. Tap "Stop" when done
6. Review transcript (edit if needed)
7. Tap "Analyze Needs" to get AI analysis

**What it captures:**
- Your spoken words (converted to text)
- Duration of recording
- Audio file (stored locally in browser)

**Privacy:**
- Audio stays in your browser
- Only text transcript is sent to server for analysis
- No audio files uploaded unless you explicitly share

### 2. Device Motion & Activity
**Available APIs:**
```javascript
// Accelerometer
const sensor = new Accelerometer({ frequency: 60 });
sensor.addEventListener('reading', () => {
  console.log(sensor.x, sensor.y, sensor.z);
});

// Step Counter (Android only)
const stepCounter = new StepCounter();
stepCounter.addEventListener('reading', () => {
  console.log(stepCounter.steps);
});
```

**Current Implementation:**
- Manual sync form on dashboard
- Enter steps, sleep, screen time manually
- Future: Auto-sync with device sensors

### 3. Geolocation
**For finding nearby counselors/hospitals:**
```javascript
navigator.geolocation.getCurrentPosition((position) => {
  const lat = position.coords.latitude;
  const lon = position.coords.longitude;
  // Find nearby resources
});
```

### 4. Camera (Future Feature)
**For mood tracking via photos:**
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ 
  video: { facingMode: 'user' } 
});
// Capture selfie for mood analysis
```

### 5. Notifications
**For daily check-in reminders:**
```javascript
Notification.requestPermission().then(permission => {
  if (permission === 'granted') {
    new Notification('Time for your daily check-in!');
  }
});
```

## Self-Introduction Feature Explained

### Purpose
The 3-minute self-introduction helps counselors and AI understand:
- What challenges you're facing
- Your emotional state
- Urgency of support needed
- Specific areas where you need help

### How It Works

1. **Recording Phase** (up to 3 minutes)
   - Tap "Start Recording"
   - Speak naturally about:
     - How you're feeling
     - What's stressing you
     - Academic challenges
     - Family or social issues
     - What help you need
   - Browser captures audio + converts to text in real-time
   - Tap "Stop" when finished

2. **Review Phase**
   - Check the transcript
   - Edit any mistakes
   - Add details if needed
   - You can also type instead of recording

3. **Analysis Phase**
   - Tap "Analyze Needs"
   - AI analyzes your words for:
     - **Needs**: Academic help, emotional support, family issues, etc.
     - **Urgency**: Low, Medium, High
     - **Summary**: Key points from your introduction
   - Results saved to your profile
   - Counselors can see this when assigned to you

### Example Self-Introduction
> "Hi, I'm struggling with my studies lately. I have exams coming up in two weeks but I can't focus. My parents are putting a lot of pressure on me to get good grades. I feel anxious all the time and I'm not sleeping well. I also feel lonely because I don't have many friends at college. I need help managing my stress and maybe some study tips."

**AI Analysis Result:**
- **Needs**: Academic support, Stress management, Social connection
- **Urgency**: Medium-High
- **Summary**: Student experiencing exam anxiety, family pressure, sleep issues, and social isolation

### Privacy & Security
- ✅ Audio recorded locally in browser
- ✅ Only text transcript sent to server
- ✅ Encrypted connection (HTTPS in production)
- ✅ You can clear/delete anytime
- ✅ Only assigned counselor sees it
- ❌ Audio file never uploaded
- ❌ Not shared with third parties

## Device Data Sync

### Current Manual Sync
On the dashboard, you can manually enter:
- **Steps**: Daily step count
- **Sleep Hours**: How long you slept
- **Focus Minutes**: Time spent studying/focused
- **Screen Time**: Total phone/computer usage
- **Active Minutes**: Exercise or physical activity
- **Idle Minutes**: Sedentary time
- **Study Screen Time**: Screen time specifically for studying

### Data Sources
You can get this data from:
- **Android**: Google Fit, Samsung Health
- **iOS**: Apple Health
- **Wearables**: Fitbit, Mi Band, Apple Watch
- **Manual**: Estimate based on your day

### Future Auto-Sync (Planned)
Integration with:
- Google Fit API (Android)
- Apple HealthKit (iOS)
- Fitbit API
- Manual override always available

## Offline Capabilities

### What Works Offline
- ✅ View cached dashboard
- ✅ Record voice (self-introduction)
- ✅ Fill out forms
- ✅ Play mini-games
- ✅ View cached videos (if previously loaded)

### What Needs Internet
- ❌ AI chat responses
- ❌ Sending messages to counselor
- ❌ Syncing device data
- ❌ Loading new content
- ❌ Analyzing self-introduction

### Service Worker
The PWA includes a service worker that:
- Caches static assets (HTML, CSS, JS)
- Enables offline page viewing
- Queues requests when offline
- Syncs when connection restored

## Permissions Required

### Essential
- **Microphone**: For voice recording and AI chat
- **Storage**: For caching offline data

### Optional
- **Notifications**: For daily check-in reminders
- **Location**: For finding nearby counselors
- **Camera**: For future mood tracking features

## Testing on Mobile

### Test Checklist
1. Install PWA on home screen
2. Launch from home screen (full-screen mode)
3. Test voice recording in AI chat
4. Record 3-minute self-introduction
5. Verify transcript appears
6. Analyze self-introduction
7. Check analysis results
8. Clear self-introduction
9. Test offline mode (airplane mode)
10. Sync device data manually

### Common Issues

**Voice not recording:**
- Check microphone permission
- Try Chrome/Safari (best support)
- Ensure HTTPS (required for mic access)

**Transcript empty:**
- Speak clearly and loudly
- Check language setting matches your speech
- Edit transcript manually if needed

**Analysis fails:**
- Check internet connection
- Ensure transcript has content
- Try again in a few moments

**PWA won't install:**
- Use Chrome (Android) or Safari (iOS)
- Ensure manifest.webmanifest is loading
- Check service worker registration

## Developer Notes

### Testing Locally
```bash
# Start server
npm run dev

# Access from mobile on same network
# Find your local IP: ipconfig (Windows) or ifconfig (Mac/Linux)
# Open on mobile: http://192.168.x.x:3000
```

### HTTPS Requirement
Many device APIs require HTTPS:
- Use ngrok for testing: `ngrok http 3000`
- Or use local HTTPS with self-signed cert
- Production must use valid SSL certificate

### Browser Support
- **Chrome Android**: Full support
- **Safari iOS**: Good support (webkit prefix needed)
- **Firefox Mobile**: Limited support
- **Samsung Internet**: Good support

## Future Enhancements

1. **Automatic Activity Tracking**
   - Background step counting
   - Sleep detection
   - Screen time monitoring

2. **Biometric Authentication**
   - Fingerprint login
   - Face ID support

3. **Push Notifications**
   - Daily check-in reminders
   - Counselor message alerts
   - Task completion nudges

4. **Offline AI Chat**
   - Local LLM using WebAssembly
   - Sync conversations when online

5. **Mood Selfie Analysis**
   - Camera-based emotion detection
   - Track mood over time

6. **Wearable Integration**
   - Heart rate monitoring
   - Stress level detection
   - Sleep quality analysis
