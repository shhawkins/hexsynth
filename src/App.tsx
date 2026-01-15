
import { HexagonInstrument } from './components/HexagonInstrument';
import { WaveformVisualizer } from './components/WaveformVisualizer';
import { OnboardingModal } from './components/OnboardingModal';
import { HarmonyVisualizer } from './components/HarmonyVisualizer';
import { RoseVisualizer } from './components/RoseVisualizer';
import { RotaryDial } from './components/RotaryDial';
import { useRef, useEffect, useState, useMemo } from 'react';
import type { ArpPattern, ArpRate } from './audio/Arpeggiator';
import { AudioEngine, type VoiceType, type LoopTrack } from './audio/AudioEngine';
import { EFFECT_TYPES, type EffectType } from './audio/effects';
import { SCALES, type ScaleType, type ChordType } from './utils/music';
import type { Point } from './utils/geometry';
import { isIPad } from './utils/device';

interface ModulationState {
    x: boolean;
    y: boolean;
    xInv: boolean;
    yInv: boolean;
    p: boolean; // Pressure
}
import { Mic, Play, Square, Settings as SettingsIcon, Ghost, Activity, Trash2, ChevronDown, Settings, RefreshCcw } from 'lucide-react';
import { EffectsControlPanel } from './components/EffectsControlPanel';
import { RegionSelector, type RegionType } from './components/RegionSelector';
import { clsx } from 'clsx';

const engine = AudioEngine.getInstance();

