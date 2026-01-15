import React from 'react';
import { Power, Move, RotateCw, Activity } from 'lucide-react';

interface OnboardingModalProps {
    onStart: () => void;
}

export const OnboardingModal: React.FC<OnboardingModalProps> = ({ onStart }) => {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-hex-bg text-hex-text relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 tech-lines opacity-10"></div>
            <div className="absolute inset-0 bg-gradient-radial from-hex-accent/5 to-transparent opacity-50"></div>

            <div className="z-10 flex flex-col items-center glass-panel p-8 md:p-12 rounded-xl animate-fade-in max-w-md mx-4 border border-white/10 shadow-2xl relative">
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-40 h-40 bg-hex-accent/20 blur-3xl rounded-full pointer-events-none"></div>

                <div className="flex flex-col items-center mb-10 relative z-10">
                    <h1 className="text-4xl font-light tracking-[0.2em] text-white fade-in drop-shadow-md text-center">
                        HEXAGON
                    </h1>
                    <div className="text-xs tracking-[0.4em] text-hex-accent uppercase mt-3 font-semibold">Synthesizer System</div>
                </div>

                <div className="grid gap-5 w-full mb-10 relative z-10">
                    <div className="flex items-start gap-4 text-gray-300 group">
                        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0 mt-0.5">
                            <Move size={16} className="text-hex-accent" />
                        </div>
                        <div>
                            <div className="text-[11px] text-white leading-relaxed">Touch & drag anywhere inside the hexagon to play notes</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 text-gray-300 group">
                        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0 mt-0.5">
                            <RotateCw size={16} className="text-hex-accent" />
                        </div>
                        <div>
                            <div className="text-[11px] text-white leading-relaxed">Customize each side of the hexagon with an effect to dial in the perfect sound</div>
                        </div>
                    </div>

                    <div className="flex items-start gap-4 text-gray-300 group">
                        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center border border-white/10 shrink-0 mt-0.5">
                            <Activity size={16} className="text-hex-accent" />
                        </div>
                        <div>
                            <div className="text-[11px] text-white leading-relaxed">Use the panel on the left to change sounds and settings</div>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onStart}
                    className="btn-minimal px-10 py-4 text-sm font-medium tracking-widest rounded-full group transition-all relative z-10 w-full flex justify-center items-center gap-3 hover:scale-105 active:scale-95"
                >
                    <Power size={16} className="text-hex-accent group-hover:text-white transition-colors" />
                    <span>INITIALIZE SYSTEM</span>
                </button>
            </div>

            <div className="absolute bottom-8 text-[10px] text-gray-600 tracking-widest uppercase opacity-50">
                Audio Experience
            </div>
        </div>
    );
};
