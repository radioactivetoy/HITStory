export const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
export const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || 'http://127.0.0.1:5173/callback';
export const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
export const RESPONSE_TYPE = 'token';
export const SCOPES = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state'
];

// --- PKCE Helpers ---

const generateRandomString = (length: number) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const values = crypto.getRandomValues(new Uint8Array(length));
    return values.reduce((acc, x) => acc + possible[x % possible.length], "");
}

const sha256 = async (plain: string) => {
    const encoder = new TextEncoder()
    const data = encoder.encode(plain)
    return window.crypto.subtle.digest('SHA-256', data)
}

const base64encode = (input: ArrayBuffer) => {
    return btoa(String.fromCharCode(...new Uint8Array(input)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
}

export const setupPKCE = async () => {
    const codeVerifier = generateRandomString(64);
    const hashed = await sha256(codeVerifier);
    const codeChallenge = base64encode(hashed);

    // Store verifier locally for the callback
    window.localStorage.setItem('code_verifier', codeVerifier);

    const params = new URLSearchParams({
        client_id: CLIENT_ID,
        response_type: 'code',
        redirect_uri: REDIRECT_URI,
        scope: SCOPES.join(' '),
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        show_dialog: 'true'
    });

    return `${AUTH_ENDPOINT}?${params.toString()}`;
}


// --- Token Exchange ---

export const getAccessToken = async (code: string) => {
    const codeVerifier = window.localStorage.getItem('code_verifier');
    if (!codeVerifier) return null;

    const payload = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'authorization_code',
            code,
            redirect_uri: REDIRECT_URI,
            code_verifier: codeVerifier,
        }),
    }

    const body = await fetch("https://accounts.spotify.com/api/token", payload);
    const response = await body.json();

    if (response.access_token) {
        return response.access_token; // Also refresh_token is here if needed
    } else {
        console.error("Token Exchange Error:", response);
    }
    return null;
}

// Deprecated implicit helpers
export const loginUrl = ''; // We now use setupPKCE() async

export const getTokenFromUrl = (): string | null => {
    // Legacy implicit handling
    const hash = window.location.hash;
    if (!hash) return null;
    return hash.substring(1).split('&').find(elem => elem.startsWith('access_token'))?.split('=')[1] || null;
};

// --- API Calls (Unchanged) ---
export const fetchProfile = async (token: string) => {
    const result = await fetch("https://api.spotify.com/v1/me", {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    return await result.json();
};

export const fetchPlaylist = async (token: string, playlistId: string) => {
    const result = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    const data = await result.json();
    if (!result.ok) {
        console.error('Spotify API Error (fetchPlaylist):', data);
    }
    return data;
}

export const fetchRandomTrack = async (token: string, playlistId: string, totalTracks: number) => {
    // Retry logic could be added here if offset fails
    const offset = Math.floor(Math.random() * totalTracks);
    const result = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=1&offset=${offset}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    const data = await result.json();
    // Handle case where track is null or linking is weird
    return data.items?.[0]?.track;
};

export const playTrack = async (token: string, deviceId: string, trackUri: string) => {
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({ uris: [trackUri] }),
    });
    if (!res.ok) {
        console.error('Spotify Play Error:', res.status, await res.text());
    }
};

export const pauseTrack = async (token: string, deviceId: string) => {
    await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
    });
};

export const getPlaybackState = async (token: string) => {
    const result = await fetch("https://api.spotify.com/v1/me/player", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (result.status === 204) return null; // No Content
    return await result.json();
};

export const seekTrack = async (token: string, deviceId: string, positionMs: number) => {
    await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}&device_id=${deviceId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
    });
};
