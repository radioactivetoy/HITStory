import { createContext } from 'react';
import type React from 'react';
import type { GameAction } from '../store/gameReducer';
import type { GameState } from '../types';

export interface GameContextType {
    state: GameState;
    dispatch: React.Dispatch<GameAction>;
    token: string | null;
    deviceId: string | null;
    setDeviceId: (id: string) => void;
    login: () => void;
    logout: () => void;
    handleAuthError: () => Promise<void>;
}

export const GameContext = createContext<GameContextType | undefined>(undefined);
