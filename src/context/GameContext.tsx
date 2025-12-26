import React, { createContext, useContext, useReducer, useEffect, useState } from 'react';
import { gameReducer, initialState, type GameAction } from '../store/gameReducer';
import { type GameState } from '../types';
import { setupPKCE, getAccessToken, getTokenFromUrl } from '../lib/spotify';

interface GameContextType {
    state: GameState;
    dispatch: React.Dispatch<GameAction>;
    token: string | null;
    deviceId: string | null;
    setDeviceId: (id: string) => void;
    login: () => void;
    logout: () => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const [token, setToken] = useState<string | null>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null);

    // State Persistence
    useEffect(() => {
        const savedState = window.localStorage.getItem('hitstory_game_state');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed && Array.isArray(parsed.players)) {
                    // Simple migration/validation could go here
                    dispatch({ type: 'RESTORE_STATE', payload: parsed });
                }
            } catch (e) {
                console.error('Failed to load saved state', e);
            }
        }
    }, []);

    useEffect(() => {
        if (state.players.length > 0) {
            window.localStorage.setItem('hitstory_game_state', JSON.stringify(state));
        }
    }, [state]);


    const authCheckRef = React.useRef(false);

    useEffect(() => {
        if (authCheckRef.current) return;
        authCheckRef.current = true;

        const checkAuth = async () => {
            console.log("Checking Auth...");
            // 1. Priority: Check for PKCE code in query params (fresh login)
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");

            if (code) {
                console.log("Found code in URL, exchanging...");
                // Prevent double-firing in StrictMode
                if (token) {
                    console.log("Token already exists, ignoring code.");
                    return;
                }

                const accessToken = await getAccessToken(code);
                if (accessToken) {
                    console.log("Code exchange successful!");
                    setToken(accessToken);
                    window.localStorage.setItem('spotify_access_token', accessToken);
                    dispatch({ type: 'SET_TOKEN', payload: accessToken });
                    // Clean URL
                    window.history.replaceState({}, '', '/');
                    return; // Stop here, we have fresh token
                } else {
                    console.error("Code exchange failed. Clearing old tokens to prevent stale state.");
                    window.localStorage.removeItem('spotify_access_token');
                    window.location.search = ''; // Clear the bad code to prevent loop, maybe just reload clean?
                    // Actually just returning and not loading stored token is enough to show "Login" screen.
                    return;
                }
            }

            // 2. Check localStorage (legacy/refresh)
            const storedToken = window.localStorage.getItem('spotify_access_token');
            if (storedToken) {
                console.log("Found stored token.");
                setToken(storedToken);
                dispatch({ type: 'SET_TOKEN', payload: storedToken });
                return;
            }

            // 3. Legacy hash (implicit flow fallback)
            const hashToken = getTokenFromUrl();
            if (hashToken) {
                console.log("Found hash token.");
                setToken(hashToken);
                window.localStorage.setItem('spotify_access_token', hashToken);
                window.location.hash = "";
                dispatch({ type: 'SET_TOKEN', payload: hashToken });
                return;
            }
        };
        checkAuth();
    }, []); // Run once on mount

    const login = async () => {
        const url = await setupPKCE();
        window.location.href = url;
    };

    const logout = () => {
        setToken(null);
        window.localStorage.removeItem('spotify_access_token');
        window.localStorage.removeItem('code_verifier');
        dispatch({ type: 'SET_TOKEN', payload: '' }); // Clear token in state
    };

    return (
        <GameContext.Provider value={{ state, dispatch, token, deviceId, setDeviceId, login, logout }}>
            {children}
        </GameContext.Provider>
    );
};

export const useGame = () => {
    const context = useContext(GameContext);
    if (context === undefined) {
        throw new Error('useGame must be used within a GameProvider');
    }
    return context;
};
