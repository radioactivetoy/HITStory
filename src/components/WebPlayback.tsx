import React, { useEffect, useRef, useState } from 'react';
import { useGame } from '../context/useGame';

interface SpotifyPlayerInstance {
    connect: () => Promise<boolean>;
    disconnect: () => void;
    addListener(event: 'ready' | 'not_ready', callback: (data: { device_id: string }) => void): void;
    addListener(event: 'initialization_error' | 'authentication_error' | 'account_error' | 'playback_error', callback: (data: { message: string }) => void): void;
}

interface SpotifyPlayerConstructor {
    new(options: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume?: number;
    }): SpotifyPlayerInstance;
}

declare global {
    interface Window {
        onSpotifyWebPlaybackSDKReady: () => void;
        Spotify: {
            Player: SpotifyPlayerConstructor;
        };
    }
}

export const WebPlayback: React.FC = () => {
    const { token, setDeviceId, handleAuthError } = useGame();

    const tokenRef = useRef(token);
    const playerRef = useRef<SpotifyPlayerInstance | null>(null);

    const [status, setStatus] = useState<string>('Initializing...');
    const [isReady, setIsReady] = useState(false);

    // Keep the OAuth-callback closure fresh without recreating the SDK player on every token refresh.
    useEffect(() => {
        tokenRef.current = token;
    }, [token]);

    useEffect(() => {
        if (!token) return;

        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            setStatus('SDK Loaded. Creating Player...');
            const player = new window.Spotify.Player({
                name: 'HITStory Web Player',
                getOAuthToken: (cb) => { cb(tokenRef.current || ''); },
                volume: 0.5
            });
            playerRef.current = player;

            player.addListener('ready', ({ device_id }) => {
                console.log('Ready with Device ID', device_id);
                setDeviceId(device_id);
                setStatus('Player Ready (Connected)');
                setIsReady(true);
            });

            player.addListener('not_ready', ({ device_id }) => {
                console.log('Device ID has gone offline', device_id);
                setStatus('Player Offline');
                setIsReady(false);
            });

            player.addListener('initialization_error', ({ message }) => {
                console.error('Failed to initialize', message);
                setStatus(`Init Error: ${message}`);
            });

            player.addListener('authentication_error', ({ message }) => {
                console.error('Auth Error', message);
                setStatus(`Auth Error: ${message}`);
                handleAuthError();
            });

            player.connect();
        };

        return () => {
            playerRef.current?.disconnect();
            playerRef.current = null;
            script.remove();
        };
        // Deliberately keyed on "does a token exist yet" rather than the token value itself:
        // the player must be created exactly once per session, not recreated on every refresh
        // (that would swap Spotify Connect devices and interrupt playback).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [Boolean(token), setDeviceId, handleAuthError]);

    const displayStatus = !token ? 'No Token' : status;

    return (
        <div className={`fixed bottom-0 right-0 p-2 text-xs font-mono rounded-tl-lg z-50 ${isReady ? 'bg-green-900/80 text-green-200' : 'bg-red-900/80 text-red-200'}`}>
            Spotify: {displayStatus}
        </div>
    );
};
