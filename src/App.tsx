import { useState, useEffect, useCallback, useRef } from 'react';
import './App.css';
import { Play, Edit3, Plus, Undo2, Redo2, Music2, X, Settings, Save, FolderOpen, SlidersHorizontal, Zap, ExternalLink, Image, Sun, Moon, Grid, Magnet, RefreshCw, Bookmark, FilePlus } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { save, open, message } from '@tauri-apps/plugin-dialog';
import { openUrl } from '@tauri-apps/plugin-opener';
import { useMidi, MidiDevice } from './MidiContext';
import { CanvasElement } from './types';
import ButtonCanvas, { ThemeStyle } from './ButtonCanvas';
import ConfigPanel from './ConfigPanel';
import { getContrastColor } from './lib/colorUtils';

const loadSavedOption = <T,>(key: string, def: T): T => {
  const saved = localStorage.getItem(`505fx_${key}`);
  if (saved !== null) {
    try { return JSON.parse(saved); } catch { return def; }
  }
  return def;
};

function App() {
  const [mode, setMode] = useState<'perform' | 'edit'>('edit');
  const {
    inputs, outputs,
    selectedInputId, selectedOutputId,
    selectInput, selectOutput,
    tempo, beatFlash, timeSignature, setTimeSignature,
    refreshDevices, isRefreshing,
  } = useMidi();

  const [macros, setMacros] = useState<CanvasElement[]>([]);
  const [selectedMacroId, setSelectedMacroId] = useState<string | null>(null);
  const [lastSelectedMacro, setLastSelectedMacro] = useState<CanvasElement | null>(null);

  // ─── Undo / Redo ───────────────────────────────────────────────────────
  const [undoStack, setUndoStack] = useState<CanvasElement[][]>([]);
  const [redoStack, setRedoStack] = useState<CanvasElement[][]>([]);

  const commitSnapshot = useCallback((before: CanvasElement[]) => {
    setUndoStack(u => [...u, before]);
    setRedoStack([]);
  }, []);

  const macrosRef = useRef<CanvasElement[]>(macros);
  macrosRef.current = macros;

  const setMacrosWithHistory = useCallback((fn: (prev: CanvasElement[]) => CanvasElement[]) => {
    const snapshot = JSON.parse(JSON.stringify(macrosRef.current));
    setUndoStack(u => [...u, snapshot]);
    setRedoStack([]);
    setMacros(prev => fn(prev));
  }, []);

  const setMacrosLive = useCallback((fn: (prev: CanvasElement[]) => CanvasElement[]) => {
    setMacros(fn);
  }, []);

  const undo = useCallback(() => {
    const prevMacros = undoStack[undoStack.length - 1];
    if (!prevMacros) return;

    const currentSnapshot = JSON.parse(JSON.stringify(macrosRef.current));
    setRedoStack(r => [...r, currentSnapshot]);
    setUndoStack(u => u.slice(0, -1));
    setMacros(prevMacros);

    setSelectedMacroId(prev => {
      if (prev && !prevMacros.find(m => m.id === prev)) return null;
      return prev;
    });
  }, [undoStack]);

  const redo = useCallback(() => {
    const nextMacros = redoStack[redoStack.length - 1];
    if (!nextMacros) return;

    const currentSnapshot = JSON.parse(JSON.stringify(macrosRef.current));
    setUndoStack(u => [...u, currentSnapshot]);
    setRedoStack(r => r.slice(0, -1));
    setMacros(nextMacros);

    setSelectedMacroId(prev => {
      if (prev && !nextMacros.find(m => m.id === prev)) return null;
      return prev;
    });
  }, [redoStack]);

  // ─── Settings Modals ──────────────────────────────────────────────────
  const [showMidiModal, setShowMidiModal] = useState(false);
  const [showGeneralModal, setShowGeneralModal] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showCreditsModal, setShowCreditsModal] = useState(false);
  const [showBootPrompt, setShowBootPrompt] = useState(() => {
    return loadSavedOption<CanvasElement[]>('lastSessionMacros', []).length > 0;
  });

  // ─── Mode Toggle Key ─────────────────────────────────────────────────
  const [modeToggleKey, setModeToggleKey] = useState(() => loadSavedOption('modeToggleKey', 'Tab'));

  // ─── Theme ────────────────────────────────────────────────────────────
  const [theme, setTheme] = useState<ThemeStyle>(() => loadSavedOption('theme', 'filled'));
  const [colorMode, setColorMode] = useState<'dark' | 'light'>(() => loadSavedOption('colorMode', 'dark'));
  const [accentColor, setAccentColor] = useState(() => loadSavedOption('accentColor', '#00FF00'));
  const [bgImage, setBgImage] = useState<string>(() => loadSavedOption('bgImage', ''));
  const [bgBlur, setBgBlur] = useState(() => loadSavedOption('bgBlur', 0));
  const [bgOpacity, setBgOpacity] = useState(() => loadSavedOption('bgOpacity', 1.0));
  const [isAdjustingBg, setIsAdjustingBg] = useState(false);
  const [glowAmount, setGlowAmount] = useState(() => loadSavedOption('glowAmount', 1.0));
  const [snapToGrid, setSnapToGrid] = useState(() => loadSavedOption('snapToGrid', false));
  const [gridSize, setGridSize] = useState(() => loadSavedOption('gridSize', 50)); // in reference-space pixels
  const [showCornerGlow, setShowCornerGlow] = useState(() => loadSavedOption('showCornerGlow', true));
  const [animateCornerGlow, setAnimateCornerGlow] = useState(() => loadSavedOption('animateCornerGlow', false));

  // Auto-save session elements
  useEffect(() => {
    if (!showBootPrompt) {
      try {
        localStorage.setItem('505fx_lastSessionMacros', JSON.stringify(macros));
      } catch (e) {
        console.error('Failed to save session macros:', e);
      }
    }
  }, [macros, showBootPrompt]);

  // Save visual options
  useEffect(() => {
    try {
      localStorage.setItem('505fx_modeToggleKey', JSON.stringify(modeToggleKey));
      localStorage.setItem('505fx_theme', JSON.stringify(theme));
      localStorage.setItem('505fx_colorMode', JSON.stringify(colorMode));
      localStorage.setItem('505fx_accentColor', JSON.stringify(accentColor));
      localStorage.setItem('505fx_bgImage', JSON.stringify(bgImage));
      localStorage.setItem('505fx_bgBlur', JSON.stringify(bgBlur));
      localStorage.setItem('505fx_bgOpacity', JSON.stringify(bgOpacity));
      localStorage.setItem('505fx_glowAmount', JSON.stringify(glowAmount));
      localStorage.setItem('505fx_snapToGrid', JSON.stringify(snapToGrid));
      localStorage.setItem('505fx_gridSize', JSON.stringify(gridSize));
      localStorage.setItem('505fx_showCornerGlow', JSON.stringify(showCornerGlow));
      localStorage.setItem('505fx_animateCornerGlow', JSON.stringify(animateCornerGlow));
    } catch (e) {
      console.error('Failed to save settings to localStorage (possibly quota exceeded):', e);
    }
  }, [modeToggleKey, theme, colorMode, accentColor, bgImage, bgBlur, bgOpacity, glowAmount, snapToGrid, gridSize, showCornerGlow, animateCornerGlow]);

  const resetTheme = () => {
    setTheme('filled');
    setColorMode('dark');
    setAccentColor('#00FF00');
    setBgImage('');
    setBgBlur(0);
    setBgOpacity(1.0);
    setGlowAmount(1.0);
    setSnapToGrid(false);
    setGridSize(50);
    setShowCornerGlow(true);
    setAnimateCornerGlow(false);
  };

  // Apply dark/light mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', colorMode);
  }, [colorMode]);

  // Apply accent color global CSS vars
  useEffect(() => {
    let hex = accentColor;
    if (hex.startsWith('#')) hex = hex.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    
    document.documentElement.style.setProperty('--accent-base', `#${hex}`);
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      document.documentElement.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    }
    document.documentElement.style.setProperty('--accent-contrast', getContrastColor(accentColor));
  }, [accentColor]);

  const importBgImage = async () => {
    try {
      const path = await open({
        title: 'Select Background Image',
        filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
        multiple: false,
      });
      if (path && typeof path === 'string') {
        const dataUrl: string = await invoke('read_file_base64', { path });
        setBgImage(dataUrl);
      }
    } catch (e) {
      console.error('Failed to import background image', e);
    }
  };

  // ─── Save / Import Templates ──────────────────────────────────────────
  const continueSession = () => {
    setShowBootPrompt(false);
    const session = loadSavedOption<CanvasElement[]>('lastSessionMacros', []);
    setMacros(session);
    setUndoStack([]);
    setRedoStack([]);
  };

  const newProject = async () => {
    if (macros.length > 0) {
      const result = await message('Do you want to save your current project before starting a new one?', {
        title: 'Save Project',
        kind: 'info',
        buttons: { yes: 'Save & New', no: 'Discard & New', cancel: 'Cancel' }
      });

      const res = String(result).toLowerCase();
      if (res.includes('cancel') || result === null) return;
      if (res.includes('save')) {
        const saved = await saveTemplate();
        if (!saved) return;
      }
    }
    setMacros([]);
    setUndoStack([]);
    setRedoStack([]);
    localStorage.removeItem('505fx_lastSessionMacros');
    setShowBootPrompt(false);
  };

  const saveTemplate = async () => {
    try {
      const path = await save({
        title: 'Save Template',
        defaultPath: 'my-template.505fx',
        filters: [{ name: '505FX Template', extensions: ['505fx'] }],
      });
      if (!path) return false;
      const data = JSON.stringify(macrosRef.current, null, 2);
      await invoke('save_template', { path, data });
      return true;
    } catch (e) {
      console.error('Failed to save template', e);
      return false;
    }
  };

  const importTemplate = async () => {
    try {
      const path = await open({
        title: 'Import Template',
        filters: [{ name: '505FX Template', extensions: ['505fx'] }],
        multiple: false,
      });
      if (!path) return;
      const data: string = await invoke('load_template', { path });
      const loaded: CanvasElement[] = JSON.parse(data);
      if (Array.isArray(loaded)) {
        setMacrosWithHistory(() => loaded);
        setSelectedMacroId(null);
        setShowBootPrompt(false);
      }
    } catch (e) {
      console.error('Failed to import template', e);
    }
  };

  // ─── Create Elements ──────────────────────────────────────────────────
  const createFxButton = () => {
    const id = `macro-${Date.now()}`;
    setMacrosWithHistory(prev => [...prev, {
      type: 'fx_button' as const,
      id, x: 80 + Math.random() * 200, y: 80 + Math.random() * 200,
      width: 140, height: 90, label: 'New FX', keybind: '', messages: [], color: accentColor,
    }]);
    setSelectedMacroId(id);
    setShowCreateMenu(false);
  };

  const createFreeButton = () => {
    const id = `macro-${Date.now()}`;
    setMacrosWithHistory(prev => [...prev, {
      type: 'free_button' as const,
      id, x: 80 + Math.random() * 200, y: 80 + Math.random() * 200,
      width: 140, height: 90, label: 'Free CC', keybind: '', freeMessages: [], color: accentColor,
    }]);
    setSelectedMacroId(id);
    setShowCreateMenu(false);
  };

  const createMemoryButton = () => {
    const id = `macro-${Date.now()}`;
    setMacrosWithHistory(prev => [...prev, {
      type: 'memory_button' as const,
      id, x: 80 + Math.random() * 200, y: 80 + Math.random() * 200,
      width: 140, height: 90, label: 'Memory', keybind: '', memoryNumber: 1, color: accentColor,
    }]);
    setSelectedMacroId(id);
    setShowCreateMenu(false);
  };

  const createFader = () => {
    const id = `macro-${Date.now()}`;
    setMacrosWithHistory(prev => [...prev, {
      type: 'fader' as const,
      id, x: 80 + Math.random() * 200, y: 80 + Math.random() * 200,
      width: 60, height: 180, label: 'Fader', keybind: '',
      cc: 11, minValue: 0, maxValue: 127, currentValue: 0, color: accentColor,
    }]);
    setSelectedMacroId(id);
    setShowCreateMenu(false);
  };

  const deleteButton = useCallback((id: string) => {
    setMacrosWithHistory(prev => prev.filter(m => m.id !== id));
    setSelectedMacroId(null);
  }, [setMacrosWithHistory]);

  const duplicateButton = useCallback((id: string) => {
    setMacrosWithHistory(prev => {
      const source = prev.find(m => m.id === id);
      if (!source) return prev;
      const newId = `macro-${Date.now()}`;
      return [...prev, {
        ...JSON.parse(JSON.stringify(source)),
        id: newId, x: source.x + 20, y: source.y + 20, label: source.label + ' Copy',
      }];
    });
  }, [setMacrosWithHistory]);

  // ─── Global Key Listener ──────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'SELECT') return;

      if (e.key === modeToggleKey) {
        e.preventDefault();
        setMode(prev => {
          if (prev === 'edit') { setSelectedMacroId(null); return 'perform'; }
          return 'edit';
        });
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) redo(); else undo();
        return;
      }

      if (mode === 'perform') {
        const key = e.key.toLowerCase();
        const macro = macros.find(m => m.keybind.toLowerCase() === key);
        if (macro) {
          e.preventDefault();
          window.dispatchEvent(new CustomEvent('macro-trigger-down', { detail: macro.id }));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (mode === 'perform') {
        const key = e.key.toLowerCase();
        const macro = macros.find(m => m.keybind.toLowerCase() === key);
        if (macro) window.dispatchEvent(new CustomEvent('macro-trigger-up', { detail: macro.id }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp); };
  }, [macros, mode, undo, redo, modeToggleKey]);

  const handleUpdateMacro = (updated: CanvasElement) => {
    setMacrosWithHistory(prev => prev.map(m => m.id === updated.id ? updated : m));
    if (selectedMacroId === updated.id) {
      setLastSelectedMacro(updated);
    }
  };

  const selectedMacro = macros.find(m => m.id === selectedMacroId) || null;

  useEffect(() => {
    if (selectedMacro) setLastSelectedMacro(selectedMacro);
  }, [selectedMacro]);

  return (
    <div className="app-container">
      <header className="header">
        <div className="header-left">
          <div className="header-brand" onClick={() => setShowCreditsModal(true)} style={{ cursor: 'pointer', border: '2px solid var(--accent-base)', borderRadius: 'var(--radius-sm)', padding: '2px 8px' }} title="About LPL505">LPL505</div>

          {mode === 'edit' && (
            <div className="header-toolbar">
              <button className="btn" onClick={newProject} title="New Project">
                <FilePlus size={14} /> New
              </button>
              <button className="btn" onClick={importTemplate} title="Load Template">
                <FolderOpen size={14} /> Load
              </button>
              <button className="btn" onClick={saveTemplate} title="Save Template">
                <Save size={14} /> Save
              </button>
              
              <div className="toolbar-divider" />
              
              <button className="btn" onClick={undo} disabled={undoStack.length === 0} title="Undo (⌘Z)">
                <Undo2 size={14} />
              </button>
              <button className="btn" onClick={redo} disabled={redoStack.length === 0} title="Redo (⌘⇧Z)">
                <Redo2 size={14} />
              </button>
              {snapToGrid && (
                <button className="btn" title="Snap all elements to grid" onClick={() => {
                  setMacrosWithHistory(prev => prev.map(el => {
                    const g = gridSize;
                    const newX = Math.round(el.x / g) * g;
                    const newY = Math.round(el.y / g) * g;
                    const newRight = Math.round((el.x + el.width) / g) * g;
                    const newBottom = Math.round((el.y + el.height) / g) * g;
                    return {
                      ...el,
                      x: newX,
                      y: newY,
                      width: Math.max(g, newRight - newX),
                      height: Math.max(g, newBottom - newY),
                    };
                  }));
                }}>
                  <Magnet size={14} />
                </button>
              )}
              
              <div className="toolbar-divider" />
              
              {/* Create dropdown */}
              <div style={{ position: 'relative' }}>
                <button className="btn btn-primary" onClick={() => setShowCreateMenu(v => !v)}>
                  <Plus size={14} /> Add ▾
                </button>
                {showCreateMenu && (
                  <div className="create-dropdown">
                    <div className="create-dropdown-item" onClick={() => { createFxButton(); setShowCreateMenu(false); }}>
                      <Plus size={14} /> FX Button
                    </div>
                    <div className="create-dropdown-item" onClick={() => { createFreeButton(); setShowCreateMenu(false); }}>
                      <Zap size={14} /> Free Button
                    </div>
                    <div className="create-dropdown-item" onClick={() => { createMemoryButton(); setShowCreateMenu(false); }}>
                      <Bookmark size={14} /> Memory Button
                    </div>
                    <div className="create-dropdown-item" onClick={() => { createFader(); setShowCreateMenu(false); }}>
                      <SlidersHorizontal size={14} /> Fader
                    </div>
                  </div>
                )}
              </div>
              
              <div className="toolbar-divider" />
              
              <button className="btn" onClick={() => { refreshDevices(); setShowMidiModal(true); }}>
                <Settings size={14} /> MIDI
              </button>
              <button className="btn" onClick={() => setShowGeneralModal(true)}>
                <Settings size={14} /> General
              </button>
            </div>
          )}
        </div>

        <div className="header-controls">
          <div className="status-indicator">
            <div
              className="beat-dot"
              style={{
                width: 10, height: 10, borderRadius: '50%',
                background: beatFlash === 'first' ? '#ffffff' : beatFlash === 'normal' ? 'var(--accent-base)' : (tempo ? 'var(--success)' : 'var(--danger)'),
                boxShadow: beatFlash !== 'off' ? `0 0 12px ${beatFlash === 'first' ? '#ffffff' : 'var(--accent-glow)'}` : 'none',
                transition: 'background 0.05s, box-shadow 0.05s',
                transform: beatFlash !== 'off' ? 'scale(1.3)' : 'scale(1)',
              }}
            />
            <span>
              {selectedInputId === null ? 'No Sync Source' :
               tempo && tempo > 0 ? `${tempo} BPM • ${timeSignature}/4` : 'Waiting for Clock...'}
            </span>
          </div>

          <div className="segmented-control">
            <div className={`segment ${mode === 'edit' ? 'active' : ''}`} onClick={() => setMode('edit')}>
              <Edit3 size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Edit
            </div>
            <div className={`segment ${mode === 'perform' ? 'active' : ''}`} onClick={() => { setMode('perform'); setSelectedMacroId(null); }}>
              <Play size={14} style={{ marginRight: 6, verticalAlign: 'middle' }} /> Perform
            </div>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="canvas-area">
          {bgImage && (
            <div className="canvas-bg-image" style={{
              backgroundImage: `url(${bgImage})`,
              filter: `blur(${Math.pow(bgBlur, 2)}px)`,
              opacity: bgOpacity,
              transform: 'scale(1.1)', // Always scaled to prevent edge issues and jitter
            }} />
          )}
          {showCornerGlow && (
            <div 
              className={!animateCornerGlow ? 'glow-flow' : ''}
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                zIndex: 0,
                backgroundImage: `
                  radial-gradient(circle at 100% 100%, rgba(var(--accent-rgb), ${animateCornerGlow ? (beatFlash !== 'off' ? 0.3 : 0) : 0.12}) 0%, transparent 50%),
                  radial-gradient(circle at 0% 0%, rgba(var(--accent-rgb), ${animateCornerGlow ? (beatFlash !== 'off' ? 0.25 : 0) : 0.1}) 0%, transparent 40%)
                `,
                transition: animateCornerGlow ? (beatFlash !== 'off' ? 'background-image 0.05s ease-out' : 'background-image 0.2s ease-in') : 'background-image 0.5s ease',
              }} 
            />
          )}
          <ButtonCanvas
            mode={mode}
            macros={macros}
            setMacrosLive={setMacrosLive}
            commitSnapshot={commitSnapshot}
            selectedMacroId={selectedMacroId}
            onSelectMacro={setSelectedMacroId}
            theme={theme}
            accentColor={accentColor}
            glowAmount={glowAmount}
            snapToGrid={snapToGrid}
            gridSize={gridSize}
            showGrid={isAdjustingBg}
          />
        </div>

        {(() => {
          const activeMacro = selectedMacro || lastSelectedMacro;
          if (!activeMacro) return null;

          const showSidebar = mode === 'edit' && selectedMacro !== null;
          // Calculate the center of the button and compare to the center of the canvas (500)
          const buttonCenter = activeMacro.x + (activeMacro.width / 2);
          const isWidgetOnRight = buttonCenter > 500;
          const sidebarClassPosition = isWidgetOnRight ? 'left' : 'right';

          return (
            <aside className={`sidebar ${sidebarClassPosition} ${!showSidebar ? 'hidden' : ''}`}>
              <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-color)', paddingBottom: 16 }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 600 }}>Element Config</h2>
                <X size={16} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setSelectedMacroId(null)} />
              </div>
              <ConfigPanel
                element={activeMacro}
                accentColor={accentColor}
                theme={theme}
                updateElement={handleUpdateMacro}
                onDelete={() => deleteButton(activeMacro.id)}
                onDuplicate={() => duplicateButton(activeMacro.id)}
              />
            </aside>
          );
        })()}
      </main>

      {/* ── MIDI Settings Modal ────────────────────────────────────────── */}
      {showMidiModal && (
        <div className="modal-overlay" onClick={() => setShowMidiModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Music2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />MIDI Settings</h2>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowMidiModal(false)} />
            </div>

            <div className="input-group">
              <label>MIDI Input (Clock Sync)</label>
              <select className="select-input" value={selectedInputId !== null ? String(selectedInputId) : ''} onChange={e => selectInput(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">None</option>
                {inputs.map((d: MidiDevice) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>MIDI Output (Send CC)</label>
              <select className="select-input" value={selectedOutputId !== null ? String(selectedOutputId) : ''} onChange={e => selectOutput(e.target.value === '' ? null : Number(e.target.value))}>
                <option value="">None</option>
                {outputs.map((d: MidiDevice) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
              </select>
            </div>

            <div className="input-group">
              <label>Time Signature (Beats per Bar)</label>
              <input className="text-input" type="number" min="1" max="16" value={timeSignature} onChange={e => setTimeSignature(Math.min(16, Math.max(1, parseInt(e.target.value) || 4)))} />
            </div>

            <button className="btn" style={{ marginTop: 8 }} onClick={refreshDevices} disabled={isRefreshing}>
              {isRefreshing ? (
                <>
                  <RefreshCw size={14} className="spin" style={{ marginRight: 6 }} /> Refreshing...
                </>
              ) : (
                'Refresh Devices'
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── General Settings Modal ──────────────────────────────────────── */}
      {showGeneralModal && (
        <div className="modal-overlay" 
          onClick={() => setShowGeneralModal(false)}
          style={isAdjustingBg ? { backdropFilter: 'none', background: 'rgba(0,0,0,0.2)' } : undefined}
        >
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Settings size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />General Settings</h2>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowGeneralModal(false)} />
            </div>

            {/* Functionality Section */}
            <div className="input-group">
              <label>Toggle Mode Key (Edit ↔ Perform)</label>
              <input className="text-input" value={modeToggleKey} readOnly placeholder="Press a key..."
                onKeyDown={(e) => { e.preventDefault(); setModeToggleKey(e.key); }}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                Click the field above and press any key to rebind. Currently: <strong>{modeToggleKey}</strong>
              </span>
            </div>

            <div className="input-group">
              <label>Grid Mode</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`btn ${!snapToGrid ? 'btn-primary' : ''}`} style={{ flex: 1 }} onClick={() => setSnapToGrid(false)}>
                  Free
                </button>
                <button className={`btn ${snapToGrid ? 'btn-primary' : ''}`} style={{ flex: 1 }} onClick={() => setSnapToGrid(true)}>
                  <Grid size={14} /> Grid
                </button>
              </div>
            </div>

            {snapToGrid && (
              <div className="input-group">
                <label>Grid Size ({gridSize}px)</label>
                <input type="range" min="10" max="100" step="5" value={gridSize}
                  onChange={e => setGridSize(parseInt(e.target.value))}
                  onPointerDown={() => setIsAdjustingBg(true)}
                  onPointerUp={() => setIsAdjustingBg(false)}
                  style={{ width: '100%', accentColor: 'var(--accent-base)' }}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                  <span>Fine</span><span>Medium</span><span>Coarse</span>
                </div>
              </div>
            )}

            <div className="modal-divider" />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: -4 }}>Visual Settings</div>

            {/* Visual Section */}
            <div className="input-group">
              <label>Global Accent Color</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="color" value={accentColor} onChange={e => setAccentColor(e.target.value)} 
                  style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%', background: 'transparent' }} />
                <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => setAccentColor('#00FF00')}>
                  Reset to Default
                </button>
              </div>
            </div>

            <div className="input-group">
              <label>Appearance</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`btn ${colorMode === 'dark' ? 'btn-primary' : ''}`} style={{ flex: 1 }} onClick={() => setColorMode('dark')}>
                  <Moon size={14} /> Dark
                </button>
                <button className={`btn ${colorMode === 'light' ? 'btn-primary' : ''}`} style={{ flex: 1 }} onClick={() => setColorMode('light')}>
                  <Sun size={14} /> Light
                </button>
              </div>
            </div>

            <div className="input-group">
              <label>Element Theme</label>
              <select className="select-input" value={theme} onChange={e => setTheme(e.target.value as ThemeStyle)}>
                <option value="filled">Filled</option>
                <option value="wireframe">Wireframe</option>
              </select>
            </div>

            <div className="input-group">
              <label>Glow Intensity ({Math.round(glowAmount * 100)}%)</label>
              <input type="range" min="0" max="2" step="0.05" value={glowAmount}
                onChange={e => setGlowAmount(parseFloat(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--accent-base)' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>
                <span>Off</span><span>Normal</span><span>Max</span>
              </div>
            </div>

            <div className="input-group">
              <label>Background Image</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={importBgImage}>
                  <Image size={14} /> Choose Image
                </button>
                {bgImage && (
                  <button className="btn" style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={() => setBgImage('')}>
                    <X size={14} /> Remove
                  </button>
                )}
              </div>
              {bgImage && (
                <>
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Image Blur</label>
                    <input type="range" min="0" max="6" step="0.1" value={bgBlur}
                      onChange={e => setBgBlur(parseFloat(e.target.value))}
                      onPointerDown={() => setIsAdjustingBg(true)}
                      onPointerUp={() => setIsAdjustingBg(false)}
                      style={{ width: '100%', accentColor: 'var(--accent-base)', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Image Opacity ({Math.round(bgOpacity * 100)}%)</label>
                    <input type="range" min="0" max="1" step="0.01" value={bgOpacity}
                      onChange={e => setBgOpacity(parseFloat(e.target.value))}
                      onPointerDown={() => setIsAdjustingBg(true)}
                      onPointerUp={() => setIsAdjustingBg(false)}
                      style={{ width: '100%', accentColor: 'var(--accent-base)', marginTop: 4 }}
                    />
                  </div>
                  <div style={{ marginTop: 10, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                    <img src={bgImage} alt="Background preview" style={{ width: '100%', height: 60, objectFit: 'cover' }} />
                  </div>
                </>
              )}
            </div>

            <div className="input-group">
              <label>Background Corner Glows</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={showCornerGlow} onChange={e => setShowCornerGlow(e.target.checked)} style={{ accentColor: 'var(--accent-base)' }} />
                  Show subtle radial glows in corners
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: '0.85rem', opacity: showCornerGlow ? 1 : 0.5 }}>
                  <input type="checkbox" checked={animateCornerGlow} disabled={!showCornerGlow} onChange={e => setAnimateCornerGlow(e.target.checked)} style={{ accentColor: 'var(--accent-base)' }} />
                  Animate glows with tempo (Pulse on beat)
                </label>
              </div>
            </div>

            <div style={{ marginTop: 24, padding: 16, background: 'var(--bg-panel)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
              <button className="btn" style={{ width: '100%', justifyContent: 'center', color: 'var(--text-primary)' }} onClick={resetTheme}>
                <RefreshCw size={14} style={{ marginRight: 6 }} /> Reset Visuals to Default
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Credits Modal ─────────────────────────────────────────────── */}
      {showCreditsModal && (
        <div className="modal-overlay" onClick={() => setShowCreditsModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>LPL505</h2>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowCreditsModal(false)} />
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6 }}>
              <strong>Launchpadless505.</strong> Control your Boss RC-505mk2 FX without a Launchpad.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
              <a href="#" onClick={(e) => { e.preventDefault(); openUrl('https://youtube.com/'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-base)', textDecoration: 'none', fontSize: '0.9rem' }}>
                <ExternalLink size={14} /> View the YouTube Tutorial
              </a>
              
              <a href="#" onClick={(e) => { e.preventDefault(); openUrl('https://discord.gg/XNXjXU3jde'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-base)', textDecoration: 'none', fontSize: '0.9rem' }}>
                <ExternalLink size={14} /> Found a bug? Report it here
              </a>

              <div className="modal-divider" />
              
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Credits
              </div>

              <a href="#" onClick={(e) => { e.preventDefault(); openUrl('https://www.youtube.com/@JMakesMusicx'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                <ExternalLink size={14} /> @JMakesMusicx on YouTube
              </a>
              <a href="#" onClick={(e) => { e.preventDefault(); openUrl('https://ko-fi.com/jmakesmusicx'); }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '0.85rem' }}>
                <ExternalLink size={14} /> Buy me a coffee (Ko-fi)
              </a>

              <div className="modal-divider" />
              
              <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Debug
              </div>
              <button className="btn" style={{ fontSize: '0.8rem', padding: '6px 10px', justifyContent: 'center' }} onClick={() => { 
                setShowCreditsModal(false); 
                setShowBootPrompt(true); 
              }}>
                <RefreshCw size={14} /> Return to Boot Screen
              </button>

              <div style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', textAlign: 'center', marginTop: 8 }}>
                Build v1.0.0-beta.1
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close create menu on click outside */}
      {showCreateMenu && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setShowCreateMenu(false)} />
      )}

      {/* ── Boot Prompt Modal ──────────────────────────────────────── */}
      {showBootPrompt && (
        <div className="modal-overlay" style={{ background: 'var(--bg-base)' }}>
          <div className="modal" style={{ alignItems: 'center', padding: 40, textAlign: 'center', width: 500, maxWidth: '90vw' }}>
            <h1 style={{ fontFamily: 'var(--font-display)', marginBottom: 8, fontSize: '2.5rem' }}>LPL<span style={{ color: 'var(--accent-base)' }}>505</span></h1>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 24, fontSize: '0.95rem' }}>
              Welcome back! Do you want to continue your last session or start fresh?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              <button className="btn btn-primary" style={{ width: '100%', padding: '14px 16px', justifyContent: 'center', fontSize: '1.05rem' }} onClick={continueSession}>
                <Play size={18} /> Continue Session
              </button>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button className="btn" style={{ flex: 1, padding: '12px 16px', justifyContent: 'center', fontSize: '0.95rem' }} onClick={importTemplate}>
                  <FolderOpen size={16} /> Load Preset
                </button>
                <button className="btn" style={{ flex: 1, padding: '12px 16px', justifyContent: 'center', fontSize: '0.95rem' }} onClick={newProject}>
                  <Plus size={16} /> New Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
