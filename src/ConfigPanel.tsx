import React from 'react';
import { CanvasElement, FxTarget, MidiMessageConfig, FreeMidiMessage, QUANTIZE_LENGTHS, QuantizeMode } from './types';
import { Plus, Trash2, Copy, Trash } from 'lucide-react';
import { ThemeStyle } from './ButtonCanvas';
import { getContrastColor } from './lib/colorUtils';

interface ConfigPanelProps {
  element: CanvasElement;
  updateElement: (el: CanvasElement) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  accentColor: string;
  theme: ThemeStyle;
}

// ─── Shared Data ─────────────────────────────────────────────────────────────

const FX_OPTIONS = [
  { value: -1, label: 'None' },
  { value: 0, label: 'LPF' }, { value: 1, label: 'BPF' }, { value: 2, label: 'HPF' },
  { value: 3, label: 'Phaser' }, { value: 4, label: 'Flanger' }, { value: 5, label: 'Synth' },
  { value: 6, label: 'Lofi' }, { value: 7, label: 'Radio' }, { value: 8, label: 'Ring Modulator' },
  { value: 9, label: 'Guitar 2 Bass' }, { value: 10, label: 'Sustainer' }, { value: 11, label: 'Auto Arp' },
  { value: 12, label: 'Slow Gear' }, { value: 13, label: 'Transpose' }, { value: 14, label: 'Pitch Bend' },
  { value: 15, label: 'Robot' }, { value: 16, label: 'Electric' }, { value: 17, label: 'Harmony Manual' },
  { value: 18, label: 'Harmony Auto' }, { value: 19, label: 'Vocoder' }, { value: 20, label: 'Osc Voc' },
  { value: 21, label: 'Osc Bot' }, { value: 22, label: 'Pre Amp' }, { value: 23, label: 'Dist' },
  { value: 24, label: 'Dynamics' }, { value: 25, label: 'Equalizer' }, { value: 26, label: 'Isolator' },
  { value: 27, label: 'Octave' }, { value: 28, label: 'Auto Pan' }, { value: 29, label: 'Manual Pan' },
  { value: 30, label: 'Stereo Enhance' }, { value: 31, label: 'Tremelo' }, { value: 32, label: 'Vibrato' },
  { value: 33, label: 'Pattern Slicer' }, { value: 34, label: 'Step Slicer' }, { value: 35, label: 'Delay' },
  { value: 36, label: 'Pan Delay' }, { value: 37, label: 'Reverse Delay' }, { value: 38, label: 'Mod Delay' },
  { value: 39, label: 'Tape Echo 1' }, { value: 40, label: 'Tape Echo 2' }, { value: 41, label: 'Grain Delay' },
  { value: 42, label: 'Warp' }, { value: 43, label: 'Twist' }, { value: 44, label: 'Roll 1' },
  { value: 45, label: 'Roll 2' }, { value: 46, label: 'Freeze' }, { value: 47, label: 'Chorus' },
  { value: 48, label: 'Reverb' }, { value: 49, label: 'Gate Reverb' }, { value: 50, label: 'Reverse Reverb' },
  { value: 51, label: 'Beat Scatter' }, { value: 52, label: 'Beat Repeat' }, { value: 53, label: 'Beat Shift' },
  { value: 54, label: 'Vinyl Flick' }
];

const TARGET_ORDER: FxTarget[] = ['inputA', 'inputB', 'inputC', 'inputD', 'trackA', 'trackB', 'trackC', 'trackD'];

const TARGETS: { value: FxTarget; label: string }[] = [
  { value: 'inputA', label: 'Input FX A (CC 1)' },
  { value: 'inputB', label: 'Input FX B (CC 2)' },
  { value: 'inputC', label: 'Input FX C (CC 3)' },
  { value: 'inputD', label: 'Input FX D (CC 4)' },
  { value: 'trackA', label: 'Track FX A (CC 5)' },
  { value: 'trackB', label: 'Track FX B (CC 6)' },
  { value: 'trackC', label: 'Track FX C (CC 7)' },
  { value: 'trackD', label: 'Track FX D (CC 8)' },
];



// ─── Config Panel ────────────────────────────────────────────────────────────

