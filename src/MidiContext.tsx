import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { CanvasElement, FX_TARGET_CC_MAP, QUANTIZE_LENGTHS } from './types';

export interface MidiDevice {
  id: number;
  name: string;
}

interface MidiContextType {
  inputs: MidiDevice[];
  outputs: MidiDevice[];
  selectedInputId: number | null;
  selectedOutputId: number | null;
  tempo: number | null;
  beatFlash: 'off' | 'normal' | 'first';
  selectInput: (id: number | null) => void;
  selectOutput: (id: number | null) => void;
  refreshDevices: () => void;
  triggerElement: (el: CanvasElement) => void;
  sendCC: (cc: number, value: number) => void;
  sendPC: (program: number) => void;
  isRefreshing: boolean;
  timeSignature: number;
  setTimeSignature: (ts: number) => void;
}

const MidiContext = createContext<MidiContextType | null>(null);

export const useMidi = () => {
  const ctx = useContext(MidiContext);
  if (!ctx) throw new Error('useMidi must be used within MidiProvider');
  return ctx;
};

export const MidiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inputs, setInputs] = useState<MidiDevice[]>([]);
  const [outputs, setOutputs] = useState<MidiDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<number | null>(null);
  const [selectedOutputId, setSelectedOutputId] = useState<number | null>(null);
  const [tempo, setTempo] = useState<number | null>(null);
  const [beatFlash, setBeatFlash] = useState<'off' | 'normal' | 'first'>('off');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [timeSignature, setTimeSignature] = useState<number>(4);

  const macroQueue = useRef<{ el: CanvasElement; queuedAtTicks: number }[]>([]);
  const totalTicks = useRef(0);
  const totalBeats = useRef(0);
  const clockCount = useRef(0);
  const lastBeatTime = useRef(0);
  const beatDurations = useRef<number[]>([]);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPlaying = useRef(false);

  const refreshDevices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const ins: MidiDevice[] = await invoke('list_midi_inputs');
      const outs: MidiDevice[] = await invoke('list_midi_outputs');
      setInputs(ins);
      setOutputs(outs);
    } catch (e) {
      console.error('Failed to list MIDI devices', e);
    }
    setTimeout(() => setIsRefreshing(false), 400); // Visual feedback duration
  }, []);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  useEffect(() => {
    const unlisten1 = listen('midi-clock-tick', () => {
      if (!isPlaying.current) return;
      totalTicks.current++;
      clockCount.current++;
      if (clockCount.current >= 24) {
        clockCount.current = 0;
        totalBeats.current++;
        const now = performance.now();
        if (lastBeatTime.current > 0) {
          const dur = now - lastBeatTime.current;
          beatDurations.current.push(60000 / dur);
          if (beatDurations.current.length > 4) beatDurations.current.shift();
          const avg = beatDurations.current.reduce((a, b) => a + b, 0) / beatDurations.current.length;
          setTempo(Math.round(avg));
        }
        lastBeatTime.current = now;
        setBeatFlash((totalBeats.current - 1) % timeSignature === 0 ? 'first' : 'normal');
        if (flashTimeout.current) clearTimeout(flashTimeout.current);
        flashTimeout.current = setTimeout(() => setBeatFlash('off'), 100);
        processQueue();
      }
    });

    const unlisten2 = listen('midi-transport', (event) => {
      if (event.payload === 'stop') {
        isPlaying.current = false;
        setTempo(null); setBeatFlash('off');
        clockCount.current = 0; lastBeatTime.current = 0; beatDurations.current = [];
        totalTicks.current = 0; totalBeats.current = 0; macroQueue.current = [];
      } else if (event.payload === 'start') {
        isPlaying.current = true;
        clockCount.current = 23; totalTicks.current = -1; totalBeats.current = 0; macroQueue.current = [];
      } else if (event.payload === 'continue') {
        isPlaying.current = true;
      }
    });

    return () => { unlisten1.then(fn => fn()); unlisten2.then(fn => fn()); };
  }, []);

  const selectInput = async (id: number | null) => {
    try {
      if (id === null) {
        await invoke('disconnect_midi_input');
        setSelectedInputId(null);
      } else {
        await invoke('connect_midi_input', { portIndex: id });
        setSelectedInputId(id);
      }
    } catch (e) {
      console.error('Failed to change MIDI input', e);
    }
  };

  const selectOutput = async (id: number | null) => {
    try {
      if (id === null) {
        await invoke('disconnect_midi_output');
        setSelectedOutputId(null);
      } else {
        await invoke('connect_midi_output', { portIndex: id });
        setSelectedOutputId(id);
      }
    } catch (e) {
      console.error('Failed to change MIDI output', e);
    }
  };

  const sendCC = useCallback(async (cc: number, value: number) => {
    try { await invoke('send_midi_cc', { channel: 0, cc, value }); }
    catch (e) { console.error('Failed to send MIDI CC', e); }
  }, []);

  const sendPC = useCallback(async (program: number) => {
    try { await invoke('send_midi_pc', { channel: 0, program }); }
    catch (e) { console.error('Failed to send MIDI PC', e); }
  }, []);

  const executeElement = useCallback(async (el: CanvasElement) => {
    if (el.type === 'fx_button') {
      for (const msg of el.messages) {
        if (msg.fxType < 0) continue;
        const cc = FX_TARGET_CC_MAP[msg.target];
        await sendCC(cc, msg.fxType);
      }
    } else if (el.type === 'free_button') {
      for (const msg of el.freeMessages) {
        await sendCC(msg.cc, msg.value);
      }
    } else if (el.type === 'memory_button') {
      await sendPC(el.memoryNumber - 1);
    }
    // Faders are handled live during drag, not on trigger
  }, [sendCC, sendPC]);

  const processQueue = () => {
    if (macroQueue.current.length === 0) return;
    const remaining: typeof macroQueue.current = [];
    for (const entry of macroQueue.current) {
      const q = entry.el.quantize;
      if (!q || q.mode === 'immediate') {
        executeElement(entry.el);
        continue;
      }
      
      const conf = QUANTIZE_LENGTHS[q.valueIndex];
      const requiredTicks = conf.ticks || (conf.bars ? conf.bars * timeSignature * 24 : 0);
      
      let fire = false;
      if (q.mode === 'delay') {
        fire = (totalTicks.current - entry.queuedAtTicks) >= requiredTicks;
      } else if (q.mode === 'quantized') {
        fire = totalTicks.current > entry.queuedAtTicks && (totalTicks.current % requiredTicks === 0);
      }
      
      if (fire) executeElement(entry.el);
      else remaining.push(entry);
    }
    macroQueue.current = remaining;
  };

  const triggerElement = useCallback((el: CanvasElement) => {
    const mode = el.quantize?.mode || 'immediate';
    if (mode === 'immediate' || tempo === null) {
      executeElement(el);
    } else {
      macroQueue.current.push({ el, queuedAtTicks: totalTicks.current });
    }
  }, [executeElement, tempo]);

  return (
    <MidiContext.Provider value={{
      inputs, outputs, selectedInputId, selectedOutputId, tempo, beatFlash,
      selectInput, selectOutput, refreshDevices, triggerElement, sendCC, sendPC,
      isRefreshing, timeSignature, setTimeSignature
    }}>
      {children}
    </MidiContext.Provider>
  );
};
