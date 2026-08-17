import React from 'react';
import { GameProvider } from './context/GameContext';
import { useGame } from './context/useGame';
import { SetupScreen } from './components/SetupScreen';
import { WebPlayback } from './components/WebPlayback';
import { GameScreen } from './components/GameScreen';

const GameContent: React.FC = () => {
  const { state } = useGame();

  if (state.currentPhase === 'SETUP') {
    return (
      <React.Fragment>
        <WebPlayback />
        <SetupScreen />
      </React.Fragment>
    );
  }

  return (
    <React.Fragment>
      <WebPlayback />
      <GameScreen />
    </React.Fragment>
  );
};

function App() {
  return (
    <GameProvider>
      <GameContent />
    </GameProvider>
  );
}

export default App;
