import React, { useState, useEffect, useRef } from 'react';
import { X, Sliders } from 'lucide-react';
import { clsx } from 'clsx';
import { AudioEngine } from '../audio/AudioEngine';
import { EFFECT_TYPES, type EffectType } from '../audio/effects';

interface EffectsControlPanelProps {
    engine: AudioEngine;
    isOpen: boolean;
    onClose: () => void;
    activeEffectIndex: number | null; // If user clicked a specific small button
    onEffectChange: (index: number, type: EffectType) => void;
}

// Parameter definitions for each effect type
const EFFECT_PARAMS: Record<EffectType, { name: string; key: string; min: number; max: number; step: number; suffix?: string }[]> = {
    'AutoFilter': [
        { name: 'Frequency', key: 'frequency', min: 0.1, max: 20, step: 0.1, suffix: 'Hz' },
        { name: 'Depth', key: 'depth', min: 0, max: 1, step: 0.05 },
        { name: 'Base Freq', key: 'baseFrequency', min: 20, max: 1000, step: 10, suffix: 'Hz' }
    ],
    'AutoPanner': [
        { name: 'Frequency', key: 'frequency', min: 0.1, max: 20, step: 0.1, suffix: 'Hz' },
        { name: 'Depth', key: 'depth', min: 0, max: 1, step: 0.05 }
    ],
    'AutoWah': [
        { name: 'Base Freq', key: 'baseFrequency', min: 20, max: 1000, step: 10, suffix: 'Hz' },
        { name: 'Octaves', key: 'octaves', min: 1, max: 8, step: 1 },
        { name: 'Sensitivity', key: 'sensitivity', min: -40, max: 0, step: 1, suffix: 'dB' },
        { name: 'Q', key: 'Q', min: 0, max: 10, step: 0.1 }
    ],
    'BitCrusher': [
        { name: 'Bits', key: 'bits', min: 1, max: 16, step: 1 }
    ],
    'Chebyshev': [
        { name: 'Order', key: 'order', min: 1, max: 100, step: 1 }
    ],
    'Chorus': [
        { name: 'Frequency', key: 'frequency', min: 0.1, max: 20, step: 0.1, suffix: 'Hz' },
        { name: 'Delay Time', key: 'delayTime', min: 2, max: 20, step: 0.5, suffix: 'ms' },
        { name: 'Depth', key: 'depth', min: 0, max: 1, step: 0.05 }
    ],
    'Distortion': [
        { name: 'Distortion', key: 'distortion', min: 0, max: 1, step: 0.05 }
    ],
    'FeedbackDelay': [
        { name: 'Delay Time', key: 'delayTime', min: 0, max: 1, step: 0.05, suffix: 's' },
        { name: 'Feedback', key: 'feedback', min: 0, max: 1, step: 0.05 }
    ],
    'JCReverb': [
        { name: 'Room Size', key: 'roomSize', min: 0, max: 1, step: 0.05 }
    ],
    'FrequencyShifter': [
        { name: 'Frequency', key: 'frequency', min: -1000, max: 1000, step: 10, suffix: 'Hz' }
    ],
    'Phaser': [
        { name: 'Frequency', key: 'frequency', min: 0.1, max: 20, step: 0.1, suffix: 'Hz' },
        { name: 'Octaves', key: 'octaves', min: 1, max: 8, step: 1 },
        { name: 'Base Freq', key: 'baseFrequency', min: 20, max: 1000, step: 10, suffix: 'Hz' }
    ],
    'PingPongDelay': [
        { name: 'Delay Time', key: 'delayTime', min: 0, max: 1, step: 0.05, suffix: 's' },
        { name: 'Feedback', key: 'feedback', min: 0, max: 1, step: 0.05 }
    ],
    'StereoWidener': [
        { name: 'Width', key: 'width', min: 0, max: 1, step: 0.05 }
    ],
    'PitchShift': [
        { name: 'Pitch', key: 'pitch', min: -12, max: 12, step: 1, suffix: 'st' }
    ],
    'Tremolo': [
        { name: 'Frequency', key: 'frequency', min: 0.1, max: 20, step: 0.1, suffix: 'Hz' },
        { name: 'Depth', key: 'depth', min: 0, max: 1, step: 0.05 }
    ],
    'Vibrato': [
        { name: 'Frequency', key: 'frequency', min: 0.1, max: 20, step: 0.1, suffix: 'Hz' },
        { name: 'Depth', key: 'depth', min: 0, max: 1, step: 0.05 }
    ]
};

