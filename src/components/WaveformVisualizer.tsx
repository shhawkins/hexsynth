import React, { useEffect, useRef } from 'react';
import * as Tone from 'tone';

interface WaveformVisualizerProps {
  analyzer: Tone.Waveform;
  width: number;
  height: number;
  color: string;
}

export const WaveformVisualizer: React.FC<WaveformVisualizerProps> = ({ analyzer, width, height, color }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;

    const render = () => {
      const values = analyzer.getValue();
      ctx.clearRect(0, 0, width, height);

      // Main Line
      ctx.beginPath();
      // Medium thickness
      ctx.lineWidth = 2;
      // Dynamic Color calculation based on amplitude/frequency content roughly
      const rms = Math.sqrt(values.reduce((acc, val) => acc + (val as number) * (val as number), 0) / values.length);
      // Map RMS to Hue shift? Or just use a rainbow gradient like the hex?

      const gradient = ctx.createLinearGradient(0, 0, width, 0);
      gradient.addColorStop(0, '#00f0ff');
      gradient.addColorStop(0.2, '#ff0055');
      gradient.addColorStop(0.4, '#ccff00');
      gradient.addColorStop(0.6, '#aa00ff');
      gradient.addColorStop(0.8, '#ffffff');
      gradient.addColorStop(1, '#ffaa00');

      ctx.strokeStyle = gradient;
      ctx.globalAlpha = 0.8 + Math.min(0.2, rms); // Pulse opacity

      // Nice bloom
      ctx.shadowBlur = 10 + rms * 20; // Dynamic glow
      ctx.shadowColor = 'rgba(255,255,255,0.5)';

      const sliceWidth = width / values.length;
      let x = 0;

      // Add padding to prevent clipping at top/bottom (values are -1 to 1)
      const padding = 10;
      const usableHeight = height - padding * 2;

      for (let i = 0; i < values.length; i++) {
        const v = values[i] as number;
        // Map -1..1 to padded height range
        // v=-1 -> y = height - padding
        // v=1 -> y = padding
        // y = ((v + 1) / 2) * usableHeight + padding --- No wait, standard mapping:
        // (1 - (v + 1) / 2) * usableHeight + padding ? 
        // Tone.Waveform returns -1 to 1.
        // Screen Y: 0 is top.
        // We want 1 to be top (padding), -1 to be bottom (height-padding)
        // inverse: y = height/2 - (v * usableHeight/2)

        const y = (height / 2) + (v * (usableHeight / 2));

        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);

        x += sliceWidth;
      }

      ctx.stroke();

      // Reflection ?? maybe too much. Keep it just bloom.

      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;

      animId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animId);
  }, [analyzer, width, height, color]);

  return <canvas ref={canvasRef} width={width} height={height} className="rounded-lg" />;
};