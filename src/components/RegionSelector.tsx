import React from 'react';
import { clsx } from 'clsx';

export type RegionType = 'whole' | 'top' | 'bottom';

interface RegionSelectorProps {
    value: RegionType;
    onChange: (value: RegionType) => void;
    size?: number; // kept for compatibility, controls icon size roughly
    className?: string; // wrapper class
}

export const RegionSelector: React.FC<RegionSelectorProps> = ({
    value,
    onChange,
    size = 12,
    className
}) => {

    // Custom icons for Top/Bottom half circles

    const IconWhole = ({ size, active }: { size: number, active: boolean }) => (
        <div style={{ width: size, height: size }} className={clsx("rounded-full border-2 box-border border-current", active ? "bg-black/20" : "")}></div>
    );

    const IconTop = ({ size }: { size: number }) => (
        <div style={{ width: size, height: size }} className="rounded-full border-2 border-current relative overflow-hidden box-border">
            <div className="absolute top-0 left-0 right-0 h-1/2 bg-current"></div>
        </div>
    );

    const IconBottom = ({ size }: { size: number }) => (
        <div style={{ width: size, height: size }} className="rounded-full border-2 border-current relative overflow-hidden box-border">
            <div className="absolute bottom-0 left-0 right-0 h-1/2 bg-current"></div>
        </div>
    );

    return (
        <div className={clsx("flex gap-1", className)}>
            <button
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange('top'); }}
                className={clsx(
                    "rounded flex items-center justify-center transition-all p-0.5 border",
                    value === 'top' ? "bg-hex-accent text-black border-hex-accent" : "bg-white/5 text-gray-500 border-white/5 hover:bg-white/10"
                )}
                title="Top Half Only"
            >
                <IconTop size={size} />
            </button>

            <button
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange('whole'); }}
                className={clsx(
                    "rounded flex items-center justify-center transition-all p-0.5 border",
                    value === 'whole' ? "bg-hex-accent text-black border-hex-accent" : "bg-white/5 text-gray-500 border-white/5 hover:bg-white/10"
                )}
                title="Whole Instrument"
            >
                <IconWhole size={size} active={value === 'whole'} />
            </button>

            <button
                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange('bottom'); }}
                className={clsx(
                    "rounded flex items-center justify-center transition-all p-0.5 border",
                    value === 'bottom' ? "bg-hex-accent text-black border-hex-accent" : "bg-white/5 text-gray-500 border-white/5 hover:bg-white/10"
                )}
                title="Bottom Half Only"
            >
                <IconBottom size={size} />
            </button>
        </div>
    );
};
