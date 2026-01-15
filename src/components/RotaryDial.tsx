import React, { useState } from 'react';
import { clsx } from 'clsx';

interface RotaryDialProps {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  label?: string;
  size?: number;
  continuous?: boolean;
  min?: number;
  max?: number;
  val?: number;
  onValueChange?: (value: number) => void;
}

export const RotaryDial: React.FC<RotaryDialProps> = ({
  value, options, onChange, label, size = 60,
  continuous = false, min = 0, max = 1, val = 0, onValueChange
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);

  // Discrete logic
  const currentIndex = options.indexOf(value);

  const sensitivity = 5;

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsDragging(true);
    setStartY(e.clientY);
    (e.target as Element).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const deltaY = startY - e.clientY;

    if (continuous && onValueChange) {
      // Continuous Mode
      // Sensitivity: full range in 200px?
      const range = max - min;
      const pixelRange = 200;
      const change = (deltaY / pixelRange) * range;

      let newVal = val + change;
      newVal = Math.max(min, Math.min(newVal, max));

      if (newVal !== val) {
        onValueChange(newVal);
        setStartY(e.clientY);
      }
    } else {
      // Discrete Mode
      if (Math.abs(deltaY) > sensitivity) {
        const steps = Math.round(deltaY / sensitivity);
        let newIndex = currentIndex + steps;
        newIndex = Math.max(0, Math.min(newIndex, options.length - 1));

        if (newIndex !== currentIndex) {
          onChange(options[newIndex]);
          setStartY(e.clientY);
        }
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    setIsDragging(false);
    (e.target as Element).releasePointerCapture(e.pointerId);
  };

  let rotation = -135;
  if (continuous) {
    rotation = -135 + ((val - min) / (max - min)) * 270;
  } else {
    rotation = -135 + (currentIndex / (options.length - 1)) * 270;
  }

  // Ticks generation for continuous mode
  const displayTicks = continuous
    ? Array.from({ length: 11 }, (_, i) => i / 10)
    : options;

  return (
    <div className="flex flex-col items-center gap-2 select-none">
      {label && <span className="text-[9px] uppercase text-gray-400 tracking-[0.2em] font-medium text-glow-sm">{label}</span>}
      <div
        className={clsx(
          "relative rounded-full border border-white/10 bg-black/40 flex items-center justify-center cursor-ns-resize group transition-all",
          isDragging ? "border-hex-accent/50 bg-black/60 shadow-[0_0_15px_rgba(0,242,255,0.2)]" : "hover:border-white/30"
        )}
        style={{ width: size, height: size }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >

        {/* Ticks */}
        {displayTicks.map((_, i) => {
          let rot = 0;
          let isSelected = false;

          if (continuous) {
            const portion = i / (displayTicks.length - 1);
            rot = -135 + portion * 270;
            // Highlight up to current value?
            const currentPortion = (val - min) / (max - min);
            isSelected = portion <= currentPortion + 0.01;
          } else {
            rot = -135 + (i / (options.length - 1)) * 270;
            isSelected = i === currentIndex;
          }

          return (
            <div
              key={i}
              className={clsx(
                "absolute w-px origin-bottom transition-all duration-300",
                isSelected && continuous ? "bg-hex-accent/50 h-2 bottom-[50%] translate-y-[-14px]" :
                  (isSelected && !continuous) ? "bg-hex-accent h-2.5 bottom-[50%] translate-y-[-14px] shadow-[0_0_4px_#00f2ff]" :
                    "bg-white/10 h-1.5 bottom-[50%] translate-y-[-14px]"
              )}
              style={{
                left: 'calc(50% - 0.5px)',
                transform: `rotate(${rot}deg) translateY(-${size / 2 - 12}px)`
              }}
            />
          );
        })}

        {/* Knob Marker - Illuminated */}
        <div
          className="absolute w-full h-full rounded-full transition-transform duration-100 ease-out flex items-center justify-center"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div
            className={clsx(
              "absolute top-1.5 w-1.5 h-3.5 rounded-full transition-colors shadow-[0_0_8px_currentColor]",
              isDragging ? "bg-hex-accent text-hex-accent" : "bg-white/90 text-white"
            )}
          />
        </div>

        {/* Center Value Display */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-[10px] items-center justify-center font-bold text-gray-200 font-mono z-10 transition-colors group-hover:text-white">
            {value}
          </div>
        </div>
      </div>
    </div>
  );
};
