import React, { useRef, useEffect, useState, useMemo } from 'react';
import { AudioEngine } from '../audio/AudioEngine';
import { getHexagonVertices, isPointInHexagon, getDistancesToSides, type Point, SQRT3 } from '../utils/geometry';
import * as Tone from 'tone';

interface HexagonInstrumentProps {
  engine: AudioEngine;
  width: number;
  height: number;
  effectBadgePos: Point;
  setEffectBadgePos: (p: Point) => void;
  colors: string[];
  ghostNotesEnabled: boolean;
  octaveRange: number;
  modulations: { x: boolean, y: boolean }[];
  masterVolume: number;
  volMod: { x: boolean, y: boolean };
  toneMod: { x: boolean, y: boolean };
  toneBase: number;
  onNoteActive: (color: string) => void;
}

interface Trail {
  id: number;
  points: { x: number; y: number; age: number; width: number; color: string }[];
  lastX: number;
  lastY: number;
}

export const HexagonInstrument: React.FC<HexagonInstrumentProps> = ({
  engine,
  width,
  height,
  effectBadgePos,
  setEffectBadgePos,
  colors: propColors,
  ghostNotesEnabled,
  octaveRange,
  modulations,
  masterVolume,
  volMod,
  toneMod,
  toneBase,
  onNoteActive
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [activeTouches, setActiveTouches] = useState<Map<number, Point>>(new Map());
  const trailsRef = useRef<Map<number, Trail>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const activeBadgePointer = useRef<number | null>(null);

  // Geometry
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(width, height) * 0.42;
  const vertices = useMemo(() => getHexagonVertices({ x: centerX, y: centerY }, radius), [centerX, centerY, radius]);

  // Enhanced Color Theory Palette - "Beautiful Color Wheel"
  // Using HSL to create a seamless rainbow gradient around the hexagon
  const getSideColor = (index: number) => {
    // 6 sides = 60 degrees each.
    // 0: Cyan, 1: Blue, 2: Purple, 3: Pink, 4: Orange, 5: Yellow/Green?
    // Let's adjust for a classic spectral look
    const hues = [190, 260, 320, 10, 45, 120]; // Cyan, Purple, Magenta, Red, Orange, Green
    return `hsl(${hues[index]}, 100%, 60%)`;
  };

  const sideColors = useMemo(() => [0, 1, 2, 3, 4, 5].map(i => getSideColor(i)), []);

  const getColorForPosition = (angleRad: number) => {
    // Smooth gradient
    const deg = (angleRad * 180 / Math.PI + 360) % 360;
    return `hsl(${deg}, 100%, 65%)`; // Slightly brighter/more saturated
  };

  const recordTouchIfActive = (x: number, y: number, id: number, color: string) => {
    engine.tracks.forEach((track, idx) => {
      if (track.isRecording) {
        engine.recordTouchEvent(idx, x, y, id, color);
      }
    });
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const p = { x, y };

    const badgeDist = Math.sqrt(Math.pow(x - effectBadgePos.x, 2) + Math.pow(y - effectBadgePos.y, 2));
    if (badgeDist < 30) {
      (e.target as Element).setPointerCapture(e.pointerId);
      activeBadgePointer.current = e.pointerId;
      return;
    }

    if (isPointInHexagon(p, vertices)) {
      (e.target as Element).setPointerCapture(e.pointerId);
      updateNoteFromPosition(e.pointerId, x, y);
      setActiveTouches(prev => new Map(prev).set(e.pointerId, p));

      const angle = Math.atan2(y - centerY, x - centerX);
      const color = getColorForPosition(angle);

      recordTouchIfActive(x, y, e.pointerId, color);
      onNoteActive(color);

      trailsRef.current.set(e.pointerId, {
        id: e.pointerId,
        points: [],
        lastX: x, lastY: y
      });
    }
  };


  const handlePointerMove = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (activeBadgePointer.current === e.pointerId) {
      if (isPointInHexagon({ x, y }, vertices)) {
        setEffectBadgePos({ x, y });
        updateEffectsFromBadge({ x, y });
      }
      return;
    }

    if (activeTouches.has(e.pointerId)) {
      updateNoteFromPosition(e.pointerId, x, y);
      setActiveTouches(prev => new Map(prev).set(e.pointerId, { x, y }));

      const angle = Math.atan2(y - centerY, x - centerX);
      const color = getColorForPosition(angle);

      recordTouchIfActive(x, y, e.pointerId, color);
      onNoteActive(color);

      const trail = trailsRef.current.get(e.pointerId);
      if (trail) {
        trail.points.push({ x, y, age: 1.0, width: 2, color });
        trail.lastX = x;
        trail.lastY = y;
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activeBadgePointer.current === e.pointerId) {
      activeBadgePointer.current = null;
      return;
    }

    if (activeTouches.has(e.pointerId)) {
      engine.stopNote(e.pointerId);
      setActiveTouches(prev => {
        const next = new Map(prev);
        next.delete(e.pointerId);
        return next;
      });
    }
  };

  const updateNoteFromPosition = (id: number, x: number, y: number) => {
    const minX = centerX - radius;
    const maxX = centerX + radius;
    const minY = centerY - radius * SQRT3 / 2;
    const maxY = centerY + radius * SQRT3 / 2;

    let normX = (x - minX) / (maxX - minX);
    let normY = 1 - ((y - minY) / (maxY - minY));

    // Swap: X is Volume (Loudness), Y is Pitch (Up=High)
    const minNote = engine.rootFreq * Math.pow(2, 0);
    const maxNote = engine.rootFreq * Math.pow(2, octaveRange);

    // Pitch follows Y (Vertical) - Up (normY=1) is High Pitch
    const freq = minNote * Math.pow(maxNote / minNote, normY);

    // Calculate Volume with Modulation
    let volFactor = 1.0;
    if (volMod.x || volMod.y) {
      let factors = [];
      if (volMod.x) factors.push(Math.max(0, Math.min(1, normX)));
      if (volMod.y) factors.push(Math.max(0, Math.min(1, normY)));

      // Use average of enabled modulators
      const sum = factors.reduce((a, b) => a + b, 0);
      volFactor = sum / factors.length;
    }
    const vol = masterVolume * volFactor; // Scale base volume by modulation

    // Calculate Tone with Modulation
    let toneFactor = 1.0;
    if (toneMod.x || toneMod.y) {
      let factors = [];
      // Tone mod: X or Y maps 0..1 to modulation factor
      if (toneMod.x) factors.push(Math.max(0, Math.min(1, normX)));
      if (toneMod.y) factors.push(Math.max(0, Math.min(1, normY)));

      const sum = factors.reduce((a, b) => a + b, 0);
      toneFactor = sum / factors.length;
    }
    // Tone usually sets a filter frequency. 
    // If modulation is on, we scale the Base Tone.
    // If Base Tone is 1.0 (Open), and mod is 0.5, effective is 0.5.
    const finalTone = toneBase * toneFactor;

    engine.setTone(finalTone);
    engine.startNote(id, freq, vol);

    // Apply Modulations
    // Note: If multiple touches, the last one updates the effects.
    // If we want multiple touches to average, we'd need more logic, but "last takes precedence" is standard for single-parameter control.
    modulations.forEach((mod, i) => {
      if (mod.x || mod.y) {
        let strength = 0;
        // Strategy: additive or max?
        // If X and Y are both active, maybe average?
        // "Tie any effect to x or y".
        // If X (Pitch) is active, Pitch drives it.
        // If Y (Vol) is active, Vol drives it.

        // Re-normalize for effect strength (0-1)
        const pitchStrength = Math.max(0, Math.min(1, normY));
        const volStrength = Math.max(0, Math.min(1, normX));

        if (mod.x && mod.y) {
          strength = (pitchStrength + volStrength) / 2;
        } else if (mod.x) {
          strength = volStrength; // X Axis (Volume)
        } else if (mod.y) {
          strength = pitchStrength; // Y Axis (Pitch)
        }

        engine.updateEffectParameter(i, strength);
      }
    });
  };

  const updateEffectsFromBadge = (pos: Point) => {
    const dists = getDistancesToSides(pos, vertices);
    const maxDist = radius;

    dists.forEach((d, i) => {
      // Only update from badge if modulation is NOT active for this effect
      // This prevents fighting between badge position and note modulation
      if (!modulations[i].x && !modulations[i].y) {
        const strength = Math.max(0, 1 - (d / maxDist));
        engine.updateEffectParameter(i, strength);
      }
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // 0. Background Gradient within Hexagon (Subtle)
      // This fills the hex with a very faint spectrum
      ctx.save();
      ctx.beginPath();
      vertices.forEach((v, i) => {
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.clip();
      // Draw a radial gradient? Or mesh? Let's keep it simple: faint radial
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
      gradient.addColorStop(0, 'rgba(0,0,0,0)');
      gradient.addColorStop(1, 'rgba(0, 242, 255, 0.05)'); // Faint cyan glow at edges
      ctx.fillStyle = gradient;
      ctx.fill();
      ctx.restore();

      // 1. Hexagon Frame (Glow restored)
      ctx.shadowBlur = 10; // Moderate glow
      ctx.shadowColor = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      vertices.forEach((v, i) => {
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 2. Active Sides (Vibrant)
      // Draw them with a bit of "neon light" aesthetic
      vertices.forEach((v, i) => {
        const nextV = vertices[(i + 1) % 6];
        ctx.beginPath();
        ctx.moveTo(v.x, v.y);
        ctx.lineTo(nextV.x, nextV.y);

        ctx.strokeStyle = sideColors[i];
        ctx.lineWidth = 3;

        // Bloom
        ctx.shadowBlur = 12;
        ctx.shadowColor = sideColors[i];
        ctx.stroke();
      });
      ctx.shadowBlur = 0;

      // 3. Grid (Techy but clean) - HORIZONTAL for Pitch
      // Add semitone lines back, but cleaner
      const totalNotes = 12 * octaveRange;
      const notchCount = totalNotes;
      const hexHalfHeight = radius * SQRT3 / 2;
      const topY = centerY - hexHalfHeight;
      const bottomY = centerY + hexHalfHeight;
      const leftX = centerX - radius;
      const rightX = centerX + radius; // Fix: Defined rightX

      // Define grid height range matching the note range
      const gridHeight = bottomY - topY;

      ctx.save();
      // Clip to Hexagon so horizontal lines don't bleed
      ctx.beginPath();
      vertices.forEach((v, i) => {
        if (i === 0) ctx.moveTo(v.x, v.y);
        else ctx.lineTo(v.x, v.y);
      });
      ctx.closePath();
      ctx.clip();

      ctx.globalAlpha = 0.8;
      for (let i = 0; i <= notchCount; i++) {
        // Calculate Y for this pitch step
        // Pitch Low (i=0) -> BottomY
        // Pitch High (i=max) -> TopY
        const y = bottomY - (i / notchCount) * gridHeight;

        const isRoot = i % 12 === 0;

        if (isRoot) {
          // Root Note Line - Visible
          ctx.beginPath();
          ctx.moveTo(leftX, y);
          ctx.lineTo(rightX, y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // Semitone Lines - Faint
          // We draw full lines across and let the hexagon clip handle the edges
          ctx.beginPath();
          ctx.moveTo(leftX, y);
          ctx.lineTo(rightX, y);
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)'; // Very faint
          ctx.lineWidth = 1;
          // dash?
          // ctx.setLineDash([2, 4]); // Optional: make them dashed
          ctx.stroke();
          // ctx.setLineDash([]);
        }
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // 4. Ghost Notes (Luminous dots)
      if (ghostNotesEnabled && engine.masterLoopDuration) {
        const transportTime = Tone.Transport.seconds % engine.masterLoopDuration;

        engine.tracks.forEach(track => {
          if (track.isPlaying && track.ghostEvents.length > 0) {
            track.ghostEvents.forEach(e => {
              const diff = Math.abs(e.time - transportTime);
              const wrapDiff = Math.abs(engine.masterLoopDuration! - diff);
              const threshold = 0.15; // increased window for visibility

              if (diff < threshold || wrapDiff < threshold) {
                ctx.beginPath();
                ctx.arc(e.x, e.y, 5, 0, Math.PI * 2);
                ctx.fillStyle = e.color || track.color;
                ctx.shadowBlur = 10;
                ctx.shadowColor = e.color || track.color;
                ctx.fill();

                ctx.shadowBlur = 0;

                ctx.beginPath();
                ctx.arc(e.x, e.y, 10 + (Math.random() * 3), 0, Math.PI * 2);
                ctx.strokeStyle = e.color || track.color;
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
            });
          }
        });
      }

      // 5. Trails (Neon Lasers)
      ctx.lineCap = 'round';
      trailsRef.current.forEach((trail, id) => {
        if (trail.points.length > 1) {

          // Outer Glow
          ctx.beginPath();
          for (let i = 1; i < trail.points.length; i++) {
            const p1 = trail.points[i - 1];
            const p2 = trail.points[i];
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineWidth = 3;
            ctx.strokeStyle = p2.color;
            ctx.shadowBlur = 8;
            ctx.shadowColor = p2.color;
            ctx.stroke();
          }
          ctx.shadowBlur = 0;

          // Inner Core (White hot)
          ctx.beginPath();
          for (let i = 1; i < trail.points.length; i++) {
            const p1 = trail.points[i - 1];
            const p2 = trail.points[i];
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.lineWidth = 1;
            ctx.strokeStyle = '#fff';
            ctx.stroke();
          }
        }

        trail.points.forEach(p => p.age -= 0.05); // Slower decay for nicer trails
        trail.points = trail.points.filter(p => p.age > 0);

        if (!activeTouches.has(id) && trail.points.length === 0) {
          trailsRef.current.delete(id);
        }
      });

      // 6. Active Touches (Glowing Rings)
      activeTouches.forEach((p) => {
        const angle = Math.atan2(p.y - centerY, p.x - centerX);
        const color = getColorForPosition(angle);

        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.shadowBlur = 12;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;

        // Center dot
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      });

      // 7. Badge (Defined Puck with color)
      ctx.beginPath();
      ctx.arc(effectBadgePos.x, effectBadgePos.y, 8, 0, Math.PI * 2);
      // Fill with dark hue of current position
      const badgeAngle = Math.atan2(effectBadgePos.y - centerY, effectBadgePos.x - centerX);
      const badgeColor = getColorForPosition(badgeAngle);
      ctx.fillStyle = '#111';
      ctx.fill();

      ctx.lineWidth = 2;
      ctx.strokeStyle = badgeColor;
      ctx.shadowBlur = 15;
      ctx.shadowColor = badgeColor;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Center dot
      ctx.beginPath();
      ctx.arc(effectBadgePos.x, effectBadgePos.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();

      // Connector line (very faint laser)
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(effectBadgePos.x, effectBadgePos.y);
      ctx.strokeStyle = badgeColor;
      ctx.stroke();
      ctx.globalAlpha = 1;

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();
    return () => {
      if (animationFrameRef.current !== undefined) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [width, height, vertices, activeTouches, effectBadgePos, propColors, ghostNotesEnabled, octaveRange, sideColors]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      className="touch-none cursor-crosshair"
      style={{ width, height }}
    />
  );
};