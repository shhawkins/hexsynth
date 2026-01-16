import React, { useState, useEffect } from 'react';
import { Power, Move, Sliders, Music, Waves, Activity } from 'lucide-react';

interface OnboardingModalProps {
    onStart: () => void;
    isReturningUser?: boolean;
    skipDelay?: boolean;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onStart, isReturningUser = false, skipDelay = false }) => {
    const [showModal, setShowModal] = useState(skipDelay);

    // Delay modal appearance to let users see the app briefly (only on initial load)
    useEffect(() => {
        if (skipDelay) {
            setShowModal(true);
            return;
        }
        const timer = setTimeout(() => setShowModal(true), isReturningUser ? 100 : 600);
        return () => clearTimeout(timer);
    }, [isReturningUser, skipDelay]);

    // Minimal version for returning users - just a tap to start
    if (isReturningUser) {
        return (
            <div
                className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-300 ${showModal ? 'bg-black/30 backdrop-blur-sm' : 'bg-transparent'
                    }`}
                onClick={onStart}
            >
                <div className={`flex flex-col items-center transition-all duration-300 ${showModal ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                    }`}>
                    <button
                        onClick={onStart}
                        className="px-8 py-4 bg-black/60 backdrop-blur-xl border border-white/15 rounded-full flex items-center gap-3 hover:scale-105 active:scale-95 transition-all shadow-2xl"
                    >
                        <Power size={18} className="text-hex-accent" />
                        <span className="text-white text-sm font-medium tracking-widest uppercase">TAP TO PLAY</span>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            {/* Frosted backdrop - appears after delay */}
            <div
                className={`fixed inset-0 z-50 transition-all duration-700 ease-out ${showModal
                    ? 'backdrop-blur-md bg-black/40'
                    : 'backdrop-blur-none bg-transparent pointer-events-none'
                    }`}
            >
                {/* Modal Content */}
                <div
                    className={`flex h-full w-full flex-col items-center justify-center transition-all duration-500 ease-out ${showModal ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
                        }`}
                >
                    <div className="flex flex-col items-center glass-panel p-6 md:p-10 rounded-xl max-w-lg mx-4 border border-white/15 shadow-2xl relative bg-black/60 backdrop-blur-xl">
                        {/* Glow accent */}
                        <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-hex-accent/15 blur-3xl rounded-full pointer-events-none"></div>

                        {/* Header */}
                        <div className="flex flex-col items-center mb-6 relative z-10">
                            <h1 className="text-3xl md:text-4xl font-light tracking-[0.2em] text-white drop-shadow-md text-center">
                                HEX-SYNTH
                            </h1>
                            <div className="text-[10px] tracking-[0.4em] text-hex-accent uppercase mt-2 font-semibold">THEREMIN SYNTHESIZER</div>
                        </div>

                        {/* Instructions Grid */}
                        <div className="grid gap-4 w-full mb-6 relative z-10">
                            {/* Play Notes */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                    <Move size={14} className="text-hex-accent" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] text-white leading-relaxed">
                                        <span className="text-hex-accent font-semibold">Play:</span> Touch & drag inside the hexagon.
                                        <span className="text-gray-400"> Y-axis = pitch, X-axis = volume.</span>
                                    </div>
                                </div>
                            </div>

                            {/* Modulation */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                    <Sliders size={14} className="text-hex-accent" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] text-white leading-relaxed">
                                        <span className="text-hex-accent font-semibold">Modulate:</span> Toggle
                                        <span className="bg-white/10 px-1 mx-0.5 rounded text-[9px] font-mono">X</span>
                                        <span className="bg-white/10 px-1 mx-0.5 rounded text-[9px] font-mono">Y</span>
                                        buttons on any param to link it to your finger position.
                                    </div>
                                </div>
                            </div>

                            {/* Effects */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                    <Waves size={14} className="text-hex-accent" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] text-white leading-relaxed">
                                        <span className="text-hex-accent font-semibold">Effects:</span> Each hexagon side has an effect slot.
                                        <span className="text-gray-400"> Tap vertices to swap, gear icon for deep settings.</span>
                                    </div>
                                </div>
                            </div>

                            {/* Scales & Chords */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                    <Music size={14} className="text-hex-accent" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] text-white leading-relaxed">
                                        <span className="text-hex-accent font-semibold">Composition:</span> Open
                                        <span className="text-gray-300 italic"> Composition Tools</span> for
                                        <span className="text-gray-300"> Scale</span>,
                                        <span className="text-gray-300"> Chord</span>, and
                                        <span className="text-gray-300"> Arpeggiator</span> settings. Apply to whole hexagon or just top/bottom half.
                                    </div>
                                </div>
                            </div>

                            {/* Visualizer */}
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0">
                                    <Activity size={14} className="text-hex-accent" />
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] text-white leading-relaxed">
                                        <span className="text-hex-accent font-semibold">Visualizer:</span> Toggle the
                                        <Activity size={10} className="inline mx-1 text-gray-400" />
                                        icon in the Synth panel for a reactive rose curve visualizer.
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-5"></div>

                        {/* Start Button */}
                        <button
                            onClick={onStart}
                            className="btn-minimal px-10 py-3.5 text-sm font-medium tracking-widest rounded-full group transition-all relative z-10 w-full flex justify-center items-center gap-3 hover:scale-105 active:scale-95"
                        >
                            <Power size={16} className="text-hex-accent group-hover:text-white transition-colors" />
                            <span>START</span>
                        </button>
                    </div>

                    {/* Footer */}
                    <div className="absolute bottom-6 text-[9px] text-gray-600 tracking-widest uppercase opacity-60">
                        Best with headphones
                    </div>
                </div>
            </div>
        </>
    );
};
