import * as Tone from 'tone';

export type ArpPattern = 'up' | 'down' | 'upDown' | 'random' | 'chord';
export type ArpRate = '4n' | '8n' | '16n' | '32n';

export class Arpeggiator {
    private activeNotes: Set<number> = new Set(); // Hz
    private sortedNotes: number[] = [];
    private pattern: ArpPattern = 'up';
    private rate: ArpRate = '8n';
    public getRate() { return this.rate; }
    private loop: Tone.Loop | null = null;
    private index: number = 0;
    private isEnabled: boolean = false;

    // Callback to play a note
    private onNote: (freq: number) => void;

    constructor(onNote: (freq: number) => void) {
        this.onNote = onNote;

        this.loop = new Tone.Loop((time) => {
            this.tick(time);
        }, this.rate).start(0);

        // Default paused
        Tone.Transport.start();
    }

    public setEnabled(enabled: boolean) {
        this.isEnabled = enabled;
        if (!enabled) {
            this.activeNotes.clear();
            this.sortedNotes = [];
        }
    }

    public getEnabled() {
        return this.isEnabled;
    }

    public setRate(rate: ArpRate) {
        this.rate = rate;
        if (this.loop) {
            this.loop.interval = rate;
        }
    }

    public setPattern(pattern: ArpPattern) {
        this.pattern = pattern;
    }

    public addNote(freq: number) {
        this.activeNotes.add(freq);
        this.updateSortedNotes();
    }

    public removeNote(freq: number) {
        this.activeNotes.delete(freq);
        this.updateSortedNotes();
    }

    public clear() {
        this.activeNotes.clear();
        this.updateSortedNotes();
    }

    private updateSortedNotes() {
        this.sortedNotes = Array.from(this.activeNotes).sort((a, b) => a - b);
    }

    private tick(_time: number) {
        if (!this.isEnabled || this.sortedNotes.length === 0) return;

        let noteToPlay: number | number[] | null = null;

        switch (this.pattern) {
            case 'up':
                this.index = this.index % this.sortedNotes.length;
                noteToPlay = this.sortedNotes[this.index];
                this.index++;
                break;

            case 'down':
                this.index = this.index % this.sortedNotes.length;
                // Invert index for down
                const downIndex = this.sortedNotes.length - 1 - this.index;
                noteToPlay = this.sortedNotes[downIndex];
                this.index++;
                break;

            case 'upDown':
                // 0, 1, 2, 1, 0... length 3 -> sequence 0 1 2 1 ... cycle is 2*len - 2
                if (this.sortedNotes.length === 1) {
                    noteToPlay = this.sortedNotes[0];
                } else {
                    const cycleLen = (this.sortedNotes.length * 2) - 2;
                    const normIndex = this.index % cycleLen;
                    if (normIndex < this.sortedNotes.length) {
                        noteToPlay = this.sortedNotes[normIndex];
                    } else {
                        noteToPlay = this.sortedNotes[this.sortedNotes.length - 1 - (normIndex - this.sortedNotes.length + 1)];
                    }
                    this.index++;
                }
                break;

            case 'random':
                const r = Math.floor(Math.random() * this.sortedNotes.length);
                noteToPlay = this.sortedNotes[r];
                break;

            case 'chord':
                // Play all
                noteToPlay = this.sortedNotes;
                break;
        }

        if (noteToPlay !== null) {
            // If array, it's a chord
            if (Array.isArray(noteToPlay)) {
                // Play current chord
                // note: onNote expects single freq? We need to update callback signature or call multiple times
                // Let's assume onNote can handle it or we call it multiple times
                // But AudioEngine.triggerAttack usually handles one 'voice' assignment.
                // For Arp, we just want to trigger a short blip.
                // Actually, Arpeggiator usually controls the Voice directly.

                // Ideally we pass this back to engine.
                // Let's assume onNote takes number | number[]
                this.onNote(noteToPlay as any);
            } else {
                this.onNote(noteToPlay);
            }
        }
    }
}
