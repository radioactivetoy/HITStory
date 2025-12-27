# HITStory 🎵

**HITStory** is an interactive music timeline game. Players compete to build the perfect timeline of songs by guessing the correct release year relative to other songs in their collection.

## 🌟 Features

*   **Music Timeline Mechanics**: Place songs in chronological order.
*   **Spotify Integration**: Login with Spotify Premium to listen to tracks. Supports fetching from specific playlists.
*   **Multiplayer Support**: Local multiplayer with customizable player names and colors.
*   **Token Economy**:
    *   **Betting & Challenges**: Challenge other players' placements to steal their cards and tokens.
    *   **Power-ups**: Use tokens to skip songs or auto-place difficult tracks.
*   **Responsive Design**: Built for desktop and mobile play.
*   **Secure Remote Access**: Supports playing on mobile devices over local Wi-Fi via HTTPS.

## 🚀 Tech Stack

*   **Framework**: [React](https://reactjs.org/) (via [Vite](https://vitejs.dev/))
*   **Language**: TypeScript
*   **Styling**: [TailwindCSS](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **API**: Spotify Web API & Web Playback SDK

## 🛠️ Setup & Configuration Guide

### 1. Prerequisites
*   [Node.js](https://nodejs.org/) (v16+)
*   **Spotify Premium Account** (Required for the Web Playback SDK to play full tracks)

### 2. Installation
```bash
git clone <repository-url>
cd hitstory-web
npm install
```

### 3. Spotify Developer Setup (Critical Step)
1.  Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2.  Log in and click **"Create App"**.
3.  Give it a name (e.g., "HITStory") and description.
4.  **Redirect URIs**: You must whitelist the URLs where the app will run.
    *   **Localhost**: `https://localhost:5173/callback`
    *   **Remote/Mobile**: `https://<YOUR_LOCAL_IP>:5173/callback` (e.g., `https://192.168.1.15:5173/callback`)
    *   *Note: Finding your IP: Run `ipconfig` (Windows) or `ifconfig` (Mac/Linux).*
5.  Save the app settings.
6.  Copy the **Client ID** (you will need this for the next step).

### 4. Application Configuration
Create a `.env.local` file in the root directory:
```env
# Your Spotify Client ID from the Dashboard
VITE_SPOTIFY_CLIENT_ID=your_client_id_here

# Usually not needed if running locally (auto-detected), but explicitly:
# VITE_REDIRECT_URI=https://<YOUR_IP>:5173/callback
```

### 5. Running the App (HTTPS Mode)
This project is configured to run over **HTTPS** by default to allow remote devices (phones) to connect and authenticate with Spotify.

```bash
npm run dev
```

> [!IMPORTANT]
> **Certificate Warning**: Because the development SSL certificate is self-signed, your browser (and your phone) will show a **"Not Secure"** warning when you first load the page.
> *   **Chrome**: Click "Advanced" -> "Proceed to..."
> *   **Safari**: Click "Show Details" -> "visit this website"
> **You must accept this warning to play.**

## 📱 How to Play on Mobile
1.  Ensure your computer and phone are on the **same Wi-Fi network**.
2.  Start the app (`npm run dev`).
3.  Look at the terminal output for the **Network** URL (e.g., `➜  Network: https://192.168.1.5:5173/`).
4.  **Add this complete URL (with /callback)** to your Spotify Dashboard Redirect URIs if you haven't already.
5.  Open the URL on your phone's browser.
6.  Accept the HTTPS warning.
7.  Login with Spotify!

## 🎮 Game Rules
1.  **Setup**: Add players and select a difficulty/playlist.
2.  **Listening Phase**: The active player listens to a mystery song.
3.  **Placement**: The player chooses a spot on their timeline where they think the song fits chronologically.
4.  **Challenge Phase**: Other players can bet tokens if they think the placement is wrong.
5.  **Reveal**: The year is revealed!
    *   **Direct Hit**: The card is added to the timeline.
    *   **Stolen**: If the player was wrong but a challenger was right, the challenger steals the card!
6.  **Win Condition**: The first player to reach the target number of cards wins!

## 📄 License
This project is for educational and entertainment purposes.
