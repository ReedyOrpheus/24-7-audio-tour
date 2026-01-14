# Setup Instructions

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Create a `.env.local` file in the root directory with:
   ```
   FOURSQUARE_API_KEY=your_foursquare_api_key_here
   ```

   To get a Foursquare API key:
   - Go to https://developer.foursquare.com/
   - Sign up for a free account
   - Create a new app/project
   - Copy your API key

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to http://localhost:3000

## Important Notes

- **GPS Location**: For best results, use a mobile device or enable location services on your desktop browser
- **Browser Compatibility**: Works best on Chrome, Firefox, Safari, or Edge
- **HTTPS Required**: Some browsers require HTTPS for geolocation. For local development, localhost works fine, but for production deployment, you'll need HTTPS

## Troubleshooting

### "Foursquare API key is not configured"
- Make sure your `.env.local` file exists in the root directory
- Verify the variable name is exactly `FOURSQUARE_API_KEY` (no `NEXT_PUBLIC_` prefix)
- Restart the development server after creating/updating `.env.local`

### Location permission denied
- Check your browser's location permissions
- Try refreshing the page and allowing location access
- On mobile, ensure location services are enabled in device settings

### No landmarks found
- Try moving to a different location (urban areas work best)
- Check that your Foursquare API key is valid and has the correct permissions
