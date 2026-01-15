import { useEffect, useState, useMemo } from 'react';
import { AudioEngine, type VoiceType, type LoopTrack } from './audio/AudioEngine';
import { HexagonInstrument } from './components/HexagonInstrument';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { RotaryDial } from './components/RotaryDial';
import { EFFECT_TYPES, type EffectType } from './audio/effects';
import type { Point } from './utils/geometry';
import { Mic, Play, Square, Settings as SettingsIcon, Ghost, Activity, Trash2, ChevronDown, Power } from 'lucide-react';
import { clsx } from 'clsx';

const engine = AudioEngine.getInstance();

const INITIAL_EFFECTS: EffectType[] = [
    'JCReverb', 'FeedbackDelay', 'Distortion', 'Chorus', 'AutoFilter', 'Phaser'
];

// Minimal Glass Panel
const GlassPanel = ({
    children,
    className,
    title,
    icon: Icon,
    isOpen,
    onToggle
}: {
    children: React.ReactNode,
    className?: string,
    title: string,
    icon?: any,
    isOpen: boolean,
    onToggle: () => void
}) => (
    <div className={clsx(
        "glass-panel rounded-lg transition-all duration-200 pointer-events-auto",
        !isOpen && "bg-opacity-40 border-opacity-10",
        className
    )}>
        <div
            className={clsx("panel-header p-3 flex items-center justify-between group rounded-t-lg", !isOpen && "rounded-lg border-b-0")}
            onClick={onToggle}
        >
            <div className="flex items-center gap-2 text-gray-300 font-sans tracking-wide text-[10px] font-semibold group-hover:text-white transition-colors uppercase">
                {Icon && <Icon size={12} className="text-gray-400 group-hover:text-hex-accent" />}
                <span>{title}</span>
            </div>
            <div className={clsx(
                "text-gray-600 transition-transform duration-200",
                isOpen && "rotate-180"
            )}>
                <ChevronDown size={12} />
            </div>
        </div>
        <div className={clsx("collapsible-content px-3 border-t border-transparent", isOpen ? "expanded pb-3 border-hex-border" : "collapsed")}>
            {children}
        </div>
    </div>
);

