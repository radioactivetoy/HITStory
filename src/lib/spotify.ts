export const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID || '';
const BASE_URI = typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:5173';
export const REDIRECT_URI = import.meta.env.VITE_REDIRECT_URI || `${BASE_URI}/callback`;
export const AUTH_ENDPOINT = 'https://accounts.spotify.com/authorize';
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

export interface TokenResult {
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number;
}

export const getAccessToken = async (code: string): Promise<TokenResult | null> => {
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
        return {
            accessToken: response.access_token,
            refreshToken: response.refresh_token || null,
            expiresIn: response.expires_in || 3600,
        };
    } else {
        console.error("Token Exchange Error:", response);
    }
    return null;
}

// PKCE public clients can refresh without a client secret.
export const refreshAccessToken = async (refreshToken: string): Promise<TokenResult | null> => {
    const payload = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
        }),
    }

    const body = await fetch("https://accounts.spotify.com/api/token", payload);
    const response = await body.json();

    if (response.access_token) {
        return {
            accessToken: response.access_token,
            // Spotify may or may not rotate the refresh token; keep the old one if it doesn't.
            refreshToken: response.refresh_token || refreshToken,
            expiresIn: response.expires_in || 3600,
        };
    } else {
        console.error("Token Refresh Error:", response);
    }
    return null;
}

// Fallback for old bookmarked/cached implicit-flow redirect links; PKCE (above) is the primary flow.
export const getTokenFromUrl = (): string | null => {
    const hash = window.location.hash;
    if (!hash) return null;
    return hash.substring(1).split('&').find(elem => elem.startsWith('access_token'))?.split('=')[1] || null;
};

export class SpotifyAuthError extends Error {
    constructor(message = 'Spotify authorization expired') {
        super(message);
        this.name = 'SpotifyAuthError';
    }
}

export interface SpotifyTrack {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists: { id: string; name: string }[];
    album: {
        name: string;
        release_date: string;
        images: { url: string }[];
    };
}

// --- API Calls ---
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

export const fetchRandomTrack = async (
    token: string,
    playlistId: string,
    totalTracks: number,
    excludeIds?: Set<string>
): Promise<{ track: SpotifyTrack; isEstimated: boolean } | null> => {
    const offset = Math.floor(Math.random() * totalTracks);
    const result = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=1&offset=${offset}`, {
        method: "GET", headers: { Authorization: `Bearer ${token}` }
    });
    if (result.status === 401) throw new SpotifyAuthError();
    const data = await result.json();

    const originalTrack: SpotifyTrack | undefined = data.items?.[0]?.track;
    if (!originalTrack || excludeIds?.has(originalTrack.id)) return null;

    // Playlists often contain remasters/reissues/remixes with a misleading release
    // date. Prefer the oldest original release actually found in the track's own
    // artist's discography (most reliable); fall back to a broader catalog search
    // if that comes up empty.
    const artistId = originalTrack.artists[0]?.id;
    if (artistId) {
        const fromDiscography = await findOriginalRelease(token, artistId, originalTrack.name, originalTrack.duration_ms);
        if (fromDiscography && !excludeIds?.has(fromDiscography.id)) {
            console.log(`Discography match: '${originalTrack.name}' (${originalTrack.album.release_date}) -> '${fromDiscography.name}' on '${fromDiscography.album.name}' (${fromDiscography.album.release_date})`);
            return { track: fromDiscography, isEstimated: true };
        }
    }

    const olderTrack = await searchForEarliestTrack(
        token,
        originalTrack.artists[0].name,
        originalTrack.name,
        originalTrack.duration_ms
    );

    if (olderTrack && !excludeIds?.has(olderTrack.id)) {
        console.log(`Deep Search: Swapped '${originalTrack.name}' (${originalTrack.album.release_date}) for '${olderTrack.name}' (${olderTrack.album.release_date})`);
        return { track: olderTrack, isEstimated: true };
    }

    return { track: originalTrack, isEstimated: false };
};

export const playTrack = async (token: string, deviceId: string, trackUri: string, positionMs?: number) => {
    const body: { uris: string[]; position_ms?: number } = { uris: [trackUri] };
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
        if (res.status === 401) throw new SpotifyAuthError();
    }
};

export const pauseTrack = async (token: string, deviceId: string) => {
    const res = await fetch(`https://api.spotify.com/v1/me/player/pause?device_id=${deviceId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        console.error('Spotify Pause Error:', res.status, await res.text());
        if (res.status === 401) throw new SpotifyAuthError();
    }
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
        if (res.status === 401) throw new SpotifyAuthError();
    }
};

