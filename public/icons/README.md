# PWA Icons

This directory contains the icon assets required for the Progressive Web App (PWA) functionality.

## Icon Assets

The following PNG icons have been generated from the CCF logo (`src/assets/ccf.svg`):

### Standard Icons (any purpose)
- `icon-72x72.png` - 72x72 pixels
- `icon-96x96.png` - 96x96 pixels
- `icon-128x128.png` - 128x128 pixels
- `icon-144x144.png` - 144x144 pixels
- `icon-152x152.png` - 152x152 pixels (Apple Touch Icon)
- `icon-192x192.png` - 192x192 pixels (Android minimum)
- `icon-384x384.png` - 384x384 pixels
- `icon-512x512.png` - 512x512 pixels (Android splash screen)

### Maskable Icons
These icons should have padding to account for different device masks:
- `icon-maskable-192x192.png` - 192x192 pixels with safe zone
- `icon-maskable-512x512.png` - 512x512 pixels with safe zone

## Regenerating Icons (If Needed)

If you need to regenerate icons (e.g., after logo changes), here are the available methods:

### Option 1: Using Online Tools
1. Go to [Maskable.app](https://maskable.app/editor) or [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator)
2. Upload `src/assets/ccf.svg`
3. Generate all required sizes
4. Download and place in this directory

### Option 2: Using ImageMagick (Command Line)
```bash
# Install ImageMagick first
# Then convert SVG to various sizes:

convert src/assets/ccf.svg -resize 72x72 public/icons/icon-72x72.png
convert src/assets/ccf.svg -resize 96x96 public/icons/icon-96x96.png
convert src/assets/ccf.svg -resize 128x128 public/icons/icon-128x128.png
convert src/assets/ccf.svg -resize 144x144 public/icons/icon-144x144.png
convert src/assets/ccf.svg -resize 152x152 public/icons/icon-152x152.png
convert src/assets/ccf.svg -resize 192x192 public/icons/icon-192x192.png
convert src/assets/ccf.svg -resize 384x384 public/icons/icon-384x384.png
convert src/assets/ccf.svg -resize 512x512 public/icons/icon-512x512.png

# For maskable icons, add padding:
convert src/assets/ccf.svg -resize 154x154 -gravity center -extent 192x192 -background transparent public/icons/icon-maskable-192x192.png
convert src/assets/ccf.svg -resize 410x410 -gravity center -extent 512x512 -background transparent public/icons/icon-maskable-512x512.png
```

## Testing Icons

After generating icons:
1. Run the development server: `npm run dev`
2. Open browser DevTools > Application > Manifest
3. Verify all icons are loaded correctly
4. Test maskable icons at [Maskable.app](https://maskable.app/)

## Important Notes

- **Maskable icons** require a safe zone (minimum 10% padding on all sides)
- Keep icons simple and recognizable at small sizes
- Use transparent backgrounds for standard icons
- Maskable icons can use colored backgrounds if desired
- All icons should be PNG format for best compatibility
