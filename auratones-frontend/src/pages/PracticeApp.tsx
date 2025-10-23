// src/pages/PracticeApp/PracticeApp.tsx
import React, { useState } from 'react';
import '../styles/PracticeApp.scss';

import Metronome from '../components/tools/Metronome';
import Tuner from '../components/tools/Tuner';
import SightReading from '../components/tools/SightReading';
import CircleOfFifths from '../components/tools/CircleOfFifths';
import PianoRoll from '../components/tools/PianoRoll';
import Header from '../components/Header';

// Comment: Danh sách các công cụ học tập (tool)
type ToolKey = 'metronome' | 'tuner' | 'sightreading' | 'circleoffifths' | 'pianoroll';

const PracticeApp: React.FC = () => {
  const [activeTool, setActiveTool] = useState<ToolKey>('metronome');

  // Comment: Render tool tương ứng dựa trên state hiện tại
  const renderActiveTool = () => {
    switch (activeTool) {
      case 'metronome':
        return <Metronome />;
      case 'tuner':
        return <Tuner />;
      case 'sightreading':
        return <SightReading />;
      case 'circleoffifths':
        return <CircleOfFifths />;
      case 'pianoroll':
        return <PianoRoll />;
      default:
        return null;
    }
  };

  return (
    <>
        <Header />    
        <div className="practice-app">
        {/* Sidebar nội bộ */}
        <aside className="practice-app__sidebar">
            <ul className="practice-app__menu">
            <li
                className={`practice-app__menu-item ${activeTool === 'metronome' ? 'is-active' : ''}`}
                onClick={() => setActiveTool('metronome')}
            >
                Metronome
            </li>
            <li
                className={`practice-app__menu-item ${activeTool === 'tuner' ? 'is-active' : ''}`}
                onClick={() => setActiveTool('tuner')}
            >
                Tuner
            </li>
            <li
                className={`practice-app__menu-item ${activeTool === 'sightreading' ? 'is-active' : ''}`}
                onClick={() => setActiveTool('sightreading')}
            >
                Sight-Reading
            </li>
            <li
                className={`practice-app__menu-item ${activeTool === 'circleoffifths' ? 'is-active' : ''}`}
                onClick={() => setActiveTool('circleoffifths')}
            >
                Circle of Fifths
            </li>
            <li
                className={`practice-app__menu-item ${activeTool === 'pianoroll' ? 'is-active' : ''}`}
                onClick={() => setActiveTool('pianoroll')}
            >
                Piano Roll
            </li>
            </ul>
        </aside>

        {/* Container hiển thị tool */}
        <section className="practice-app__content">
            {renderActiveTool()}
        </section>
        </div>
    </>
  );
};

export default PracticeApp;
