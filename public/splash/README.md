# iOS Splash Screens Directory

This directory contains splash screens for iOS devices to show during app launch.

## Required Splash Screen Sizes

### iPhone
- **iphone5_splash.png** - iPhone 5/SE (640x1136)
- **iphone6_splash.png** - iPhone 6/7/8 (750x1334)
- **iphoneplus_splash.png** - iPhone 6/7/8 Plus (1242x2208)
- **iphonex_splash.png** - iPhone X/XS (1125x2436)
- **iphonexr_splash.png** - iPhone XR (828x1792)
- **iphonexsmax_splash.png** - iPhone XS Max/11 Pro Max (1242x2688)

### iPad
- **ipad_splash.png** - iPad (1536x2048)
- **ipadpro1_splash.png** - iPad Pro 10.5" (1668x2224)
- **ipadpro3_splash.png** - iPad Pro 11" (1668x2388)
- **ipadpro2_splash.png** - iPad Pro 12.9" (2048x2732)

## Design Guidelines

- **Background Color**: Match manifest background_color (#ffffff)
- **Logo**: Centered app icon or logo
- **Simplicity**: Keep design minimal, splash screens appear briefly
- **Safe Area**: Account for notches and status bars
- **Format**: PNG
- **Color Space**: sRGB

## Generation Tools

### Automated Generation
```powershell
# Using PWA Asset Generator
npx @pwa/asset-generator logo.svg public/splash --splash-only --background "#ffffff"
```

### Manual Tools
1. **Figma/Sketch**: Use templates with exact dimensions
2. **Photoshop**: Create artboards for each size
3. **Online Generators**: 
   - https://appsco.pe/developer/splash-screens
   - https://www.pwabuilder.com/

## Current Status

- [ ] Splash screen designs created for all sizes
- [ ] Splash screens optimized and compressed
- [ ] Files added to public/splash/
- [ ] Links added to index.html
- [ ] Tested on actual iOS devices

## Testing

Test splash screens on:
- [ ] iPhone SE (small screen)
- [ ] iPhone 14 Pro (standard notch)
- [ ] iPhone 14 Pro Max (large with notch)
- [ ] iPad Air
- [ ] iPad Pro

---

**Note**: Splash screens are optional but highly recommended for a polished iOS experience.