const INITIAL_EFFECTS: EffectType[] = [
    'JCReverb', 'FeedbackDelay', 'Vibrato', 'Chorus', 'AutoFilter', 'Phaser'
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

const getCenter = (w: number, h: number) => {
    const isMobile = w < 600;
    const isLandscape = w > h && w >= 600;
    const isPortraitTablet = !isMobile && !isLandscape;

    return {
        x: isLandscape ? w / 2 + 100 : w / 2,
        y: isMobile
            ? h / 2 + 150
            : isPortraitTablet
                ? h / 2 + 180
                : h / 2
    };
};

function App() {
    const [started, setStarted] = useState(false);
    const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });
    const [effects, setEffects] = useState<(EffectType | null)[]>(INITIAL_EFFECTS);
    // Initialize badge at correct center
    const [badgePos, setBadgePos] = useState<Point>(() => getCenter(window.innerWidth, window.innerHeight));
    const [voiceType, setVoiceType] = useState<VoiceType>('sine');
    const [octave, setOctave] = useState(2);
    const [tone, setTone] = useState(0.8);
    const [masterVolume, setMasterVolume] = useState(0.8);
    const [volMod, setVolMod] = useState<ModulationState>({ x: true, y: false, xInv: false, yInv: false, p: false });
    const [toneMod, setToneMod] = useState<ModulationState>({ x: false, y: false, xInv: false, yInv: false, p: false });
    const [rootNote, setRootNote] = useState('C');
    const [scaleType, setScaleType] = useState<ScaleType>('chromatic');
    const [chordType, setChordType] = useState<ChordType>('off');
    const [arpEnabled, setArpEnabled] = useState(false);
    const [arpRate, setArpRate] = useState<ArpRate>('8n');
    const [arpPattern, setArpPattern] = useState<ArpPattern>('up');
    const [scaleRegion, setScaleRegion] = useState<RegionType>('whole');
    const [chordRegion, setChordRegion] = useState<RegionType>('whole');
    const [arpRegion, setArpRegion] = useState<RegionType>('whole');
    const [tracks, setTracks] = useState<LoopTrack[]>(engine.tracks);
    const [, setForceUpdate] = useState(0);
    const [ghostNotesEnabled, setGhostNotesEnabled] = useState(true);

    // Panel States
    const [isSettingsOpen, setIsSettingsOpen] = useState(true);
    const [isTelemetryOpen, setIsTelemetryOpen] = useState(false);
    const [isLooperOpen, setIsLooperOpen] = useState(true);
    const [isEffectsPanelOpen, setIsEffectsPanel] = useState(false);
    const [activeEffectIndex, setActiveEffectIndex] = useState<number | null>(null);
    const [expandedControlId, setExpandedControlId] = useState<number | null>(null);
    const [paramModulations, setParamModulations] = useState<Record<string, ModulationState>>({});
    const [isCompToolsOpen, setIsCompToolsOpen] = useState(false);
    const [visualizerMode, setVisualizerMode] = useState<'none' | 'geo' | 'rose'>('none');

    // Real-time Visual Modulation State (Ref to avoid re-renders, read in render loop)
    const visualModRef = useRef({ vol: 1.0, tone: 1.0 });

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
    const isLandscape = dimensions.width > dimensions.height && dimensions.width >= 600;
    // const isPortraitTablet = !isMobile && !isLandscape; // Redundant or re-calculated in getCenter, but used for hexScale

    // Hexagon sizing: maximize while leaving room for UI
    const hexScale = isMobile ? 0.28 : isLandscape ? 0.33 : 0.32;
    const hexRadius = Math.min(dimensions.width, dimensions.height) * hexScale;

    const visualizerCenter = useMemo(() => {
        if (isMobile) {
            // Mobile: top-24, 220px height -> Center Y = 96 + 110 = 206
            return { x: dimensions.width / 2, y: 206 };
        }
        if (isLandscape) {
            // Landscape: top-[400px] left-4, 240px size -> Y=520, X=136
            return { x: 136, y: 520 };
        }
        // iPad Portrait: top-10 right-8, 200px size -> Y=140, X = width - 32 - 100
        return { x: dimensions.width - 132, y: 140 };
    }, [dimensions, isMobile, isLandscape]);

    const activeEffectTypes = useMemo(() => effects.filter((e): e is EffectType => !!e), [effects]);

    // Position hexagon based on layout
    const center = getCenter(dimensions.width, dimensions.height);

    const sideColors = ['#00f0ff', '#ff0055', '#ccff00', '#aa00ff', '#ffffff', '#ffaa00'];

    useEffect(() => {
        const handleResize = () => {
            const w = window.innerWidth;
            const h = window.innerHeight;
            setDimensions({ width: w, height: h });
            setBadgePos(getCenter(w, h));
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const handleStart = async () => {
        await engine.start();
        setStarted(true);
    };

    // Track which effect slots are animating (for swap animation)
    const [swappingSlots, setSwappingSlots] = useState<Set<number>>(new Set());

    const handleEffectChange = (index: number, type: string) => {
        const newType = type as EffectType;
        const existingIndex = effects.findIndex((e, i) => e === newType && i !== index);

        if (existingIndex !== -1) {
            // Swap: The selected effect is already on another slot
            handleEffectSwap(index, existingIndex);
        } else {
            // Normal: Just set the effect
            const newEffects = [...effects];
            newEffects[index] = newType;
            setEffects(newEffects);
            engine.setEffect(index, newEffects[index]);
        }
    };

    const handleEffectSwap = (indexA: number, indexB: number) => {
        const newEffects = [...effects];
        const effectA = newEffects[indexA];
        const effectB = newEffects[indexB];

        newEffects[indexA] = effectB;
        newEffects[indexB] = effectA;

        // Trigger swap animation
        setSwappingSlots(new Set([indexA, indexB]));
        setTimeout(() => setSwappingSlots(new Set()), 400);

        setEffects(newEffects);
        // Update audio engine
        engine.setEffect(indexA, effectB);
        engine.setEffect(indexB, effectA);
    };

    // Show all effects in dropdown (swap handles duplicates)
    const availableEffects = () => EFFECT_TYPES;

    const menuPositions = useMemo(() => {
        const positions: { x: number, y: number, rotation: number }[] = [];
        for (let i = 0; i < 6; i++) {
            const angleDeg = 60 * i + 30;
            const angleRad = (angleDeg * Math.PI) / 180;
            // Increased distance to prevent badge overlap with hexagon border
            const dist = hexRadius + (isMobile ? 45 : 70);
            positions.push({
                x: center.x + dist * Math.cos(angleRad),
                y: center.y + dist * Math.sin(angleRad),
                rotation: angleDeg
            });
        }
        return positions;
    }, [center, hexRadius, isMobile]);

    const handleModToggle = (target: 'vol' | 'tone' | string, axis: 'x' | 'y' | 'p', contextMenu = false) => {
        if (contextMenu) {
            // Context menu logic (inversion) - only for X/Y
            if (axis === 'p') return; // No inversion for pressure yet

            if (target === 'vol') {
                setVolMod(prev => ({ ...prev, [axis + 'Inv']: !prev[axis + 'Inv' as keyof ModulationState] }));
            } else if (target === 'tone') {
                setToneMod(prev => ({ ...prev, [axis + 'Inv']: !prev[axis + 'Inv' as keyof ModulationState] }));
            } else {
                setParamModulations(prev => {
                    const current = prev[target] || { x: false, y: false, xInv: false, yInv: false, p: false };
                    return {
                        ...prev,
                        [target]: { ...current, [axis + 'Inv']: !current[axis + 'Inv' as keyof ModulationState] }
                    };
                });
            }
        } else {
            // Normal toggle
            if (target === 'vol') {
                setVolMod(prev => ({ ...prev, [axis]: !prev[axis] }));
            } else if (target === 'tone') {
                setToneMod(prev => ({ ...prev, [axis]: !prev[axis] }));
            } else {
                setParamModulations(prev => {
                    const current = prev[target] || { x: false, y: false, xInv: false, yInv: false, p: false };
                    return {
                        ...prev,
                        [target]: { ...current, [axis]: !current[axis] }
                    };
                });
            }
        }
    };

    if (!started) {
        return <OnboardingModal onStart={handleStart} />;
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

            {/* Harmony Visualizer (Ghost) - Always Active */}
            <div className="fixed inset-0 pointer-events-none z-0">
                <HarmonyVisualizer
                    engine={engine}
                    width={dimensions.width}
                    height={dimensions.height}
                    centerX={visualizerCenter.x}
                    centerY={visualizerCenter.y}
                    activeEffectTypes={activeEffectTypes}
                />
            </div>



            {/* Rose Visualizer (Toggleable) */}
            <div className={clsx(
                "fixed inset-0 pointer-events-none transition-opacity duration-1000 z-0",
                visualizerMode === 'rose' ? "opacity-100" : "opacity-0"
            )}>
                <RoseVisualizer
                    engine={engine}
                    width={dimensions.width}
                    height={dimensions.height}
                    centerX={visualizerCenter.x}
                    centerY={visualizerCenter.y}
                    activeEffectTypes={activeEffectTypes}
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
                    paramModulations={paramModulations}
                    masterVolume={masterVolume}
                    volMod={volMod}
                    toneMod={toneMod}
                    toneBase={tone}
                    scaleType={scaleType}
                    chordType={chordType}
                    scaleRegion={scaleRegion}
                    chordRegion={chordRegion}
                    arpRegion={arpRegion}
                    arpEnabled={arpEnabled}
                    onNoteActive={() => { }}
                    onEffectSwap={handleEffectSwap}
                    onModulationUpdate={(factors) => {
                        visualModRef.current = factors;
                    }}
                    center={center}
                />
            </div>

            <EffectsControlPanel
                engine={engine}
                isOpen={isEffectsPanelOpen}
                onClose={() => setIsEffectsPanel(false)}
                activeEffectIndex={activeEffectIndex}
                onEffectChange={handleEffectChange}
                paramModulations={paramModulations}
                onModulationChange={(key, axis) => {
                    setParamModulations(prev => {
                        const current = prev[key] || { x: false, y: false, xInv: false, yInv: false, p: false };
                        return {
                            ...prev,
                            [key]: { ...current, [axis]: !current[axis] }
                        };
                    });
                }}
            />

            {/* Effect Menus - Overlay */}
            <div className="absolute inset-0 z-20 pointer-events-none">
                {menuPositions.map((pos, i) => (
                    <div
                        key={i}
                        className={clsx(
                            "absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center fade-in transition-all duration-300",
                            swappingSlots.has(i) && "animate-swap-pulse"
                        )}
                        style={{
                            left: pos.x,
                            top: pos.y,
                            width: isMobile ? '80px' : '100px',
                        }}
                    >
                        <select
                            className="w-full bg-black/60 border border-white/10 text-gray-300 text-[9px] uppercase outline-none backdrop-blur-sm appearance-none text-center cursor-pointer transition-all hover:bg-black/80 hover:text-white rounded py-1 pl-2"
                            value={effects[i] || ''}
                            onChange={(e) => handleEffectChange(i, e.target.value)}
                            style={{
                                borderLeftColor: sideColors[i]
                            }}
                        >
                            {availableEffects().map(eff => (
                                <option key={eff} value={eff}>
                                    {eff.replace('JCReverb', 'Reverb').replace('FeedbackDelay', 'Delay').replace('PingPongDelay', 'PingPong')}
                                </option>
                            ))}
                        </select>

                        {/* Modulation Controls */}
                        {effects[i] && (
                            <div className="flex flex-col items-center mt-1">
                                {isMobile && (
                                    <button
                                        onClick={() => setExpandedControlId(expandedControlId === i ? null : i)}
                                        className="text-gray-500 hover:text-white/80 transition-colors p-2 -m-1 active:scale-90 flex items-center justify-center w-8 h-6 relative"
                                    >
                                        <ChevronDown
                                            size={10}
                                            className={clsx("transition-transform duration-200", expandedControlId === i && "rotate-180")}
                                        />
                                        {/* Mobile Mod Active Indicator */}
                                        {expandedControlId !== i && Object.entries(paramModulations).some(([k, v]) => k.startsWith(`${i}:`) && (v.x || v.y || v.p)) && (
                                            <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-hex-accent shadow-[0_0_4px_#ccff00]"></div>
                                        )}
                                    </button>
                                )}
                                <div className={clsx(
                                    "flex gap-1 justify-center overflow-hidden transition-all duration-200 ease-out",
                                    isMobile
                                        ? (expandedControlId === i ? "max-h-8 opacity-100 mt-1" : "max-h-0 opacity-0")
                                        : "max-h-8 opacity-100 mt-1"
                                )}>
                                    <button
                                        className={clsx(
                                            "rounded border transition-colors font-mono",
                                            isMobile ? "text-[8px] px-1.5 py-0.5" : "text-[12px] px-2 py-1",
                                            paramModulations[`${i}:wet`]?.x ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30"
                                        )}
                                        onClick={() => handleModToggle(`${i}:wet`, 'x')}
                                        title="Modulate with Volume (X Axis) - Double tap to invert"
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            handleModToggle(`${i}:wet`, 'x', true);
                                        }}
                                    >
                                        {paramModulations[`${i}:wet`]?.xInv ? "X↓" : "X"}
                                    </button>
                                    <button
                                        className={clsx(
                                            "rounded border transition-colors font-mono",
                                            isMobile ? "text-[8px] px-1.5 py-0.5" : "text-[12px] px-2 py-1",
                                            paramModulations[`${i}:wet`]?.y ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30"
                                        )}
                                        onClick={() => handleModToggle(`${i}:wet`, 'y')}
                                        title="Modulate with Pitch (Y Axis) - Double tap to invert"
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            handleModToggle(`${i}:wet`, 'y', true);
                                        }}
                                    >
                                        {paramModulations[`${i}:wet`]?.yInv ? "Y↓" : "Y"}
                                    </button>
                                    {isIPad() && (
                                        <button
                                            onClick={() => handleModToggle(`${i}:wet`, 'p')}
                                            className={clsx(
                                                "rounded border transition-colors font-mono",
                                                isMobile ? "text-[8px] px-1.5 py-0.5" : "text-[12px] px-2 py-1",
                                                paramModulations[`${i}:wet`]?.p ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30"
                                            )}
                                            title="Modulate with Pencil Pressure"
                                        >
                                            ✎
                                        </button>
                                    )}
                                    <button
                                        className={clsx(
                                            "rounded border border-white/10 bg-black/40 text-gray-500 hover:text-white transition-colors",
                                            isMobile ? "text-[8px] px-1.5 py-0.5" : "text-[12px] px-2 py-1"
                                        )}
                                        onClick={() => {
                                            setActiveEffectIndex(i);
                                            setIsEffectsPanel(true);
                                        }}
                                        title="Effect Settings"
                                    >
                                        <Settings size={isMobile ? 8 : 12} />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* SETTINGS PANEL: Responsive Placement */}
            <div className={clsx(
                "absolute z-40 pointer-events-none transition-all duration-300",
                isLandscape
                    ? "top-4 left-4 w-64"
                    : isMobile
                        ? "top-6 left-2 right-2 flex justify-center" // Mobile: Centered
                        : "top-6 left-4 w-[500px]" // iPad Portrait: Shift LEFT to make room for visualizer on right
            )}>
                <div className={clsx("pointer-events-auto", !isLandscape && "w-full max-w-[500px]")}>
                    <GlassPanel
                        title="HEX-SYNTH"
                        icon={SettingsIcon}
                        isOpen={isSettingsOpen}
                        onToggle={() => setIsSettingsOpen(!isSettingsOpen)}
                    >
                        <div className="py-1.5 font-mono transition-all">
                            <div className="flex flex-col gap-2">

                                {/* Row 1: Waveform & Octave (+ Reset Button) */}
                                <div className="flex gap-3 items-end">
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between items-center">
                                            <label className="text-[9px] uppercase text-gray-500 tracking-wider">
                                                Waveform
                                            </label>
                                            <div className="flex items-center gap-2">
                                                {/* Visualizer Toggle */}
                                                <button
                                                    onClick={() => setVisualizerMode(prev => prev === 'rose' ? 'none' : 'rose')}
                                                    className={clsx(
                                                        "w-5 h-5 rounded flex items-center justify-center transition-all",
                                                        visualizerMode === 'rose'
                                                            ? "text-hex-accent bg-hex-accent/10"
                                                            : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                                    )}
                                                    title="Toggle Visualizer"
                                                >
                                                    <Activity size={12} />
                                                </button>

                                                {/* Reset Button moved here */}
                                                <button
                                                    onClick={() => {
                                                        engine.reset();

                                                        // Reset State
                                                        setEffects([...INITIAL_EFFECTS]);
                                                        setParamModulations({});
                                                        setVolMod({ x: true, y: false, xInv: false, yInv: false, p: false });
                                                        setToneMod({ x: false, y: false, xInv: false, yInv: false, p: false });
                                                        setVoiceType('sine');
                                                        setOctave(2);
                                                        setTone(0.8);
                                                        setMasterVolume(0.8);
                                                        setRootNote('C');
                                                        setBadgePos(center); // Reset badge position

                                                        engine.rootFreq = 261.63;
                                                        engine.octaveRange = 2;
                                                        engine.setVoiceType('sine');
                                                        setScaleType('chromatic');
                                                        setChordType('off');

                                                        setArpEnabled(false);
                                                        setArpRate('8n');
                                                        setArpPattern('up');
                                                        engine.setArpEnabled(false);
                                                        engine.setArpRate('8n');
                                                        engine.setArpPattern('up');

                                                        INITIAL_EFFECTS.forEach((eff, i) => engine.setEffect(i, eff));
                                                    }}
                                                    className="text-red-500 hover:text-red-300 transition-colors p-1"
                                                    title="Reset System"
                                                >
                                                    <RefreshCcw size={12} />
                                                </button>
                                            </div>
                                        </div>
                                        <select
                                            value={voiceType}
                                            onChange={e => { setVoiceType(e.target.value as any); engine.setVoiceType(e.target.value as any); }}
                                            className="select-minimal w-full px-2 py-1 text-[10px] rounded-sm"
                                        >
                                            <option value="sine">Sine Wave</option>
                                            <option value="triangle">Triangle</option>
                                            <option value="sawtooth">Sawtooth</option>
                                            <option value="square">Square</option>
                                            <option value="pulse">Pulse Width</option>
                                            <option value="fmsynth">FM Synth</option>
                                            <option value="amsynth">AM Synth</option>
                                            <option value="membrane">Membrane</option>
                                            <option value="metal">Metal</option>
                                            <option value="pluck">Pluck Synth</option>
                                            <option value="duo">Duo Synth</option>
                                            <option value="noise">Noise Synth</option>
                                        </select>
                                    </div>

                                    <div className="flex-[0.8] space-y-1">
                                        <div className="flex justify-between items-center text-[9px] uppercase text-gray-500">
                                            <span>Octave</span>
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
                                </div>

                                {/* Row 2: Controls */}
                                <div className="flex gap-2 justify-between items-end border-t border-white/5 pt-2">
                                    {/* Volume Control */}
                                    <div className="flex flex-col items-center gap-1">
                                        <RotaryDial
                                            label="VOL"
                                            value={Math.round(masterVolume * visualModRef.current.vol * 100).toString()}
                                            options={[]}
                                            onChange={() => { }}
                                            continuous={true}
                                            min={0}
                                            max={1}
                                            val={masterVolume}
                                            visualOverride={masterVolume * visualModRef.current.vol}
                                            onValueChange={setMasterVolume}
                                            size={32}
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                className={clsx("text-[8px] w-4 h-4 rounded border transition-colors font-mono flex items-center justify-center",
                                                    volMod.x ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30")}
                                                onClick={() => handleModToggle('vol', 'x')}
                                                onContextMenu={(e) => { e.preventDefault(); handleModToggle('vol', 'x', true); }}
                                                title="Modulate with X (Right click to invert)"
                                            >{volMod.xInv ? "X↓" : "X"}</button>
                                            <button
                                                className={clsx("text-[8px] w-4 h-4 rounded border transition-colors font-mono flex items-center justify-center",
                                                    volMod.y ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30")}
                                                onClick={() => handleModToggle('vol', 'y')}
                                                onContextMenu={(e) => { e.preventDefault(); handleModToggle('vol', 'y', true); }}
                                                title="Modulate with Y (Right click to invert)"
                                            >{volMod.yInv ? "Y↓" : "Y"}</button>
                                            {isIPad() && (
                                                <button
                                                    onClick={() => handleModToggle('vol', 'p')}
                                                    className={clsx("text-[8px] w-4 h-4 rounded border transition-colors font-mono flex items-center justify-center",
                                                        volMod.p ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30")}
                                                    title="Modulate with Pencil Pressure"
                                                >
                                                    ✎
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Tone Control */}
                                    <div className="flex flex-col items-center gap-1">
                                        <RotaryDial
                                            label="TONE"
                                            value={Math.round(tone * visualModRef.current.tone * 100).toString()}
                                            options={[]} // Continuous dial simulation
                                            onChange={() => { /* handled by onValueChange */ }}
                                            continuous={true}
                                            min={0}
                                            max={1}
                                            val={tone}
                                            visualOverride={tone * visualModRef.current.tone}
                                            onValueChange={(v) => {
                                                setTone(v);
                                            }}
                                            size={32}
                                        />
                                        <div className="flex gap-1">
                                            <button
                                                className={clsx("text-[8px] w-4 h-4 rounded border transition-colors font-mono flex items-center justify-center",
                                                    toneMod.x ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30")}
                                                onClick={() => handleModToggle('tone', 'x')}
                                                onContextMenu={(e) => { e.preventDefault(); handleModToggle('tone', 'x', true); }}
                                                title="Modulate with X (Right click to invert)"
                                            >{toneMod.xInv ? "X↓" : "X"}</button>
                                            <button
                                                className={clsx("text-[8px] w-4 h-4 rounded border transition-colors font-mono flex items-center justify-center",
                                                    toneMod.y ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30")}
                                                onClick={() => handleModToggle('tone', 'y')}
                                                onContextMenu={(e) => { e.preventDefault(); handleModToggle('tone', 'y', true); }}
                                                title="Modulate with Y (Right click to invert)"
                                            >{toneMod.yInv ? "Y↓" : "Y"}</button>
                                            {isIPad() && (
                                                <button
                                                    onClick={() => handleModToggle('tone', 'p')}
                                                    className={clsx("text-[8px] w-4 h-4 rounded border transition-colors font-mono flex items-center justify-center",
                                                        toneMod.p ? "bg-hex-accent text-black border-hex-accent" : "bg-black/40 text-gray-500 border-white/10 hover:border-white/30")}
                                                    title="Modulate with Pencil Pressure"
                                                >
                                                    ✎
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Root: Horizontal Dial (Slider) - Standardized */}
                                    {/* Root: Horizontal Dial (Slider) - Standardized */}
                                    <div className="flex-1 flex flex-col justify-end pl-3 ml-1 border-l border-white/5 h-full min-w-[100px]">
                                        <div className="flex justify-between text-[8px] uppercase text-gray-500 mb-1.5">
                                            <span>Root</span>
                                            <span className="text-hex-accent font-bold font-mono">{rootNote}</span>
                                        </div>
                                        <div className="relative flex items-center">
                                            <div className="absolute inset-x-0 h-1 bg-white/10 rounded-full overflow-hidden">
                                                <div className="h-full bg-hex-accent/20"></div>
                                            </div>
                                            <input
                                                type="range" min="0" max="11" step="1"
                                                value={['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'].indexOf(rootNote)}
                                                onChange={(e) => {
                                                    const notes = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
                                                    const idx = parseInt(e.target.value);
                                                    const n = notes[idx];
                                                    setRootNote(n);
                                                    const freq = 261.63 * Math.pow(2, idx / 12);
                                                    engine.rootFreq = freq;
                                                }}
                                                className="slider-minimal w-full relative z-10"
                                                style={{ height: '20px' }}
                                            />
                                        </div>
                                        {/* Tick marks */}
                                        <div className="flex justify-between px-1 mt-0.5 opacity-30">
                                            {Array(12).fill(0).map((_, i) => (
                                                <div key={i} className={clsx("w-px bg-white", i % 2 === 0 ? "h-1.5" : "h-0.5")}></div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Advanced / Composition Tools Toggle */}
                                <div className="mt-2 border-t border-white/5 pt-1">
                                    <button
                                        onClick={() => setIsCompToolsOpen(!isCompToolsOpen)}
                                        className="w-full flex items-center justify-between text-[9px] uppercase text-gray-500 hover:text-gray-300 transition-colors py-1 group"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="tracking-wider">Composition Tools</span>
                                            {/* Collapsed Active Indicator */}
                                            {!isCompToolsOpen && (scaleType !== 'chromatic' || chordType !== 'off' || arpEnabled) && (
                                                <div className="w-1.5 h-1.5 rounded-full bg-hex-accent shadow-[0_0_4px_#ccff00] animate-pulse"></div>
                                            )}
                                        </div>
                                        <ChevronDown size={10} className={clsx("transition-transform duration-200", isCompToolsOpen && "rotate-180")} />
                                    </button>

                                    <div className={clsx("overflow-hidden transition-all duration-300 ease-in-out", isCompToolsOpen ? "max-h-60 opacity-100" : "max-h-0 opacity-0")}>
                                        <div className="pt-5 pb-1 space-y-3">
                                            {/* Scale & Chord Row */}
                                            {/* Scale & Chord Row */}
                                            <div className="flex gap-4">
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[8px] uppercase text-gray-500 block">Scale</label>
                                                        <RegionSelector value={scaleRegion} onChange={setScaleRegion} size={14} />
                                                    </div>
                                                    <select
                                                        value={scaleType}
                                                        onChange={(e) => setScaleType(e.target.value as ScaleType)}
                                                        className="select-minimal w-full px-2 py-1 text-[9px] rounded-sm"
                                                    >
                                                        {Object.entries(SCALES).map(([key, data]) => (
                                                            <option key={key} value={key}>{data.name}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="flex-1 space-y-1">
                                                    <div className="flex justify-between items-center">
                                                        <label className="text-[8px] uppercase text-gray-500 block">Chord</label>
                                                        <RegionSelector value={chordRegion} onChange={setChordRegion} size={14} />
                                                    </div>
                                                    <select
                                                        value={chordType}
                                                        onChange={(e) => setChordType(e.target.value as ChordType)}
                                                        className="select-minimal w-full px-2 py-1 text-[9px] rounded-sm"
                                                    >
                                                        <option value="off">Off</option>
                                                        <option value="triad">Triad (1-3-5)</option>
                                                        <option value="sus2">Sus2</option>
                                                        <option value="sus4">Sus4</option>
                                                        <option value="maj7">Maj 7th</option>
                                                        <option value="m7">Min 7th</option>
                                                        <option value="dom7">Dom 7th</option>
                                                        <option value="maj9">Maj 9th</option>
                                                        <option value="m9">Min 9th</option>
                                                        <option value="dim">Dimc (Triad)</option>
                                                        <option value="aug">Aug (Triad)</option>
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Arpeggiator Section */}
                                            <div className="border-t border-white/5 pt-2">
                                                <div className="flex items-center justify-between mb-2">
                                                    <div className="flex items-center gap-2">
                                                        <label className="text-[8px] uppercase text-gray-500 tracking-wider">Arpeggiator</label>
                                                        <RegionSelector value={arpRegion} onChange={setArpRegion} size={14} />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const newVal = !arpEnabled;
                                                            setArpEnabled(newVal);
                                                            engine.setArpEnabled(newVal);
                                                        }}
                                                        className={clsx(
                                                            "w-8 h-4 rounded-full relative transition-colors duration-200",
                                                            arpEnabled ? "bg-hex-accent" : "bg-white/10"
                                                        )}
                                                    >
                                                        <div className={clsx(
                                                            "absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform duration-200 shadow-sm",
                                                            arpEnabled ? "left-4.5" : "left-0.5"
                                                        )} />
                                                    </button>
                                                </div>

                                                <div className={clsx("grid grid-cols-2 gap-3 transition-opacity duration-200", arpEnabled ? "opacity-100" : "opacity-30 pointer-events-none")}>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] uppercase text-gray-500 block">Rate</label>
                                                        <select
                                                            value={arpRate}
                                                            onChange={(e) => {
                                                                const val = e.target.value as ArpRate;
                                                                setArpRate(val);
                                                                engine.setArpRate(val);
                                                            }}
                                                            className="select-minimal w-full px-2 py-1 text-[9px] rounded-sm"
                                                        >
                                                            <option value="4n">1/4</option>
                                                            <option value="8n">1/8</option>
                                                            <option value="16n">1/16</option>
                                                            <option value="32n">1/32</option>
                                                        </select>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-[8px] uppercase text-gray-500 block">Pattern</label>
                                                        <select
                                                            value={arpPattern}
                                                            onChange={(e) => {
                                                                const val = e.target.value as ArpPattern;
                                                                setArpPattern(val);
                                                                engine.setArpPattern(val);
                                                            }}
                                                            className="select-minimal w-full px-2 py-1 text-[9px] rounded-sm"
                                                        >
                                                            <option value="up">Up</option>
                                                            <option value="down">Down</option>
                                                            <option value="upDown">Up/Down</option>
                                                            <option value="random">Random</option>
                                                            <option value="chord">Chord</option>
                                                        </select>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </GlassPanel>
                </div>
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