const ConfigPanel: React.FC<ConfigPanelProps> = ({ element, updateElement, onDelete, onDuplicate, accentColor, theme }) => {
  const el = element;

  const bgColor = el.color || accentColor;
  const defaultTextColor = theme === 'wireframe' ? bgColor : getContrastColor(bgColor);

  const set = (updates: Partial<CanvasElement>) => {
    updateElement({ ...el, ...updates } as CanvasElement);
  };

  // ─── Common Fields ─────────────────────────────────────────────────────
  const commonFields = (
    <>
      <div className="input-group">
        <label>Label</label>
        <input className="text-input" value={el.label} onChange={e => set({ label: e.target.value })} placeholder="e.g. Build Up FX" />
      </div>

      {el.type !== 'fader' && (
        <div className="input-group">
          <label>Keyboard Shortcut</label>
          <input className="text-input" value={el.keybind} onChange={e => set({ keybind: e.target.value })} placeholder="Press a key..." maxLength={1} />
        </div>
      )}

      <div className="input-group">
        <label>Color</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={el.color || accentColor}
            onChange={e => set({ color: e.target.value })}
            title="Custom color"
            style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%', background: 'transparent' }}
          />
          <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => set({ color: undefined })}>
            Reset to Default
          </button>
        </div>
      </div>

      <div className="input-group">
        <label>Text Color</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="color"
            value={el.textColor || defaultTextColor}
            onChange={e => set({ textColor: e.target.value })}
            title="Custom text color"
            style={{ width: 28, height: 28, border: 'none', padding: 0, cursor: 'pointer', borderRadius: '50%', background: 'transparent' }}
          />
          <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => set({ textColor: undefined })}>
            Reset to Default
          </button>
        </div>
      </div>

      <div className="input-group">
        <label>Text Size ({el.fontSize || (el.type === 'fader' ? 0.85 : 1)}rem)</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input type="range" min="0.4" max="2.5" step="0.05" value={el.fontSize || (el.type === 'fader' ? 0.85 : 1)}
            onChange={e => set({ fontSize: parseFloat(e.target.value) })}
            style={{ flex: 1, accentColor: 'var(--accent-base)' }}
          />
          <button className="btn" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => set({ fontSize: undefined })}>
            Reset
          </button>
        </div>
      </div>
    </>
  );

  // ─── Quantization Config ───────────────────────────────────────────────
  const q = el.quantize || { mode: 'immediate', valueIndex: 2 }; // Default: immediate, 1 Beat

  const handleQModeChange = (mode: QuantizeMode) => {
    set({ quantize: { ...q, mode } });
  };

  const handleQValueChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    set({ quantize: { ...q, valueIndex: parseInt(e.target.value) } });
  };

  const quantizationConfig = el.type !== 'fader' && (
    <div style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
      <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', marginBottom: 8, display: 'block' }}>
        Timing & Quantization
      </label>
      
      <div style={{ display: 'flex', gap: 4, marginBottom: q.mode === 'immediate' ? 0 : 12 }}>
        {(['immediate', 'quantized', 'delay'] as QuantizeMode[]).map(m => (
          <button
            key={m}
            className={`btn ${q.mode === m ? 'btn-primary' : ''}`}
            style={{ flex: 1, padding: '6px 4px', fontSize: '0.7rem', textTransform: 'capitalize' }}
            onClick={() => handleQModeChange(m)}
          >
            {m}
          </button>
        ))}
      </div>

      {q.mode !== 'immediate' && (
        <div className="input-group" style={{ marginBottom: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <label style={{ fontSize: '0.75rem' }}>Length</label>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-base)' }}>
              {QUANTIZE_LENGTHS[q.valueIndex].label}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={QUANTIZE_LENGTHS.length - 1}
            step={1}
            value={q.valueIndex}
            onChange={handleQValueChange}
            style={{ width: '100%', accentColor: 'var(--accent-base)' }}
          />
        </div>
      )}
    </div>
  );

  // ─── FX Button Messages ────────────────────────────────────────────────
  const fxButtonMessages = el.type === 'fx_button' && (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>
          FX Payloads ({el.messages.length}/8)
        </label>
        {el.messages.length < 8 && (
          <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => {
            const nextTarget = TARGET_ORDER[el.messages.length] || 'inputA';
            const newMsg: MidiMessageConfig = { id: `msg-${Date.now()}`, target: nextTarget, fxType: -1 };
            set({ messages: [...el.messages, newMsg] });
          }}>
            <Plus size={12} /> Add
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {el.messages.map((msg, i) => (
          <div key={msg.id} style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Message {i + 1}</span>
              <Trash2 size={14} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={() => set({ messages: el.messages.filter(m => m.id !== msg.id) })} />
            </div>
             <select className="select-input" style={{ width: '100%', marginBottom: 6, fontSize: '0.8rem', padding: '6px' }} value={msg.target}
              onChange={e => {
                const newTarget = e.target.value as FxTarget;
                set({ 
                  messages: el.messages.map(m => {
                    if (m.id !== msg.id) return m;
                    // If switching AWAY from trackA and the type is > 50, reset it to 50
                    const newFxType = (newTarget !== 'trackA' && m.fxType > 50) ? 50 : m.fxType;
                    return { ...m, target: newTarget, fxType: newFxType };
                  }) 
                });
              }}>
              {TARGETS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <select className="select-input" style={{ width: '100%', fontSize: '0.8rem', padding: '6px' }} value={msg.fxType}
              onChange={e => set({ messages: el.messages.map(m => m.id === msg.id ? { ...m, fxType: parseInt(e.target.value) } : m) })}>
              {FX_OPTIONS.filter(opt => {
                if (msg.target === 'trackA') return true; // Track FX A allows all 0-54
                return opt.value <= 50; // Others limited to 50
              }).map(opt => <option key={opt.value} value={opt.value}>{opt.value >= 0 ? `${opt.value} - ` : ''}{opt.label}</option>)}
            </select>
          </div>
        ))}
        {el.messages.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: '10px 0' }}>No FX messages mapped yet.</div>}
      </div>
    </div>
  );

  // ─── Free Button Messages ──────────────────────────────────────────────
  const freeButtonMessages = el.type === 'free_button' && (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase' }}>
          CC Messages ({el.freeMessages.length}/16)
        </label>
        {el.freeMessages.length < 16 && (
          <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '0.75rem' }} onClick={() => {
            const newMsg: FreeMidiMessage = { id: `fmsg-${Date.now()}`, cc: 0, value: 0 };
            set({ freeMessages: [...el.freeMessages, newMsg] });
          }}>
            <Plus size={12} /> Add
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {el.freeMessages.map((msg, i) => (
          <div key={msg.id} style={{ background: 'var(--bg-base)', padding: 10, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>Message {i + 1}</span>
              <Trash2 size={14} color="var(--danger)" style={{ cursor: 'pointer' }} onClick={() => set({ freeMessages: el.freeMessages.filter(m => m.id !== msg.id) })} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>CC #</label>
                <input className="text-input" type="number" min={0} max={127} value={msg.cc}
                  onChange={e => set({ freeMessages: el.freeMessages.map(m => m.id === msg.id ? { ...m, cc: Math.min(127, Math.max(0, parseInt(e.target.value) || 0)) } : m) })} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>Value</label>
                <input className="text-input" type="number" min={0} max={127} value={msg.value}
                  onChange={e => set({ freeMessages: el.freeMessages.map(m => m.id === msg.id ? { ...m, value: Math.min(127, Math.max(0, parseInt(e.target.value) || 0)) } : m) })} />
              </div>
            </div>
          </div>
        ))}
        {el.freeMessages.length === 0 && <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center', padding: '10px 0' }}>No CC messages added yet.</div>}
      </div>
    </div>
  );

  // ─── Fader Config ──────────────────────────────────────────────────────
  const faderConfig = el.type === 'fader' && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="input-group">
        <label>MIDI CC Number</label>
        <input className="text-input" type="number" min={0} max={127} value={el.cc}
          onChange={e => set({ cc: Math.min(127, Math.max(0, parseInt(e.target.value) || 0)) })} />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <div className="input-group" style={{ flex: 1 }}>
          <label>Min Value</label>
          <input className="text-input" type="number" min={0} max={127} value={el.minValue}
            onChange={e => set({ minValue: Math.min(127, Math.max(0, parseInt(e.target.value) || 0)) })} />
        </div>
        <div className="input-group" style={{ flex: 1 }}>
          <label>Max Value</label>
          <input className="text-input" type="number" min={0} max={127} value={el.maxValue}
            onChange={e => set({ maxValue: Math.min(127, Math.max(0, parseInt(e.target.value) || 0)) })} />
        </div>
      </div>
    </div>
  );

  // ─── Memory Button Config ──────────────────────────────────────────────
  const memoryConfig = el.type === 'memory_button' && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="input-group" style={{ border: '1px solid var(--border-color)', padding: 12, borderRadius: 'var(--radius-sm)', background: 'var(--bg-base)' }}>
        <label style={{ color: 'var(--accent-base)' }}>Target Memory Number (1-99)</label>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginBottom: 8, lineHeight: 1.4 }}>
          Sets the Boss RC-505mk2 to this memory slot. <br/>
          (Sends MIDI PC {el.memoryNumber - 1})
        </div>
        <input className="text-input" type="number" min={1} max={99} value={el.memoryNumber}
          onChange={e => set({ memoryNumber: Math.min(99, Math.max(1, parseInt(e.target.value) || 1)) })} 
          style={{ fontSize: '1.2rem', padding: '8px 12px' }}/>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {el.type === 'fx_button' ? 'FX Button' : el.type === 'free_button' ? 'Free Button' : el.type === 'memory_button' ? 'Memory Button' : 'Fader'}
      </div>

      {commonFields}
      {fxButtonMessages}
      {freeButtonMessages}
      {faderConfig}
      {memoryConfig}
      {quantizationConfig}

      <div style={{ display: 'flex', gap: 8, marginTop: 8, borderTop: '1px solid var(--border-color)', paddingTop: 16 }}>
        <button className="btn" style={{ flex: 1 }} onClick={onDuplicate}>
          <Copy size={14} /> Duplicate
        </button>
        <button className="btn" style={{ flex: 1, color: 'var(--danger)', borderColor: 'var(--danger)' }} onClick={onDelete}>
          <Trash size={14} /> Delete
        </button>
      </div>
    </div>
  );
};

export default ConfigPanel;
