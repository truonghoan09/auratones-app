import React, { useMemo, useState } from 'react';
import Header from '../components/Header';
import { demoGuitarShapes } from '../lib/chords/demoShapes';

import '../styles/homepage.scss';
import ChordCard from '../components/chord/ChordCard';

interface Props {
  onLoginClick: () => void;
  onLogout: () => void;
}

const ChordsPage: React.FC<Props> = ({ onLoginClick, onLogout }) => {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    return demoGuitarShapes.filter(v => v.name.toLowerCase().includes(s));
  }, [q]);

  return (
    <>
      <Header onLoginClick={onLoginClick} onLogout={onLogout} />
      <div className="homepage-container">
        <div className="homepage-content" style={{maxWidth: 1100}}>
          <h1 style={{margin:'12px 0 16px'}}>Kho hợp âm (Guitar)</h1>
          <div style={{display:'flex', gap:12, alignItems:'center', marginBottom:16}}>
            <input
              placeholder="Nhập tên hợp âm… (vd: C, G, Amaj7)"
              value={q}
              onChange={e => setQ(e.target.value)}
              style={{
                flex:1, padding:'10px 12px', borderRadius:8, border:'1px solid rgba(0,0,0,.1)',
                background:'var(--card-background)', color:'var(--text-color)'
              }}
            />
          </div>

          <div style={{display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:16}}>
            {results.map(s => (
              <ChordCard key={s.id} shape={s} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export default ChordsPage;
