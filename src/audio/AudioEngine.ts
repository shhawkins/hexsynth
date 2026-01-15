import * as Tone from 'tone';
import { createEffect, type EffectType, updateEffectStrength } from './effects';
import { v4 as uuidv4 } from 'uuid';
import { Arpeggiator, type ArpPattern, type ArpRate } from './Arpeggiator';

export type VoiceType = 'sine' | 'triangle' | 'sawtooth' | 'square' | 'pulse' | 'fmsynth' | 'amsynth' | 'membrane' | 'metal' | 'pluck' | 'duo' | 'noise';

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
  synth: Tone.Synth | Tone.FMSynth | Tone.AMSynth | Tone.MembraneSynth | Tone.MetalSynth | Tone.MonoSynth | Tone.PluckSynth | Tone.DuoSynth | Tone.NoiseSynth;
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
    } else if (type === 'pluck') {
      this.synth = new Tone.PluckSynth().connect(this.gain);
    } else if (type === 'duo') {
      this.synth = new Tone.DuoSynth().connect(this.gain);
    } else if (type === 'noise') {
      this.synth = new Tone.NoiseSynth().connect(this.gain);
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
    if (this.synth instanceof Tone.NoiseSynth) {
      this.synth.triggerAttack();
    } else {
      // @ts-ignore - handled by type checks or runtime
      this.synth.triggerAttack(freq);
    }
  }

  setNote(freq: number, vol: number) {
    this.frequency = freq;
    // Smooth frequency ramp (theremin style)
    // Smooth frequency ramp (theremin style)
    if (this.synth instanceof Tone.NoiseSynth) {
      // Noise has no frequency
    } else if (this.synth instanceof Tone.PluckSynth) {
      // Pluck doesn't sustain well, but we can update freq
      // @ts-ignore
      this.synth.frequency.value = freq;
    } else if (this.synth instanceof Tone.Synth || this.synth instanceof Tone.MonoSynth || this.synth instanceof Tone.FMSynth || this.synth instanceof Tone.AMSynth || this.synth instanceof Tone.DuoSynth) {
      // @ts-ignore
      this.synth.frequency.rampTo(freq, 0.05);
    } else {
      // Membrane/Metal/Others
      // @ts-ignore
      if (this.synth.frequency) this.synth.frequency.value = freq;
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
  private compressor: Tone.Compressor;
  private limiter: Tone.Limiter;

  private voices: Map<number, Voice[]> = new Map();
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

  public arpeggiator: Arpeggiator;
  private activeArpTouches: Map<number, number[]> = new Map();

  private constructor() {
    this.context = Tone.context;

    // Mastering Chain
    this.limiter = new Tone.Limiter(-0.5).toDestination();
    this.compressor = new Tone.Compressor({
      threshold: -24,
      ratio: 6,
      attack: 0.05,
      release: 0.25
    }).connect(this.limiter);

    this.mixBus = new Tone.Gain(0.3).connect(this.compressor); // Lowered main mix further to prevent clipping
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
      // Lower default track volume slightly to leave headroom
      const vol = new Tone.Gain(0.7).connect(this.mixBus);
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

    // Initialize Arpeggiator
    this.arpeggiator = new Arpeggiator((freq) => {
      // Trigger a short note

      let duration = 0.5;
      // @ts-ignore
      try { duration = Tone.Time(this.arpeggiator.getRate()).toSeconds() * 0.9; } catch (e) { }

      const freqs = Array.isArray(freq) ? freq : [freq];

      freqs.forEach(f => {
        const v = new Voice(this.currentVoiceType, this.effectBus);
        v.triggerAttack(f, 0.7); // fixed vol for now
        v.synth.triggerRelease(Tone.now() + duration);
        setTimeout(() => v.dispose(), duration * 1000 + 500);
      });
    });
  }

  public static getInstance(): AudioEngine {
    if (!AudioEngine.instance) {
      AudioEngine.instance = new AudioEngine();
    }
    return AudioEngine.instance;
  }

  public start() {
    return this.startEngine();
  }

  public async startEngine() {
    await Tone.start();
    Tone.Transport.start();
    console.log('Audio Engine Started');
  }

  public setArpEnabled(enabled: boolean) {
    this.arpeggiator.setEnabled(enabled);
  }

  public setArpRate(rate: ArpRate) {
    this.arpeggiator.setRate(rate);
  }

  public setArpPattern(pattern: ArpPattern) {
    this.arpeggiator.setPattern(pattern);
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

  public setEffectParam(index: number, key: string, value: number) {
    const effect = this.effects[index];
    if (!effect) return;

    // @ts-ignore
    const param = effect[key];

    if (param && typeof param.rampTo === 'function') {
      // Smooth the transition to prevent zipper noise
      param.rampTo(value, 0.2);
    } else if (param && typeof param.value === 'number') {
      // It's a AudioParam or Signal but might not expose rampTo in types, or just set value
      param.value = value;
    } else {
      // It might be a regular property (like distortion amount on some nodes)
      // @ts-ignore
      effect[key] = value;
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

  public startNote(touchId: number, frequency: number | number[], volume: number) {
    if (this.voices.has(touchId)) {
      this.updateNote(touchId, frequency, volume);
      return;
    }

    const freqs = Array.isArray(frequency) ? frequency : [frequency];

    if (this.arpeggiator.getEnabled()) {
      // Add to arp
      freqs.forEach(f => this.arpeggiator.addNote(f));
      // We still track "voice" as strictly the touch existence for cleanup, 
      // but we don't hold a sustaining audio voice.
      // We put a dummy placeholder or nothing? 
      // Better: we map touchId to the specific frequencies so we can remove them later.
      // Let's store them in `voices` but as empty? No `voices` expects `Voice`.
      // Let's add a separate map for arp touches? 
      // Or: `Voice` class can have a "silent" mode?
      // Hack: We DO NOT add a voice to `this.voices` if arp is on?
      // But then `updateNote` won't find it.
      // We need to track which freqs this touch added.

      this.activeArpTouches.set(touchId, freqs);

      return;
    }

    const voices: Voice[] = [];

    freqs.forEach(f => {
      const voice = new Voice(this.currentVoiceType, this.effectBus);
      voice.triggerAttack(f, volume);
      voices.push(voice);
    });

    this.voices.set(touchId, voices);
  }

  public updateNote(touchId: number, frequency: number | number[], volume: number) {
    const freqs = Array.isArray(frequency) ? frequency : [frequency];

    if (this.arpeggiator.getEnabled()) {
      const oldFreqs = this.activeArpTouches.get(touchId);
      if (oldFreqs) {
        oldFreqs.forEach(f => this.arpeggiator.removeNote(f));
      }
      freqs.forEach(f => this.arpeggiator.addNote(f));
      this.activeArpTouches.set(touchId, freqs);
      return;
    }

    const voices = this.voices.get(touchId);
    if (voices) {
      const freqs = Array.isArray(frequency) ? frequency : [frequency];

      // Update existing voices
      voices.forEach((voice, i) => {
        if (i < freqs.length) {
          voice.setNote(freqs[i], volume);
        }
      });
      // (Advanced: Handle count mismatch if chord type changes mid-drag - rare case, ignoring for now)
    }
  }

  public stopNote(touchId: number) {
    if (this.arpeggiator.getEnabled()) {
      const oldFreqs = this.activeArpTouches.get(touchId);
      if (oldFreqs) {
        oldFreqs.forEach(f => this.arpeggiator.removeNote(f));
      }
      this.activeArpTouches.delete(touchId);
      // Also ensure no stray normal voices if we switched modes?
      // Fall through to check voices map just in case.
    }

    const voices = this.voices.get(touchId);
    if (voices) {
      voices.forEach(voice => {
        voice.triggerRelease();
        setTimeout(() => {
          voice.dispose();
        }, 200);
      });
      this.voices.delete(touchId);
    }
  }

  public releaseAll() {
    this.voices.forEach(voiceArray => {
      voiceArray.forEach(v => {
        v.triggerRelease();
        setTimeout(() => v.dispose(), 200);
      });
    });
    this.voices.clear();
  }

  public reset() {
    this.releaseAll();
    this.clearAllLoops();

    // Reset effects
    this.effects.forEach(e => e?.dispose());
    this.effects = [null, null, null, null, null, null];
    this.rebuildEffectChain();

    // Reset Tone / Filter
    this.toneFilter.frequency.value = 20000;

    // Restart Transport
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    Tone.Transport.start();
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