export const getPlaybackState = async (token: string) => {
    const result = await fetch("https://api.spotify.com/v1/me/player", {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (result.status === 204) return null; // No Content
    if (result.status === 401) throw new SpotifyAuthError();
    return await result.json();
};

export const seekTrack = async (token: string, deviceId: string, positionMs: number) => {
    const res = await fetch(`https://api.spotify.com/v1/me/player/seek?position_ms=${positionMs}&device_id=${deviceId}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) {
        console.error('Spotify Seek Error:', res.status, await res.text());
        if (res.status === 401) throw new SpotifyAuthError();
    }
};

// --- Accurate-Year Matching ---
//
// Playlists frequently contain remasters/reissues/remixes whose Spotify release_date
// reflects the reissue, not the original recording. Two strategies try to recover the
// true original year, tried in order of reliability:
//   1. findOriginalRelease: scan the track's own artist's discography for the oldest
//      original album/single that actually contains a matching track.
//   2. searchForEarliestTrack: a broader catalog-wide text search, used only as a
//      fallback since it can match unrelated recordings (covers, samples, etc).

// Spotify's catalog has known placeholder/bogus dates (e.g. year 1900); reject those
// rather than let them win as "the earliest".
const isPlausibleReleaseDate = (dateStr: string | undefined | null): boolean => {
    if (!dateStr) return false;
    const year = parseInt(dateStr.slice(0, 4), 10);
    return Number.isFinite(year) && year >= 1900 && year <= new Date().getFullYear() + 1;
};

const REISSUE_KEYWORDS = '(?:re-?master(?:ed)?|remix(?:ed)?|live|mono|stereo|demo|acoustic|edit|version|deluxe|anniversary|bonus track|single|extended|instrumental|radio|session)';
const reissueParenPattern = new RegExp(`\\s*[([][^()[\\]]*${REISSUE_KEYWORDS}[^()[\\]]*[)\\]]`, 'gi');
const reissueSuffixPattern = new RegExp(`\\s*[-–—]\\s*(?:\\d{4}\\s*)?${REISSUE_KEYWORDS}.*$`, 'i');

const cleanTrackName = (name: string): string => {
    return name
        // Parenthetical/bracketed qualifiers containing a reissue keyword, e.g. "(2011 Remaster)", "(Deluxe Edition)"
        .replace(reissueParenPattern, '')
        // Trailing " - <keyword...>" dash suffixes, e.g. "- Remastered 2009", "- Live at Wembley"
        .replace(reissueSuffixPattern, '')
        // Featured-artist annotations, irrelevant for title matching
        .replace(/\s*[([]feat\.?[^)\]]*[)\]]/gi, '')
        .replace(/\s+feat\.?\s+.*$/i, '')
        .trim();
};

interface SimplifiedAlbum {
    id: string;
    name: string;
    release_date: string;
}

interface SimplifiedTrack {
    id: string;
    uri: string;
    name: string;
    duration_ms: number;
    artists: { id: string; name: string }[];
}

interface FullAlbum {
    id: string;
    name: string;
    release_date: string;
    images: { url: string }[];
    tracks?: { items: SimplifiedTrack[] };
}

// Scans the artist's own albums/singles (oldest first) for the first one that
// actually contains this track, and returns it with that album's metadata. This is
// far more reliable than a catalog-wide search since it's anchored to a real,
// original release by the correct artist rather than search relevance + duration.
const findOriginalRelease = async (
    token: string,
    artistId: string,
    trackName: string,
    originalDurationMs: number
): Promise<SpotifyTrack | null> => {
    const targetName = cleanTrackName(trackName).toLowerCase();

    // 1. Gather albums/singles only — deliberately excluding compilations and
    // "appears on" credits, which are exactly the reissue/various-artists entries
    // with unreliable dates.
    const albums: SimplifiedAlbum[] = [];
    let url: string | null = `https://api.spotify.com/v1/artists/${artistId}/albums?include_groups=album,single&limit=50`;
    let pages = 0;
    while (url && pages < 2) {
        const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        if (res.status === 401) throw new SpotifyAuthError();
        const data = await res.json();
        if (Array.isArray(data.items)) albums.push(...data.items);
        url = data.next || null;
        pages++;
    }

    // Dedupe cross-market duplicates, drop bogus dates, sort oldest first, cap scan size.
    const seen = new Set<string>();
    const candidates = albums
        .filter(a => isPlausibleReleaseDate(a.release_date))
        .filter(a => {
            const key = `${a.name.toLowerCase()}|${a.release_date}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .sort((a, b) => new Date(a.release_date).getTime() - new Date(b.release_date).getTime())
        .slice(0, 60);

    // 2. Batch-fetch full album details (needed for tracklists + cover art), 20 at a
    // time, stopping at the first chunk that yields a match.
    for (let i = 0; i < candidates.length; i += 20) {
        const chunk = candidates.slice(i, i + 20);
        const res = await fetch(`https://api.spotify.com/v1/albums?ids=${chunk.map(a => a.id).join(',')}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) throw new SpotifyAuthError();
        const data = await res.json();
        const fullAlbums: FullAlbum[] = data.albums || [];

        // Preserve the oldest-first order within this chunk.
        for (const album of chunk) {
            const full = fullAlbums.find(a => a && a.id === album.id);
            if (!full?.tracks?.items) continue;

            const match = full.tracks.items.find(t => {
                const nameMatch = cleanTrackName(t.name).toLowerCase() === targetName;
                const durationMatch = Math.abs(t.duration_ms - originalDurationMs) < 45000;
                return nameMatch && durationMatch;
            });

            if (match) {
                return {
                    id: match.id,
                    uri: match.uri,
                    name: match.name,
                    duration_ms: match.duration_ms,
                    artists: match.artists,
                    album: {
                        name: full.name,
                        release_date: full.release_date,
                        images: full.images
                    }
                };
            }
        }
    }

    return null;
};

const searchForEarliestTrack = async (token: string, artistName: string, trackName: string, originalDurationMs: number): Promise<SpotifyTrack | null> => {
    try {
        const query = `track:${cleanTrackName(trackName)} artist:${artistName}`;
        // Fetch top 10 results (usually enough to find the original)
        const res = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (res.status === 401) throw new SpotifyAuthError();

        const data = await res.json();
        if (!data.tracks || !data.tracks.items) return null;

        const candidates: SpotifyTrack[] = data.tracks.items.filter((t: SpotifyTrack) => {
            // Must loosely match the primary artist, be close in duration (allow +/-
            // 30s for radio edits vs album versions), and have a plausible date.
            const artistMatch = t.artists.some((a) => a.name.toLowerCase().includes(artistName.toLowerCase()));
            const durationMatch = Math.abs(t.duration_ms - originalDurationMs) < 30000;
            return artistMatch && durationMatch && isPlausibleReleaseDate(t.album.release_date);
        });

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => new Date(a.album.release_date).getTime() - new Date(b.album.release_date).getTime());

        return candidates[0]; // Oldest match
    } catch (e) {
        if (e instanceof SpotifyAuthError) throw e;
        console.warn("Deep Search Failed:", e);
        return null;
    }
};
