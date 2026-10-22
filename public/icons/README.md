# PWA Icons Directory

This directory contains all icon assets required for the Progressive Web App (PWA) implementation.

## Required Icon Sizes

The following icons need to be generated from the base icon design:

### App Icons (Maskable)
- **icon-72x72.png** - Android notification icon
- **icon-96x96.png** - Android home screen, shortcuts
- **icon-128x128.png** - Chrome Web Store
- **icon-144x144.png** - Windows Metro tile
- **icon-152x152.png** - iOS Safari bookmark icon
- **icon-192x192.png** - Android splash screen, home screen (primary)
- **icon-384x384.png** - Android splash screen (larger devices)
- **icon-512x512.png** - Android splash screen, maskable icon (primary)

### iOS Specific
- **icon-180x180.png** - Apple Touch Icon (iOS home screen)
- **icon-32x32.png** - Favicon fallback

### Shortcuts
- **shortcut-chat.png** (96x96) - Chat shortcut icon
- **shortcut-agents.png** (96x96) - Agents shortcut icon

## Design Guidelines

### Maskable Icons
- Include safe zone padding (20% on all sides)
- Icon content should fit within the center 80% circle
- Background should work on both light and dark themes
- Use transparent backgrounds where appropriate

### Design Specifications
- **Base Resolution**: 512x512px minimum
- **Safe Zone**: 80% of icon (centered circle)
- **Format**: PNG with transparency
- **Color Space**: sRGB
- **Bit Depth**: 24-bit (RGB) or 32-bit (RGBA)

## Tools for Icon Generation

### Recommended Tools
1. **PWA Asset Generator**: https://github.com/onderceylan/pwa-asset-generator
   ```powershell
   npx @pwa/asset-generator logo.svg public/icons --icon-only --padding "20%"
   ```

2. **Maskable.app**: https://maskable.app/editor
   - Upload your icon and verify it works as maskable
   - Test safe zone compliance

3. **RealFaviconGenerator**: https://realfavicongenerator.net/
   - Generate all favicon variants
   - Get platform-specific optimizations

## Current Status

- [ ] Base icon designed (512x512)
- [ ] All icon sizes generated
- [ ] Maskable icons tested
- [ ] Shortcut icons created
- [ ] Icons added to public/icons/
- [ ] Manifest.json updated with icon paths

## Next Steps

1. Design or provide base icon (512x512 PNG)
2. Generate all required sizes using PWA Asset Generator
3. Test icons with Maskable.app
4. Verify icons load correctly in manifest
5. Test installation on real devices

---

**Note**: Icons are currently placeholders. Replace with actual Gofr Agents brand icons before production deployment.

