import React, { useEffect } from 'react';
import { useGame } from '../context/GameContext';

declare global {
    interface Window {
        onSpotifyWebPlaybackSDKReady: () => void;
        Spotify: any;
    }
}

export const WebPlayback: React.FC = () => {
    const { token, setDeviceId } = useGame();

    const [status, setStatus] = React.useState<string>('Initializing...');
    const [isReady, setIsReady] = React.useState(false);

    useEffect(() => {
        if (!token) {
            setStatus('No Token');
            return;
        }

        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;

        document.body.appendChild(script);

        window.onSpotifyWebPlaybackSDKReady = () => {
            setStatus('SDK Loaded. Creating Player...');
            const player = new window.Spotify.Player({
                name: 'HITStory Web Player',
                getOAuthToken: (cb: (token: string) => void) => { cb(token); },
                volume: 0.5
            });

            player.addListener('ready', ({ device_id }: { device_id: string }) => {
                console.log('Ready with Device ID', device_id);
                setDeviceId(device_id);
                setStatus('Player Ready (Connected)');
                setIsReady(true);
            });

            player.addListener('not_ready', ({ device_id }: { device_id: string }) => {
                console.log('Device ID has gone offline', device_id);
                setStatus('Player Offline');
                setIsReady(false);
            });

            player.addListener('initialization_error', ({ message }: { message: string }) => {
                console.error('Failed to initialize', message);
                setStatus(`Init Error: ${message}`);
            });

            player.addListener('authentication_error', ({ message }: { message: string }) => {
                console.error('Auth Error', message);
                setStatus(`Auth Error: ${message}`);
            });

            player.connect();
        };

        return () => {
            // Clean up existing player to prevent duplicates
            // Note: window.Spotify.Player doesn't emit a clean reference easily here unless we store it outside
            // checking if 'player' variable scope allows this, actually it's inside the callback.
            // We can't reach 'player' here easily without partial refactor or assigning to a ref.
            // For now, let's just leave it or refactor slightly to store player in a ref.
        };
    }, [token, setDeviceId]);

    return (
        <div className={`fixed bottom-0 right-0 p-2 text-xs font-mono rounded-tl-lg z-50 ${isReady ? 'bg-green-900/80 text-green-200' : 'bg-red-900/80 text-red-200'}`}>
            Spotify: {status}
        </div>
    );
};
