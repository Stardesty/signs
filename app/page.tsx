'use client';

import React, { useEffect, useState } from 'react';
import { ProjectProvider, useProject } from '@/lib/store';
import { Binder, Editor, Inspector } from '@/components/Manuscript';
import { CardsView, PlotGridView, TimelineView } from '@/components/PlotViews';
import { CharactersView, RelationshipView } from '@/components/CharacterViews';
import { WorldView, InsightsView, SeriesView } from '@/components/WorldViews';
import SynastryView from '@/components/SynastryView';
import { fullAnalysis } from '@/lib/analysis';

type View =
  | 'manuscript' | 'cards' | 'plot' | 'timeline' | 'characters'
  | 'relationships' | 'world' | 'synastry' | 'insights' | 'series';

const TABS: { id: View; label: string; glyph: string }[] = [
  { id: 'manuscript', label: 'Manuscript', glyph: '✎' },
  { id: 'cards', label: 'Cards', glyph: '▤' },
  { id: 'plot', label: 'Plot Grid', glyph: '⊞' },
  { id: 'timeline', label: 'Timeline', glyph: '⟿' },
  { id: 'characters', label: 'Characters', glyph: '☺' },
  { id: 'relationships', label: 'Relations', glyph: '⚯' },
  { id: 'world', label: 'World', glyph: '◍' },
  { id: 'synastry', label: 'Synastry', glyph: '☉' },
  { id: 'insights', label: 'Insights', glyph: '◈' },
  { id: 'series', label: 'Series', glyph: '❑' },
];

function Shell() {
  const { project, ready } = useProject();
  const [view, setView] = useState<View>('manuscript');
  const [sceneId, setSceneId] = useState<string | null>(project.scenes[0]?.id ?? null);
  const [split, setSplit] = useState<string | null>(null);
  const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health').then((r) => r.json()).then((j) => setAiConfigured(!!j.aiConfigured)).catch(() => setAiConfigured(false));
  }, []);

  const report = ready ? fullAnalysis(project) : null;

  const openScene = (id: string) => { setSceneId(id); setView('manuscript'); };

  const toggleSplit = () => {
    if (split) { setSplit(null); return; }
    const others = project.scenes.filter((s) => s.id !== sceneId);
    setSplit(others[0]?.id ?? null);
  };

  return (
    <div className="app">
      <div className="ribbon">
        <div className="brand">
          <span className="brand-mark">✦</span>
          <span className="brand-name">Building The End</span>
          <span className="brand-sub">(Signs)</span>
        </div>
        {TABS.map((t) => (
          <button key={t.id} className={`tab${view === t.id ? ' active' : ''}`} onClick={() => setView(t.id)}>
            <span className="tab-glyph">{t.glyph}</span>{t.label}
          </button>
        ))}
        <div className="ribbon-right">
          {report && (
            <span className={`pill ${report.health > 80 ? 'good' : report.health > 55 ? 'warn' : 'bad'}`}>
              health {report.health}
            </span>
          )}
          {report && report.counts.critical > 0 && (
            <span className="pill bad">{report.counts.critical} critical</span>
          )}
          <span className="pill" title={aiConfigured ? 'LLM provider configured' : 'Running on the deterministic engine — add an API key to enable prose synthesis'}>
            {aiConfigured === null ? '…' : aiConfigured ? 'AI: live' : 'AI: local'}
          </span>
        </div>
      </div>

      <div className="body">
        {view === 'manuscript' ? (
          <>
            <div className="pane-left"><Binder selected={sceneId} onSelect={setSceneId} /></div>
            <div className="pane-center"><Editor sceneId={sceneId} split={split} onToggleSplit={toggleSplit} /></div>
            <div className="pane-right"><Inspector sceneId={sceneId} /></div>
          </>
        ) : (
          <div className="pane-center" style={{ flexDirection: 'row' }}>
            {view === 'cards' && <CardsView onOpen={openScene} />}
            {view === 'plot' && <PlotGridView onOpen={openScene} />}
            {view === 'timeline' && <TimelineView onOpen={openScene} />}
            {view === 'characters' && <CharactersView />}
            {view === 'relationships' && <RelationshipView />}
            {view === 'world' && <WorldView />}
            {view === 'synastry' && <SynastryView />}
            {view === 'insights' && <InsightsView />}
            {view === 'series' && <SeriesView />}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return (
    <ProjectProvider>
      <Shell />
    </ProjectProvider>
  );
}