export const EffectsControlPanel: React.FC<EffectsControlPanelProps> = ({ engine, isOpen, onClose, activeEffectIndex, onEffectChange }) => {
    const [selectedSlot, setSelectedSlot] = useState<number>(0);
    const [position, setPosition] = useState({ x: 100, y: 100 });

    // Drag state
    const isDragging = useRef(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const startPos = useRef({ x: 0, y: 0 });

    useEffect(() => {
        if (activeEffectIndex !== null && activeEffectIndex >= 0 && activeEffectIndex < 6) {
            setSelectedSlot(activeEffectIndex);
        }
    }, [activeEffectIndex]);

    // Center on open
    useEffect(() => {
        if (isOpen) {
            setPosition({
                x: Math.max(20, window.innerWidth / 2 - 250),
                y: Math.max(20, window.innerHeight / 2 - 175)
            });
        }
    }, [isOpen]);

    const handlePointerDown = (e: React.PointerEvent) => {
        isDragging.current = true;
        dragStart.current = { x: e.clientX, y: e.clientY };
        startPos.current = { ...position };
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!isDragging.current) return;
        const dx = e.clientX - dragStart.current.x;
        const dy = e.clientY - dragStart.current.y;
        setPosition({ x: startPos.current.x + dx, y: startPos.current.y + dy });
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        isDragging.current = false;
        (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    };

    if (!isOpen) return null;

    const currentEffect = engine.effects[selectedSlot];

    return (
        <div
            className="fixed z-50 bg-[#0a0a0a] border border-hex-border/30 rounded-lg w-[500px] max-w-[90vw] shadow-2xl flex flex-col overflow-hidden backdrop-blur-md"
            style={{
                left: position.x,
                top: position.y,
                touchAction: 'none'
            }}
        >
            {/* Header */}
            <div
                className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 cursor-move select-none"
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
            >
                <div className="flex items-center gap-2 text-hex-accent pointer-events-none">
                    <Sliders size={16} />
                    <h2 className="text-sm font-bold tracking-wider uppercase">Effects Processor</h2>
                </div>
                <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors" onPointerDown={e => e.stopPropagation()}>
                    <X size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="flex h-[350px]">
                {/* Sidebar: Slots */}
                <div className="w-32 border-r border-white/5 bg-black/20 flex flex-col p-2 gap-1 overflow-y-auto">
                    {[0, 1, 2, 3, 4, 5].map(i => {
                        const eff = engine.effects[i];
                        const label = eff ? eff.name.replace('Tone.', '') : 'Empty';

                        return (
                            <button
                                key={i}
                                onClick={() => setSelectedSlot(i)}
                                className={clsx(
                                    "text-left px-3 py-2 rounded text-[10px] uppercase tracking-wide transition-all group relative",
                                    selectedSlot === i
                                        ? "bg-hex-accent/20 text-hex-accent border border-hex-accent/30"
                                        : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                                )}
                            >
                                <div className="font-bold flex justify-between items-center">
                                    <span>Slot {i + 1}</span>
                                </div>

                                {selectedSlot === i ? (
                                    <div className="mt-1" onPointerDown={e => e.stopPropagation()}>
                                        <select
                                            className="w-full bg-black/40 border border-hex-accent/30 text-hex-accent text-[9px] rounded px-1 py-0.5 outline-none"
                                            value={eff?.name.replace('Tone.', '') || ''}
                                            onChange={(e) => onEffectChange(i, e.target.value as EffectType)}
                                        >
                                            <option value="">None</option>
                                            {EFFECT_TYPES.map(type => (
                                                <option key={type} value={type}>{type}</option>
                                            ))}
                                        </select>
                                    </div>
                                ) : (
                                    <div className="opacity-70 truncate text-[9px]">{label}</div>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Main Config Area */}
                <div className="flex-1 p-6 overflow-y-auto">
                    {currentEffect ? (
                        <EffectControls
                            engine={engine}
                            effect={currentEffect}
                            index={selectedSlot}
                            effectName={currentEffect.name.replace('Tone.', '') as EffectType}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-600 text-[10px] uppercase tracking-widest">
                            No Effect Loaded
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const EffectControls = ({ engine, effect, index, effectName }: { engine: AudioEngine, effect: any, index: number, effectName: EffectType }) => {
    const params = EFFECT_PARAMS[effectName] || [];
    // Force update for sliders
    const [, setTick] = useState(0);

    const handleChange = (key: string, val: number) => {
        engine.setEffectParam(index, key, val);
        setTick(t => t + 1);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-white/5 pb-2">
                <h3 className="text-lg font-light text-white">{effectName}</h3>
                <div className={clsx("w-2 h-2 rounded-full", effect.wet.value > 0 ? "bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-gray-700")} />
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* Always show Mix/Wet */}
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] uppercase text-gray-400">
                        <span>Mix (Wet)</span>
                        <span className="text-hex-accent">{Math.round((effect.wet.value || 0) * 100)}%</span>
                    </div>
                    <input
                        type="range" min="0" max="1" step="0.01"
                        value={effect.wet.value ?? 0}
                        onChange={(e) => {
                            engine.updateEffectParameter(index, parseFloat(e.target.value));
                            setTick(t => t + 1);
                        }}
                        className="slider-minimal w-full"
                    />
                </div>

                {params.map(p => {
                    let currentVal = 0;
                    // Safely access nested props if needed, but usually flat on node (e.g. effect.frequency.value)
                    const nodeParam = effect[p.key];
                    if (nodeParam && typeof nodeParam.value === 'number') {
                        currentVal = nodeParam.value;
                    } else if (typeof nodeParam === 'number') {
                        currentVal = nodeParam; // e.g. distortion amount
                    } else if (nodeParam === undefined) {
                        // try direct property
                        currentVal = (effect as any)[p.key] ?? p.min;
                    }

                    return (
                        <div key={p.key} className="space-y-2">
                            <div className="flex justify-between text-[10px] uppercase text-gray-400">
                                <span>{p.name}</span>
                                <span className="text-gray-300">
                                    {currentVal.toFixed(p.step < 1 ? 2 : 0)} {p.suffix}
                                </span>
                            </div>
                            <input
                                type="range"
                                min={p.min} max={p.max} step={p.step}
                                value={currentVal}
                                onChange={(e) => handleChange(p.key, parseFloat(e.target.value))}
                                className="slider-minimal w-full"
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