function App() {
    const [started, setStarted] = useState(false);
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [effects, setEffects] = useState<(EffectType | null)[]>(INITIAL_EFFECTS);
    const [badgePos, setBadgePos] = useState<Point>({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    const [voiceType, setVoiceType] = useState<VoiceType>('sine');
    const [octave, setOctave] = useState(2);
    const [tone, setTone] = useState(0.8);
    const [rootNote, setRootNote] = useState('C');
    const [tracks, setTracks] = useState<LoopTrack[]>(engine.tracks);
    const [, setForceUpdate] = useState(0);
    const [ghostNotesEnabled, setGhostNotesEnabled] = useState(true);
    const [activeColor, setActiveColor] = useState('#00f0ff');

    // Panel States
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
    const [isLooperOpen, setIsLooperOpen] = useState(true);

    useEffect(() => {
        if (started) {
            INITIAL_EFFECTS.forEach((eff, i) => engine.setEffect(i, eff));
        }
    }, [started]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTracks([...engine.tracks]);
            setForceUpdate(n => n + 1);
        }, 50);
        return () => clearInterval(interval);
    }, []);

    const isMobile = dimensions.width < 600;
    const hexScale = isMobile ? 0.28 : 0.35;
    const hexRadius = Math.min(dimensions.width, dimensions.height) * hexScale;
    const center = { x: dimensions.width / 2, y: dimensions.height / 2 };

    const sideColors = ['#00f0ff', '#ff0055', '#ccff00', '#aa00ff', '#ffffff', '#ffaa00'];

    useEffect(() => {
        const handleResize = () => {
            setDimensions({ width: window.innerWidth, height: window.innerHeight });
            setBadgePos({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleStart = async () => {
        await engine.start();
        setStarted(true);
    };

    const handleEffectChange = (index: number, type: string) => {
        const newEffects = [...effects];
        newEffects[index] = type as EffectType;
        setEffects(newEffects);
        engine.setEffect(index, newEffects[index]);
    };

    const availableEffects = (currentIndex: number) => {
        const selectedOthers = effects.filter((_, i) => i !== currentIndex);
        return EFFECT_TYPES.filter(e => !selectedOthers.includes(e));
    };

    const menuPositions = useMemo(() => {
        const positions: { x: number, y: number, rotation: number }[] = [];
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i + 30;
            const angleRad = (angleDeg * Math.PI) / 180;
            const dist = hexRadius + (isMobile ? 35 : 55);
            positions.push({
                x: center.x + dist * Math.cos(angleRad),
                y: center.y + dist * Math.sin(angleRad),
                rotation: angleDeg
            });
        }
        return positions;
    }, [center, hexRadius, isMobile]);

    if (!started) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-hex-bg text-hex-text relative">
                <div className="absolute inset-0 tech-lines opacity-10"></div>
                <div className="z-10 flex flex-col items-center glass-panel p-12 rounded-xl animate-fade-in max-w-sm sm:max-w-md mx-4 border border-white/5">
                    <div className="flex flex-col items-center mb-8">
                        <div className="text-3xl font-light tracking-[0.2em] text-white fade-in">
                            HEXAGON
                        </div>
                        <div className="text-xs tracking-[0.4em] text-gray-500 uppercase mt-2">Synthesizer System</div>
                    </div>

                    <button
                        onClick={handleStart}
                        className="btn-minimal px-8 py-3 text-sm font-medium tracking-widest rounded-full group transition-all"
                    >
                        <span className="flex items-center gap-2">
                            <Power size={14} className="group-hover:text-hex-accent transition-colors" />
                            INITIALIZE
                        </span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="relative h-screen w-full bg-hex-bg overflow-hidden font-sans text-xs text-hex-text select-none">

            {/* Background */}
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute inset-0 tech-lines opacity-5"></div>
                <div className="absolute inset-0 bg-gradient-radial from-transparent via-hex-bg/90 to-hex-bg pointer-events-none"></div>
            </div>

            {/* Waveform Visualizer - Bottom Layer */}
            <div className="absolute bottom-0 left-0 right-0 h-48 opacity-20 pointer-events-none z-0">
                <WaveformVisualizer
                    analyzer={engine.waveform}
                    width={dimensions.width}
                    height={192}
                    color="#fff"
                />
            </div>

            {/* Main Instrument Layer */}
            <div className="absolute inset-0 z-10">
                <HexagonInstrument
                    engine={engine}
                    width={dimensions.width}
                    height={dimensions.height}
                    effectBadgePos={badgePos}
                    setEffectBadgePos={setBadgePos}
                    colors={sideColors}
                    ghostNotesEnabled={ghostNotesEnabled}
                    octaveRange={octave}
                    onNoteActive={setActiveColor}
                />
            </div>

            {/* Effect Menus - Overlay */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                {menuPositions.map((pos, i) => (
                    <div
                        key={i}
                        className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center fade-in"
                        style={{
                            left: pos.x,
                            top: pos.y,
                            width: isMobile ? '80px' : '100px',
                        }}
                    >
                        <select
                            className="w-full bg-black/60 border border-white/10 text-gray-300 text-[9px] uppercase outline-none backdrop-blur-sm appearance-none text-center cursor-pointer transition-all hover:bg-black/80 hover:text-white rounded py-1"
                            value={effects[i] || ''}
                            onChange={(e) => handleEffectChange(i, e.target.value)}
                            style={{
                                borderLeftColor: sideColors[i]
                            }}
                        >
                            {availableEffects(i).map(eff => (
                                <option key={eff} value={eff}>{eff}</option>
                            ))}
                        </select>
                    </div>
                ))}
            </div>

            {/* LEFT PANEL: Settings */}
            <div className="absolute top-4 left-4 z-40 w-48 sm:w-56 pointer-events-none">
                <GlassPanel
                    title="SYNTH ENGINE"
                    icon={SettingsIcon}
                    isOpen={isSettingsOpen}
                    onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
                >
                    <div className="flex flex-col gap-4 py-2 font-mono">
                        <div className="space-y-1">
                            <label className="text-[9px] uppercase text-gray-500 tracking-wider flex justify-between">
                                <span>Waveform</span>
                            </label>
                            <select
                                value={voiceType}
                                onChange={e => { setVoiceType(e.target.value as any); engine.setVoiceType(e.target.value as any); }}
                                className="select-minimal w-full px-2 py-1.5 text-[10px] rounded-sm"
                            >
                                <option value="sine">Sine Wave</option>
                                <option value="triangle">Triangle</option>
                                <option value="sawtooth">Sawtooth</option>
                                <option value="square">Square</option>
                                <option value="pulse">Pulse Width</option>
                                <option value="fmsynth">FM Synthesis</option>
                                <option value="amsynth">AM Synthesis</option>
                                <option value="membrane">Membrane (Perc)</option>
                                <option value="metal">Metal (Perc)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center text-[9px] uppercase text-gray-500">
                                <span>Octave Range</span>
                                <span className="text-white font-bold">{octave}</span>
                            </div>
                            <input
                                type="range" min="1" max="5" step="1"
                                value={octave}
                                onChange={e => {
                                    const v = parseInt(e.target.value);
                                    setOctave(v);
                                    engine.octaveRange = v;
                                }}
                                className="slider-minimal w-full"
                            />
                        </div>

                        <div className="flex justify-center items-center gap-4 pt-2">
                            <RotaryDial
                                label="TONE"
                                value={Math.round(tone * 100).toString()}
                                options={[]} // Continuous dial simulation
                                onChange={() => { /* handled by onValueChange */ }}
                                continuous={true}
                                min={0}
                                max={1}
                                val={tone}
                                onValueChange={(v) => {
                                    setTone(v);
                                    engine.setTone(v);
                                }}
                                size={50}
                            />
                            <RotaryDial
                                label="ROOT NOTE"
                                value={rootNote}
                                options={['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']}
                                onChange={(n) => {
                                    setRootNote(n);
                                    const idx = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(n);
                                    const freq = 261.63 * Math.pow(2, idx / 12);
                                    engine.rootFreq = freq;
                                }}
                                size={50}
                            />
                        </div>
                    </div>
                </GlassPanel>
            </div>

            {/* RIGHT TOP PANEL: Telemetry - HIDDEN */}
            {false && <div className="absolute top-4 right-4 z-40 w-44 sm:w-48 pointer-events-none flex flex-col items-end">
                <GlassPanel
                    title="TELEMETRY"
                    icon={Activity}
                    isOpen={isTelemetryOpen}
                    onToggle={() => setIsTelemetryOpen(!isTelemetryOpen)}
                    className="w-full"
                >
                    <div className="space-y-1 py-1 font-mono text-[9px] text-gray-400">
                        <div className="flex justify-between items-center">
                            <span>PITCH</span>
                            <span className="text-white">{(badgePos.x / dimensions.width).toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span>VOL</span>
                            <span className="text-white">{(1 - badgePos.y / dimensions.height).toFixed(2)}</span>
                        </div>

                        <div className="h-px bg-white/5 my-2"></div>

                        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                            {effects.map((e, i) => e && (
                                <div key={i} className="flex justify-between items-center">
                                    <span style={{ color: sideColors[i], opacity: 0.8 }}>{e.substring(0, 3)}</span>
                                    <span className="text-gray-300">{((engine as any).effects[i]?.wet?.value || 0).toFixed(1)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </GlassPanel>
            </div>}

            {/* RIGHT BOTTOM PANEL: Looper - HIDDEN */}
            {false && <div className="absolute bottom-4 right-4 z-40 w-72 sm:w-80 pointer-events-none flex flex-col items-end">
                <GlassPanel
                    title="LOOPER"
                    icon={Mic}
                    isOpen={isLooperOpen}
                    onToggle={() => setIsLooperOpen(!isLooperOpen)}
                    className="w-full"
                >
                    <div className="py-1">
                        <div className="flex justify-between items-center mb-2 px-1">
                            <button
                                onClick={() => setGhostNotesEnabled(!ghostNotesEnabled)}
                                className={clsx(
                                    "flex items-center gap-1.5 text-[9px] px-2 py-1 rounded transition-colors uppercase tracking-wider",
                                    ghostNotesEnabled
                                        ? "text-hex-accent"
                                        : "text-gray-600 hover:text-gray-400"
                                )}
                            >
                                <Ghost size={10} /> {ghostNotesEnabled ? 'VISUALS ON' : 'VISUALS OFF'}
                            </button>
                            <button
                                onClick={() => engine.clearAllLoops()}
                                className="flex items-center gap-1.5 text-[9px] text-gray-500 hover:text-red-400 px-2 py-1 rounded transition-colors uppercase"
                            >
                                <Trash2 size={10} /> CLEAR
                            </button>
                        </div>

                        <div className="flex flex-col gap-1.5">
                            {[0, 1, 2, 3].map(trackId => {
                                const track = tracks[trackId];
                                return (
                                    <div key={trackId} className="group relative bg-black/20 p-1 rounded border border-white/5 hover:border-white/10 transition-colors">
                                        {track.isPlaying && track.audioBuffer && (
                                            <div className="absolute inset-0 bg-white/5 z-0 pointer-events-none"></div>
                                        )}

                                        <div className="relative z-10 flex items-center gap-2">
                                            <div className="flex flex-col items-center justify-center w-5 shrink-0 border-r border-white/5 mr-1 pt-0.5">
                                                <span className="text-[9px] font-bold text-gray-600 font-mono">{trackId + 1}</span>
                                            </div>

                                            <button
                                                onClick={() => {
                                                    if (track.isRecording) engine.stopRecording(trackId);
                                                    else engine.startRecording(trackId);
                                                }}
                                                className={clsx(
                                                    "w-6 h-6 flex items-center justify-center rounded-sm transition-all shrink-0",
                                                    track.isRecording
                                                        ? "bg-red-500/20 text-red-500"
                                                        : "bg-white/5 hover:bg-white/10 text-gray-500"
                                                )}
                                            >
                                                <div className={clsx("rounded-full", track.isRecording ? "w-2 h-2 bg-current" : "w-2 h-2 bg-current")} />
                                            </button>

                                            <button
                                                onClick={() => engine.toggleTrackPlayback(trackId)}
                                                disabled={!track.audioBuffer && !track.isRecording}
                                                className={clsx(
                                                    "w-6 h-6 flex items-center justify-center rounded-sm transition-all shrink-0",
                                                    track.isPlaying
                                                        ? "bg-hex-accent/10 text-hex-accent"
                                                        : "bg-white/5 hover:bg-white/10 text-gray-500",
                                                    (!track.audioBuffer && !track.isRecording) && "opacity-20 cursor-not-allowed"
                                                )}
                                            >
                                                {track.isPlaying ? <Square size={8} fill="currentColor" /> : <Play size={8} fill="currentColor" />}
                                            </button>

                                            <div className="flex-1 px-1 flex flex-col justify-center gap-1 group/vol">
                                                <input
                                                    type="range" min="0" max="1" step="0.05" defaultValue="0.8"
                                                    onChange={(e) => engine.setTrackVolume(trackId, parseFloat(e.target.value))}
                                                    className="slider-minimal w-full"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </GlassPanel>
            </div>}

        </div>
    );
}

export default App;
