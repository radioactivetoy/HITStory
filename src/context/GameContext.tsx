import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { gameReducer, initialState } from '../store/gameReducer';
import { setupPKCE, getAccessToken, getTokenFromUrl, refreshAccessToken, type TokenResult } from '../lib/spotify';
import { GameContext } from './GameContextBase';

const REFRESH_BUFFER_MS = 60_000;

const clearAuthStorage = () => {
    window.localStorage.removeItem('spotify_access_token');
    window.localStorage.removeItem('spotify_refresh_token');
    window.localStorage.removeItem('spotify_token_expires_at');
    window.localStorage.removeItem('code_verifier');
};

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(gameReducer, initialState);
    const [token, setToken] = useState<string | null>(null);
    const [deviceId, setDeviceId] = useState<string | null>(null);

    const refreshTokenRef = useRef<string | null>(null);
    const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Lets scheduleRefresh call the latest handleAuthError without a circular useCallback dependency.
    const handleAuthErrorRef = useRef<() => Promise<void>>(async () => { });

    const clearRefreshTimer = useCallback(() => {
        if (refreshTimerRef.current) {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = null;
        }
    }, []);

    const scheduleRefresh = useCallback((expiresAt: number) => {
        clearRefreshTimer();
        const delay = expiresAt - Date.now() - REFRESH_BUFFER_MS;
        if (delay <= 0) {
            handleAuthErrorRef.current();
            return;
        }
        refreshTimerRef.current = setTimeout(() => { handleAuthErrorRef.current(); }, delay);
    }, [clearRefreshTimer]);

    const applyTokenResult = useCallback((result: TokenResult) => {
        const expiresAt = Date.now() + result.expiresIn * 1000;
        refreshTokenRef.current = result.refreshToken;

        window.localStorage.setItem('spotify_access_token', result.accessToken);
        window.localStorage.setItem('spotify_token_expires_at', String(expiresAt));
        if (result.refreshToken) {
            window.localStorage.setItem('spotify_refresh_token', result.refreshToken);
        }

        setToken(result.accessToken);
        dispatch({ type: 'SET_TOKEN', payload: result.accessToken });
        scheduleRefresh(expiresAt);
    }, [scheduleRefresh]);

    // Refreshes the access token proactively, ~1 min before it expires, so playback
    // never hits a 401 mid-song. Also used reactively when an API call reports 401.
    const handleAuthError = useCallback(async () => {
        const rt = refreshTokenRef.current;
        if (rt) {
            const result = await refreshAccessToken(rt);
            if (result) {
                applyTokenResult(result);
                return;
            }
        }
        // No refresh token, or the refresh itself failed (e.g. revoked) — force re-login.
        clearRefreshTimer();
        clearAuthStorage();
        refreshTokenRef.current = null;
        setToken(null);
        dispatch({ type: 'SET_TOKEN', payload: '' });
    }, [applyTokenResult, clearRefreshTimer]);

    useEffect(() => {
        handleAuthErrorRef.current = handleAuthError;
    }, [handleAuthError]);

    // State Persistence
    useEffect(() => {
        const savedState = window.localStorage.getItem('hitstory_game_state');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                if (parsed && Array.isArray(parsed.players)) {
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

    // Cancel any pending refresh timer on unmount
    useEffect(() => {
        return () => clearRefreshTimer();
    }, [clearRefreshTimer]);

    const authCheckRef = useRef(false);

    useEffect(() => {
        if (authCheckRef.current) return;
        authCheckRef.current = true;

        const checkAuth = async () => {
            // 1. Priority: Check for PKCE code in query params (fresh login)
            const params = new URLSearchParams(window.location.search);
            const code = params.get("code");

            if (code) {
                const result = await getAccessToken(code);
                if (result) {
                    applyTokenResult(result);
                    window.history.replaceState({}, '', '/');
                } else {
                    console.error("Code exchange failed. Clearing old tokens to prevent stale state.");
                    clearAuthStorage();
                    window.location.search = '';
                }
                return;
            }

            // 2. Check localStorage (existing session)
            const storedToken = window.localStorage.getItem('spotify_access_token');
            if (storedToken) {
                const storedRefresh = window.localStorage.getItem('spotify_refresh_token');
                const storedExpiresAt = Number(window.localStorage.getItem('spotify_token_expires_at') || 0);
                refreshTokenRef.current = storedRefresh || null;

                if (storedExpiresAt && Date.now() >= storedExpiresAt - REFRESH_BUFFER_MS) {
                    if (storedRefresh) {
                        // Expired or about to expire — refresh now instead of trusting the stale token.
                        await handleAuthError();
                    } else {
                        // No refresh token on file (older saved session) — use it until it 401s.
                        setToken(storedToken);
                        dispatch({ type: 'SET_TOKEN', payload: storedToken });
                    }
                } else {
                    setToken(storedToken);
                    dispatch({ type: 'SET_TOKEN', payload: storedToken });
                    if (storedExpiresAt) scheduleRefresh(storedExpiresAt);
                }
                return;
            }

            // 3. Legacy hash (implicit flow fallback)
            const hashToken = getTokenFromUrl();
            if (hashToken) {
                setToken(hashToken);
                window.localStorage.setItem('spotify_access_token', hashToken);
                window.location.hash = "";
                dispatch({ type: 'SET_TOKEN', payload: hashToken });
            }
        };
        checkAuth();
    }, [applyTokenResult, handleAuthError, scheduleRefresh]); // Run once on mount (guarded by authCheckRef)

    const login = async () => {
        const url = await setupPKCE();
        window.location.href = url;
    };

    const logout = () => {
        clearRefreshTimer();
        refreshTokenRef.current = null;
        setToken(null);
        clearAuthStorage();
        dispatch({ type: 'SET_TOKEN', payload: '' }); // Clear token in state
    };

    return (
        <GameContext.Provider value={{ state, dispatch, token, deviceId, setDeviceId, login, logout, handleAuthError }}>
            {children}
        </GameContext.Provider>
    );
};
