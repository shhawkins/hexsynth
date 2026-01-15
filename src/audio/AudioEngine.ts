import * as Tone from 'tone';
import { createEffect, type EffectType, updateEffectStrength } from './effects';
import { v4 as uuidv4 } from 'uuid';

export type VoiceType = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'pulse' | 'fmsynth' | 'amsynth' | 'membrane' | 'metal';

interface TouchEventData {
  time: number; // Relative to loop start (seconds)
  x: number;
  y: number;
  id: number;
  color?: string; // Store color for playback
}

export interface LoopTrack {
  id: string;
  player: Tone.Player;
  volumeNode: Tone.Gain;
  audioBuffer: AudioBuffer | null;
  ghostEvents: TouchEventData[];
  isRecording: boolean;
  isPlaying: boolean;
  color: string;
}

class Voice {
  synth: Tone.Synth | Tone.FMSynth | Tone.AMSynth | Tone.MembraneSynth | Tone.MetalSynth | Tone.MonoSynth;
  gain: Tone.Gain;
  frequency: number = 440;

  constructor(type: VoiceType, destination: Tone.ToneAudioNode) {
    this.gain = new Tone.Gain(0).connect(destination);

    // Initialize specific synth based on type
    const commonOptions = {
      oscillator: { type: type === 'pulse' ? 'pulse' : type } as any,
      envelope: { attack: 0.05, decay: 0.1, sustain: 1, release: 0.1 }
    };

    if (type === 'fmsynth') {
      this.synth = new Tone.FMSynth().connect(this.gain);
    } else if (type === 'amsynth') {
      this.synth = new Tone.AMSynth().connect(this.gain);
    } else if (type === 'membrane') {
      this.synth = new Tone.MembraneSynth().connect(this.gain);
    } else if (type === 'metal') {
      this.synth = new Tone.MetalSynth().connect(this.gain);
    } else {
      if (type === 'pulse') {
        this.synth = new Tone.MonoSynth({ oscillator: { type: 'pulse' } }).connect(this.gain);
      } else {
        this.synth = new Tone.Synth(commonOptions).connect(this.gain);
      }
    }
  }

  triggerAttack(freq: number, vol: number) {
    this.frequency = freq;
    // Ramp volume
    this.gain.gain.cancelScheduledValues(Tone.now());
    this.gain.gain.rampTo(vol, 0.05);

    // Trigger synth
    this.synth.triggerAttack(freq);
  }

  setNote(freq: number, vol: number) {
    this.frequency = freq;
    // Smooth frequency ramp (theremin style)
    if (this.synth instanceof Tone.Synth || this.synth instanceof Tone.MonoSynth || this.synth instanceof Tone.FMSynth || this.synth instanceof Tone.AMSynth) {
      this.synth.frequency.rampTo(freq, 0.05);
    } else {
      // Membrane/Metal might not support ramping the same way
      this.synth.frequency.value = freq;
    }

    this.gain.gain.rampTo(vol, 0.05);
  }

  triggerRelease() {
    this.synth.triggerRelease();
    this.gain.gain.rampTo(0, 0.1);
  }

  dispose() {
    this.synth.dispose();
    this.gain.dispose();
  }
}

export class AudioEngine {
  private static instance: AudioEngine;

  public context: any;
  private mainBus: Tone.Gain;
  private mixBus: Tone.Gain;
  private effectBus: Tone.Gain;
  private toneFilter: Tone.Filter; // New Tone Filter

  private voices: Map<number, Voice> = new Map();
  private currentVoiceType: VoiceType = 'sine';

  // Effects
  public effects: (Tone.ToneAudioNode | null)[] = [null, null, null, null, null, null];
  private effectNodes: (Tone.ToneAudioNode | Tone.Gain)[] = [];

  // Looper
  public tracks: LoopTrack[] = [];
  private recorder: Tone.Recorder;
  public masterLoopDuration: number | null = null;

  // Analysis
  public waveform: Tone.Waveform;

  // Settings
  public rootFreq: number = 261.63;
  public octaveRange: number = 2;

