# HITStory

**HITStory** is an interactive music timeline game. Players compete to build the perfect timeline of songs by guessing the correct release year relative to other songs in their collection.

## 🎵 Features

*   **Music Timeline Mechanics**: Place songs in chronological order.
*   **Spotify Integration**: Login with Spotify Premium to listen to tracks. Supports fetching from specific playlists.
*   **Multiplayer Support**: Local multiplayer with customizable player names and colors.
*   **Token Economy**:
    *   **Betting & Challenges**: Challenge other players' placements to steal their cards and tokens.
    *   **Power-ups**: Use tokens to skip songs or auto-place difficult tracks.
*   **Responsive Design**: Built for desktop and mobile play.
*   **Advanced Challenge System**: Sequential betting with a "Winner Takes All" pot mechanic.

## 🚀 Tech Stack

*   **Framework**: [React](https://reactjs.org/) (via [Vite](https://vitejs.dev/))
*   **Language**: TypeScript
*   **Styling**: [TailwindCSS](https://tailwindcss.com/)
*   **Icons**: [Lucide React](https://lucide.dev/)
*   **API**: Spotify Web API & Web Playback SDK

## 🛠️ Setup & Installation

1.  **Clone the repository**
    ```bash
    git clone <repository-url>
    cd hitstory-web
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Variables**
    Create a `.env.local` file in the root directory and add your Spotify credentials:
    ```env
    VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
    VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/callback
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

## 🎮 How to Play

1.  **Setup**: Add players and select a difficulty/playlist.
2.  **Listening Phase**: The active player listens to a mystery song.
3.  **Placement**: The player chooses a spot on their timeline where they think the song fits chronologically.
4.  **Challenge Phase**: Other players can bet tokens if they think the placement is wrong.
5.  **Reveal**: The year is revealed!
    *   **Correct**: The card is added to the timeline.
    *   **Incorrect**: Challengers win/lose tokens based on the result.
6.  **Win Condition**: The first player to reach the target number of cards wins!

## ⚠️ Requirements

*   **Spotify Premium**: Required for full track playback via the Web Playback SDK.
*   **Browser**: A modern browser (Chrome/Edge/Firefox) is recommended.

## 📄 License

This project is for educational and entertainment purposes.
