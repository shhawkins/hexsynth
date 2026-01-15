export type ScaleType = 'chromatic' | 'major' | 'minor' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'locrian' | 'pentatonicMajor' | 'pentatonicMinor' | 'blues';
export type ChordType = 'off' | 'triad' | 'sus2' | 'sus4' | 'maj7' | 'm7' | 'dom7' | 'dim' | 'aug' | 'maj9' | 'm9';

export const SCALES: Record<ScaleType, { name: string; intervals: number[] }> = {
    chromatic: { name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
    major: { name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11] },
    minor: { name: 'Minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10] },
    dorian: { name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
    phrygian: { name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
    lydian: { name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
    mixolydian: { name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
    aeolian: { name: 'Aeolian', intervals: [0, 2, 3, 5, 7, 8, 10] },
    locrian: { name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
    pentatonicMajor: { name: 'Major Pent', intervals: [0, 2, 4, 7, 9] },
    pentatonicMinor: { name: 'Minor Pent', intervals: [0, 3, 5, 7, 10] },
    blues: { name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] }
};

export const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function getNearestScaleNote(semitonesFromRoot: number, scaleType: ScaleType): number {
    const scale = SCALES[scaleType];
    const octave = Math.floor(semitonesFromRoot / 12);
    const noteIndex = Math.round(semitonesFromRoot % 12);
    const normalizedIndex = noteIndex < 0 ? noteIndex + 12 : noteIndex;

    // Find nearest interval
    let minDiff = Infinity;
    let nearestInterval = 0;

    for (const interval of scale.intervals) {
        const diff = Math.abs(normalizedIndex - interval);
        if (diff < minDiff) {
            minDiff = diff;
            nearestInterval = interval;
        }
    }

    return octave * 12 + nearestInterval;
}

export function quantizeFrequency(
    freq: number,
    rootFreq: number,
    scaleType: ScaleType
): number {
    if (scaleType === 'chromatic') return freq;

    // Calculate semitones from root
    // freq = root * 2^(semitones/12)
    // semitones = 12 * log2(freq / root)
    const semitonesEx = 12 * Math.log2(freq / rootFreq);

    const quantizedSemitones = getNearestScaleNote(semitonesEx, scaleType);


    return rootFreq * Math.pow(2, quantizedSemitones / 12);
}

export function getChordFrequencies(
    baseFreq: number,
    rootFreq: number,
    scaleType: ScaleType,
    chordType: ChordType
): number[] {
    if (chordType === 'off') return [baseFreq];

    // DEFINITIONS: Semitone intervals for fixed chord qualities
    const CHORD_INTERVALS: Record<string, number[]> = {
        'maj7': [0, 4, 7, 11],
        'm7': [0, 3, 7, 10],
        'dom7': [0, 4, 7, 10],
        'sus2': [0, 2, 7],
        'sus4': [0, 5, 7],
        'aug': [0, 4, 8],
        'dim': [0, 3, 6],
        'maj9': [0, 4, 7, 11, 14],
        'm9': [0, 3, 7, 10, 14]
    };

    // 1. Handle Fixed Qualities (Overrides Scale/Diatonic logic)
    if (CHORD_INTERVALS[chordType]) {
        return CHORD_INTERVALS[chordType].map(semitone => {
            return baseFreq * Math.pow(2, semitone / 12);
        });
    }

    // 2. Handle Generic/Diatonic Types (Triad, etc)
    // If Chromatic and user selected 'triad', default to Major Triad
    if (scaleType === 'chromatic') {
        if (chordType === 'triad') {
            return [0, 4, 7].map(s => baseFreq * Math.pow(2, s / 12));
        }
        return [baseFreq];
    }

    // 3. Diatonic Logic for "triad" in a Scale
    // Determine the scale degree of the base note
    const semitonesFromRoot = 12 * Math.log2(baseFreq / rootFreq);
    // Normalize to 0-11
    const quantizedSemitones = getNearestScaleNote(semitonesFromRoot, scaleType);

    // Get scale intervals
    const intervals = SCALES[scaleType].intervals;

    // Use quantized semitones for chord calculation
    const currentOctave = Math.floor(quantizedSemitones / 12);
    const baseNoteIndex = Math.round(quantizedSemitones % 12); // approx

    // Find closest scale interval
    let intervalIndex = -1;
    let minDiff = 100;

    // Simple approach: Iterate scale intervals to find match (modulo 12)
    const normBaseMod = ((baseNoteIndex % 12) + 12) % 12;

    intervals.forEach((val, idx) => {
        if (Math.abs(val - normBaseMod) < minDiff) {
            minDiff = Math.abs(val - normBaseMod);
            intervalIndex = idx;
        }
    });

    if (intervalIndex === -1) return [baseFreq];

    // Generate chord degrees (offsets in scale steps)
    // Triad: 1-3-5 -> +0, +2, +4
    let chordOffsets: number[] = [];

    // Only 'triad' is left here based on current types, but extensible
    if (chordType === 'triad') {
        chordOffsets = [0, 2, 4];
    } else {
        // Fallback
        return [baseFreq];
    }

    const freqs = chordOffsets.map(offset => {
        // Calculate effective index
        const totalIndex = intervalIndex + offset;
        const effectiveIntervalIndex = totalIndex % intervals.length;
        const octaveShift = Math.floor(totalIndex / intervals.length);

        const scaleInterval = intervals[effectiveIntervalIndex];
        // semitones = scaleInterval + (currentOctave + octaveShift) * 12
        const totalSemitones = scaleInterval + (currentOctave + octaveShift) * 12;

        return rootFreq * Math.pow(2, totalSemitones / 12);
    });

    return freqs;
}
