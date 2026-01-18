# 24-7 Audio Tour

An instant GPS-based audio tour web application that narrates the history and cultural significance of nearby landmarks at the tap of a button.

## Features

- 🎯 **One-Tap Audio Tours**: Press play to instantly discover nearby landmarks
- 📍 **GPS Location Detection**: Automatically finds your current location
- 🗺️ **Foursquare Integration**: Uses Foursquare Places API to find interesting landmarks
- 🔊 **Text-to-Speech Narration**: Browser-based TTS for immersive audio tours
- 📱 **Mobile-First Design**: Optimized for mobile browsers
- 🎨 **Modern UI**: Clean, dark-themed interface

## Getting Started

### Prerequisites

- Node.js 18+ installed
- Foursquare Places API Bearer token ([Get one here](https://developer.foursquare.com/))

### Installation

1. Clone or download this repository

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
   - Create a `.env.local` file in the root directory
   - Add your Foursquare Places API Bearer token:
```
FOURSQUARE_API_KEY=your_foursquare_bearer_token_here
FOURSQUARE_PLACES_API_VERSION=2025-06-17
```

   Note: The API key is kept secure on the server side and never exposed to the client.

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## How to Use

1. **Open the app** in your browser (preferably on a mobile device for better GPS accuracy)
2. **Click the play button** in the center of the screen
3. **Allow location access** when prompted by your browser
4. **Listen** to the audio tour about nearby landmarks
5. Use the **pause/resume/stop** controls as needed

## Technology Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **Foursquare Places API** - Landmark discovery
- **Web Speech API** - Browser-based text-to-speech

## Project Structure

```
24-7-audio-tour/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   ├── page.tsx           # Main page
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── PlayButton.tsx
│   ├── AudioPlayer.tsx
│   ├── LocationStatus.tsx
│   └── LandmarkCard.tsx
├── lib/                   # Utility functions
│   ├── geolocation.ts
│   ├── foursquare.ts
│   ├── landmarks.ts
│   └── tts.ts
└── types/                 # TypeScript types
    └── index.ts
```

## Browser Compatibility

- **Chrome/Edge**: Full support (recommended)
- **Firefox**: Full support
- **Safari**: Full support (iOS 7+)
- **Opera**: Full support

Note: GPS location works best on mobile devices. Desktop browsers may have limited accuracy.

## Troubleshooting

### Location Permission Denied
- Make sure you've allowed location access in your browser settings
- Try refreshing the page and allowing permission again

### No Landmarks Found
- Try moving to a different location (urban areas work best)
- Check that your Foursquare token is correctly configured

### Audio Not Playing
- Ensure your browser supports Web Speech API
- Check that your device volume is not muted
- Try refreshing the page

## License

MIT

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests.
