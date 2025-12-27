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

    // Original Track
    const originalTrack = data.items?.[0]?.track;
    if (!originalTrack) return null;

    // Attempt Deep Search for a potentially older version
    const olderTrack = await searchForEarliestTrack(
        token,
        originalTrack.artists[0].name,
        originalTrack.name,
        originalTrack.duration_ms
    );

    if (olderTrack) {
        // If we found an older version, use its Album info but KEEP the original URI for playback reliability?
        // ACTUALLY: The older version might not be playable or might be different audio. 
        // ideally we want the *date* of the older one, but play the *original* one (guaranteed to be in playlist).
        // HOWEVER: The prompts/cards show the Album Image.
        // If we show the 1975 Album Image and play the 2011 Remaster, that's fine.
        // If we show the 2011 Remaster Image and say "1975", that's slightly confusing but acceptable.

        // Let's swap the WHOLE track object to the older one.
        // PRO: Correct Album Art (Vintage) + Correct Date.
        // CON: Might be unplayable territory restricted?
        // Risk: The search result might not be playable in the user's region.
        // The original from the playlist *is* presumably playable.

        // HYBRID APPROACH:
        // Use the Older Track's metadata (Album keys), but potentially keep the URI of the original if we are paranoid.
        // But simplifying: Let's try returning the Older Track. If it fails to play, we might need a fallback.
        // Given this is "hitster", the *Date* is the most critical gameplay element.

        // Let's return the Older Track but verify it's playable? 
        // Search API returns `is_playable` allowed fields usually.

        // SAFEST BET for Game Mechanics:
        // Return the Older Track. It represents the "Truth".

        console.log(`Deep Search: Swapped '${originalTrack.name}' (${originalTrack.album.release_date}) for '${olderTrack.name}' (${olderTrack.album.release_date})`);
        return olderTrack;
    }

    return originalTrack;
};

export const playTrack = async (token: string, deviceId: string, trackUri: string, positionMs?: number) => {
    const body: any = { uris: [trackUri] };
    if (positionMs !== undefined) {
        body.position_ms = positionMs;
    }

    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify(body),
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

export const resumeTrack = async (token: string, deviceId: string) => {
    const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
    });
    if (!res.ok) {
        console.error('Spotify Resume Error:', res.status, await res.text());
    }
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

// --- Deep Search Helper for Accurate Years ---

const cleanTrackName = (name: string): string => {
    return name
        .replace(/ - Remastered \d{4}/g, '')
        .replace(/ - Remastered/g, '')
        .replace(/ \(Remastered \d{4}\)/g, '')
        .replace(/ \(Remastered\)/g, '')
        .replace(/ - \d{4} Remaster/g, '')
        .replace(/ - Live/g, '')
        .replace(/ \(Live\)/g, '')
        .replace(/ - Radio Edit/g, '')
        .replace(/ - Edit/g, '')
        .replace(/ - Mono/g, '')
        .replace(/ - Stereo/g, '')
        .split(' - ')[0] // Aggressive: take the main title if there's a dash separator we missed
        .trim();
};

const searchForEarliestTrack = async (token: string, artistName: string, trackName: string, originalDurationMs: number) => {
    try {
        const query = `track:${cleanTrackName(trackName)} artist:${artistName}`;
        // Fetch top 10 results (usually enough to find the original)
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const data = await res.json();
        if (!data.tracks || !data.tracks.items) return null;

        // Filter and Sort
        const candidates = data.tracks.items.filter((t: any) => {
            // 1. Must match artist loosely (primary artist should be in there)
            const artistMatch = t.artists.some((a: any) => a.name.toLowerCase().includes(artistName.toLowerCase()));
            // 2. Duration safety check (allow +/- 30 seconds variance for radio edits vs album versions)
            const durationMatch = Math.abs(t.duration_ms - originalDurationMs) < 30000;
            return artistMatch && durationMatch;
        });

        if (candidates.length === 0) return null;

        // Sort by release date (Oldest first)
        candidates.sort((a: any, b: any) => {
            const dateA = new Date(a.album.release_date).getTime();
            const dateB = new Date(b.album.release_date).getTime();
            return dateA - dateB;
        });

        return candidates[0]; // Return the oldest one
    } catch (e) {
        console.warn("Deep Search Failed:", e);
        return null;
    }
};