  private constructor() {
    this.context = Tone.context;

    this.mixBus = new Tone.Gain(1).toDestination();
    this.waveform = new Tone.Waveform(512);
    this.mixBus.connect(this.waveform);

    this.mainBus = new Tone.Gain(1);
    this.effectBus = new Tone.Gain(1);
    this.toneFilter = new Tone.Filter(20000, "lowpass"); // Initialize filter

    this.rebuildEffectChain();

    this.mainBus.connect(this.mixBus);

    this.recorder = new Tone.Recorder();
    this.mainBus.connect(this.recorder);

    for (let i = 0; i < 4; i++) {
      const vol = new Tone.Gain(0.8).connect(this.mixBus);
      this.tracks.push({
        id: uuidv4(),
        player: new Tone.Player(),
        volumeNode: vol,
        audioBuffer: null,
        ghostEvents: [],
        isRecording: false,
        isPlaying: false,
        color: ['#00f0ff', '#ff0055', '#ccff00', '#aa00ff'][i]
      });
    }
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public async start() {
    await Tone.start();
    Tone.Transport.start();
    console.log('Audio Engine Started');
  }

  public setVoiceType(type: VoiceType) {
    this.currentVoiceType = type;
    this.releaseAll();
  }

  public setTone(value: number) {
    // Logarithmic mapping 100Hz -> 20000Hz
    const min = 100;
    const max = 20000;
    const freq = min * Math.pow(max / min, value);
    this.toneFilter.frequency.rampTo(freq, 0.1);
  }

  public setEffect(index: number, type: EffectType | null) {
    if (this.effects[index]) {
      this.effects[index]?.dispose();
    }
    this.effects[index] = type ? createEffect(type) : null;
    this.rebuildEffectChain();
  }

  public updateEffectParameter(index: number, strength: number) {
    const effect = this.effects[index];
    if (effect) {
      updateEffectStrength(effect, strength);
    }
  }

  private rebuildEffectChain() {
    this.effectBus.disconnect();
    this.toneFilter.disconnect();
    this.effectNodes.forEach(n => n.disconnect());

    // Chain: effectBus -> toneFilter -> effects... -> mainBus
    this.effectBus.connect(this.toneFilter);
    let currentInput: Tone.ToneAudioNode = this.toneFilter;

    this.effectNodes = [];

    this.effects.forEach(eff => {
      const node = eff || new Tone.Gain(1);
      currentInput.connect(node);
      currentInput = node;
      this.effectNodes.push(node);
    });

    currentInput.connect(this.mainBus);
  }

  public startNote(touchId: number, frequency: number, volume: number) {
    if (this.voices.has(touchId)) {
      this.updateNote(touchId, frequency, volume);
      return;
    }
    const voice = new Voice(this.currentVoiceType, this.effectBus);
    voice.triggerAttack(frequency, volume);
    this.voices.set(touchId, voice);
  }

  public updateNote(touchId: number, frequency: number, volume: number) {
    const voice = this.voices.get(touchId);
    if (voice) {
      voice.setNote(frequency, volume);
    }
  }

  public stopNote(touchId: number) {
    const voice = this.voices.get(touchId);
    if (voice) {
      voice.triggerRelease();
      setTimeout(() => {
        voice.dispose();
        if (this.voices.get(touchId) === voice) {
          this.voices.delete(touchId);
        }
      }, 200);
      this.voices.delete(touchId);
    }
  }

  public releaseAll() {
    this.voices.forEach(v => {
      v.triggerRelease();
      setTimeout(() => v.dispose(), 200);
    });
    this.voices.clear();
  }

  // --- Looper Logic ---

  public async startRecording(trackIndex: number) {
    // Prevent multiple recordings
    if (this.tracks.some(t => t.isRecording)) return;

    const track = this.tracks[trackIndex];

    // Stop playback if existing
    track.player.stop();
    track.player.unsync(); // Unsync previous

    track.ghostEvents = [];
    track.isRecording = true;

    // If master duration not set, we are setting it now
    if (this.masterLoopDuration === null) {
      // First track logic
      // We just start recording
      this.recorder.start();
    } else {
      // Subsequent track logic
      // We should ideally sync to Transport loop start
      // For simplicity in this non-sequencer UI, we just start recording immediately
      // and user plays along. We will trim/sync playback to transport later.
      // Actually, if we want "Ghost Notes" alignment, we need to record relative to Transport time.
      // But Recorder is raw audio.
      // Let's just record.
      this.recorder.start();
    }
  }

  public recordTouchEvent(trackIndex: number, x: number, y: number, id: number, color: string) {
    const track = this.tracks[trackIndex];
    if (track.isRecording) {
      // If Master Loop is active, we store time relative to loop progress?

      if (this.masterLoopDuration !== null) {
        // Future improvement: use Transport progress for quantization
      }

      track.ghostEvents.push({
        time: Tone.now(), // Raw time, will offset later
        x, y, id, color
      });
    }
  }

  public async stopRecording(trackIndex: number) {
    const track = this.tracks[trackIndex];
    if (!track.isRecording) return;

    const now = Tone.now();
    track.isRecording = false;

    try {
      const blob = await this.recorder.stop();
      const url = URL.createObjectURL(blob);
      const buffer = new Tone.Buffer(url);
      await buffer.loaded;

      // Logic for Master Loop
      if (this.masterLoopDuration === null) {
        // This was the first track. Set Master Duration.
        this.masterLoopDuration = buffer.duration;
        Tone.Transport.loop = true;
        Tone.Transport.loopStart = 0;
        Tone.Transport.loopEnd = this.masterLoopDuration;

        // Normalize Ghost Events (make relative to start)
        const startTime = now - buffer.duration;
        track.ghostEvents.forEach(e => {
          e.time = (e.time - startTime);
        });
      } else {
        // Subsequent track.
        track.ghostEvents.forEach(e => {
          const startTime = now - buffer.duration;
          e.time = (e.time - startTime) % this.masterLoopDuration!;
        });
      }

      track.audioBuffer = buffer.get() || null;
      track.player.buffer = buffer;

      // SYNC TO TRANSPORT
      track.player.sync().start(0);

      // If Transport isn't running, start it? (It should be running if we called start())
      if (Tone.Transport.state !== 'started') {
        Tone.Transport.start();
      }

      track.isPlaying = true;

    } catch (e) {
      console.error("Recording failed", e);
    }
  }

  public toggleTrackPlayback(trackIndex: number) {
    const track = this.tracks[trackIndex];
    if (track.isPlaying) {
      track.player.mute = true; // Mute instead of stop to keep sync
      track.isPlaying = false;
    } else if (track.player.buffer) {
      track.player.mute = false;
      track.isPlaying = true;
    }
  }

  public setTrackVolume(trackIndex: number, vol: number) {
    this.tracks[trackIndex].volumeNode.gain.rampTo(vol, 0.1);
  }

  public clearAllLoops() {
    this.masterLoopDuration = null;
    Tone.Transport.stop();
    Tone.Transport.cancel(); // Clear scheduled events
    this.tracks.forEach(t => {
      t.player.stop();
      t.player.unsync();
      t.player.dispose();
      t.player = new Tone.Player();
      t.audioBuffer = null;
      t.ghostEvents = [];
      t.isRecording = false;
      t.isPlaying = false;
      t.player.connect(t.volumeNode);
    });
  }
}