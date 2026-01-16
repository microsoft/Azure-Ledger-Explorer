# Progressive Web App (PWA) Implementation

This document describes the PWA implementation for CCF Ledger Explorer.

## Overview

The application is now configured as a Progressive Web App, enabling:
- **Offline Access**: Work with cached data even without internet
- **Install to Device**: Add to home screen on mobile/desktop
- **Background Sync**: Service worker manages updates seamlessly
- **App-like Experience**: Standalone display mode without browser UI
- **Fast Loading**: Aggressive caching for instant startup

## Architecture

### Service Worker Strategy

The PWA uses **Workbox** (via `vite-plugin-pwa`) with the following configuration:

#### Caching Strategy
- **Static Assets**: Pre-cached during service worker installation
  - HTML, CSS, JavaScript bundles
  - Fonts, icons, images
  - Markdown help files

- **Runtime Caching**:
  - **OpenAI API**: `NetworkOnly` - Always fresh, never cached (sensitive data)
  - **Azure Blob Storage**: `NetworkOnly` - Direct network access for file shares
  - **OPFS Files**: Excluded from caching (managed by SQLite OPFS VFS)

#### Update Behavior
- **Register Type**: `prompt` - Users are notified when updates are available
- **Update Check**: Automatic hourly checks while app is open
- **Update Flow**: User-initiated via update prompt (non-intrusive)

### File Structure

```
public/
├── manifest.webmanifest      # PWA manifest (app metadata, icons)
└── icons/                     # PWA icon assets
    ├── icon-72x72.png
    ├── icon-96x96.png
    ├── icon-128x128.png
    ├── icon-144x144.png
    ├── icon-152x152.png
    ├── icon-192x192.png
    ├── icon-384x384.png
    ├── icon-512x512.png
    ├── icon-maskable-192x192.png
    ├── icon-maskable-512x512.png
    └── README.md              # Icon generation guide

src/
└── components/
    └── PWAPrompt.tsx          # Service worker update UI
```

## Configuration Files

### 1. vite.config.ts

The Vite PWA plugin is configured with:

```typescript
VitePWA({
  registerType: 'prompt',                    // User-initiated updates
  includeAssets: ['**/*.md', 'src/assets/ccf.svg'],
  manifest: { /* app metadata */ },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    runtimeCaching: [/* network-only for APIs */],
    navigateFallbackDenylist: [/^\/opfs/]   // Exclude OPFS paths
  }
})
```

### 2. manifest.webmanifest

Defines the PWA identity and behavior:
- **Name**: "CCF Ledger Explorer"
- **Display**: Standalone (full-screen without browser chrome)
- **Theme Color**: `#0078d4` (Microsoft blue)
- **Icons**: Multiple sizes for various devices
- **Shortcuts**: Quick actions (e.g., "Upload Files")

### 3. index.html

PWA-specific meta tags:
- Theme color for browser UI
- Apple touch icons for iOS
- Web app manifest link
- iOS-specific meta tags for standalone mode

## User Experience

### Installation

**Desktop (Chrome/Edge)**:
1. Visit the app URL
2. Click the install icon in the address bar
3. Confirm installation

**Mobile (iOS)**:
1. Open in Safari
2. Tap Share button
3. Select "Add to Home Screen"

**Mobile (Android)**:
1. Open in Chrome
2. Tap menu (⋮)
3. Select "Add to Home Screen"

### Updates

When a new version is available:
1. **Update notification** appears (bottom-right corner)
2. User can:
   - Click **"Reload"** to update immediately
   - Click **"Later"** to dismiss and update on next app launch
3. Service worker installs new version in background
4. App refreshes with new version

### Offline Behavior

- **Ledger Data**: Persists in OPFS SQLite database (works offline)
- **UI Assets**: Pre-cached (app shell always available)
- **External APIs**: Require network (OpenAI, Azure)
- **Help Documentation**: Cached markdown files available offline

## Development

### Testing PWA Features

1. **Build Production Version**:
   ```bash
   npm run build
   npm run preview
   ```

2. **Open DevTools > Application**:
   - **Manifest**: Verify icon loading and metadata
   - **Service Workers**: Check registration and updates
   - **Storage**: Inspect Cache Storage and OPFS

3. **Test Offline**:
   - Open app
   - DevTools > Network > Toggle "Offline"
   - Navigate and verify cached assets load

4. **Test Update Flow**:
   - Make code changes
   - Rebuild: `npm run build`
   - Refresh preview
   - Verify update prompt appears

### Debugging Service Worker

```typescript
// Check service worker registration
navigator.serviceWorker.getRegistrations().then(registrations => {
  console.log('Active SWs:', registrations);
});

// Force update check
navigator.serviceWorker.getRegistration().then(registration => {
  registration?.update();
});
```

### Development Mode

PWA features are **disabled in dev mode** (`npm run dev`) to avoid caching issues during development. Enable if needed:

```typescript
// vite.config.ts
devOptions: {
  enabled: true,  // Enable PWA in dev mode
  type: 'module'
}
```

## Icon Generation

Icons must be generated before deployment. See [public/icons/README.md](../public/icons/README.md) for:
- Required icon sizes
- Generation methods (online tools, ImageMagick, Sharp)
- Maskable icon guidelines

**Quick Command (if Sharp is installed)**:
```bash
npm install --save-dev sharp
node generate-icons.js
```

## Deployment

### Azure Static Web Apps

The existing deployment pipeline (`deploy-to-azure.ps1`) automatically includes PWA files:

1. **Build generates**:
   - `dist/manifest.webmanifest`
   - `dist/sw.js` (service worker)
   - `dist/workbox-*.js` (Workbox runtime)
   - `dist/icons/*` (PWA icons)

2. **Static Web Apps serves** with proper headers:
   - COOP/COEP headers (already configured)
   - Service worker MIME type: `text/javascript`

3. **HTTPS Required**: PWAs require secure context (Azure provides by default)

### Verification

After deployment, test:
1. **Lighthouse Audit** (DevTools > Lighthouse)
   - Should score 100/100 in PWA category
2. **Install Prompt** appears on supported browsers
3. **Offline Mode** works after initial visit

## Troubleshooting

### Service Worker Not Registering

```bash
# Check HTTPS (required for PWA)
# Check browser console for errors
# Verify sw.js is served with correct MIME type
```

### Updates Not Appearing

```bash
# Clear browser cache
# Unregister old service worker:
navigator.serviceWorker.getRegistrations().then(regs => 
  regs.forEach(reg => reg.unregister())
);
```

### Icons Not Loading

```bash
# Verify icons exist in public/icons/
# Check manifest.webmanifest paths
# Run Lighthouse audit for icon errors
```

## Future Enhancements

Potential PWA improvements:
- **Background Sync**: Queue operations when offline, sync when online
- **Push Notifications**: Alert users to data updates
- **Share Target**: Accept shared files directly into the app
- **Periodic Background Sync**: Auto-refresh ledger data
- **Advanced Caching**: Implement StaleWhileRevalidate for better offline UX

## References

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Vite PWA Plugin](https://vite-pwa-org.netlify.app/)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
- [Web App Manifest Spec](https://www.w3.org/TR/appmanifest/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
