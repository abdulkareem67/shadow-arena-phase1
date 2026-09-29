// Procedurally generated ambient background music via the Web Audio API.
// No external or licensed audio files are used, consistent with this
// project's "no external/copyrighted assets" rule for visuals (see
// BootScene's procedural textures) — everything here is synthesized at
// runtime: a slow detuned drone plus sparse random notes in a minor scale.

const ROOT_HZ = 110; // A2
const SCALE_SEMITONES = [0, 2, 3, 5, 7, 8, 10]; // A natural minor

function noteHz(semitonesFromRoot: number): number {
  return ROOT_HZ * Math.pow(2, semitonesFromRoot / 12);
}

export class MusicEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private droneGain: GainNode | null = null;
  private isRunning = false;
  private muted = false;
  private timeouts: number[] = [];
  private droneOscillators: OscillatorNode[] = [];

  async start(): Promise<void> {
    if (this.isRunning) return;
    const AudioContextCtor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    const ctx = new AudioContextCtor();
    if (ctx.state === 'suspended') {
      await ctx.resume().catch(() => undefined);
    }

    this.ctx = ctx;
    this.isRunning = true;

    this.master = ctx.createGain();
    this.master.gain.setValueAtTime(0, ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(this.muted ? 0 : 0.16, ctx.currentTime + 4);
    this.master.connect(ctx.destination);

    this.startDrone();
    this.scheduleArpeggio();
  }

  stop(): void {
    if (!this.isRunning || !this.ctx) return;
    this.isRunning = false;
    this.timeouts.forEach((id) => window.clearTimeout(id));
    this.timeouts = [];

    const ctx = this.ctx;
    if (this.master) {
      this.master.gain.cancelScheduledValues(ctx.currentTime);
      this.master.gain.setValueAtTime(this.master.gain.value, ctx.currentTime);
      this.master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.8);
    }
    this.droneOscillators.forEach((osc) => {
      try {
        osc.stop(ctx.currentTime + 1);
      } catch {
        // already stopped — fine to ignore
      }
    });
    this.droneOscillators = [];

    window.setTimeout(() => ctx.close().catch(() => undefined), 1000);
    this.ctx = null;
    this.master = null;
    this.droneGain = null;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.ctx || !this.master) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.setValueAtTime(this.master.gain.value, this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(muted ? 0 : 0.16, this.ctx.currentTime + 0.5);
  }

  private startDrone(): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    this.droneGain = ctx.createGain();
    this.droneGain.gain.value = 1;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    filter.Q.value = 0.7;

    this.droneGain.connect(filter);
    filter.connect(master);

    // Slow filter sweep so the drone breathes instead of sitting static.
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.04;
    lfoGain.gain.value = 350;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    this.droneOscillators.push(lfo);

    // Root + fifth + a sub-octave root for weight, each a touch detuned
    // against the others so the chord shimmers rather than sounding flat.
    const intervals: [number, OscillatorType][] = [
      [0, 'sawtooth'],
      [7, 'sawtooth'],
      [-12, 'sine'],
    ];
    intervals.forEach(([semitones, type], i) => {
      const osc = ctx.createOscillator();
      osc.type = type;
      osc.frequency.value = noteHz(semitones);
      osc.detune.value = (i - 1) * 6;

      const voiceGain = ctx.createGain();
      voiceGain.gain.value = type === 'sine' ? 0.5 : 0.18;

      osc.connect(voiceGain);
      voiceGain.connect(this.droneGain as GainNode);
      osc.start();
      this.droneOscillators.push(osc);
    });
  }

  private scheduleArpeggio(): void {
    const playNote = () => {
      if (!this.isRunning || !this.ctx || !this.master) return;
      const ctx = this.ctx;
      const master = this.master;

      const semitone = SCALE_SEMITONES[Math.floor(Math.random() * SCALE_SEMITONES.length)] + 12;
      const freq = noteHz(semitone);

      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;

      const gain = ctx.createGain();
      const now = ctx.currentTime;
      const peak = 0.05 + Math.random() * 0.04;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.2);

      const panNode = ctx.createStereoPanner();
      panNode.pan.value = Math.random() * 1.4 - 0.7;

      osc.connect(gain);
      gain.connect(panNode);
      panNode.connect(master);

      osc.start(now);
      osc.stop(now + 2.3);

      const nextDelay = 2200 + Math.random() * 3200;
      this.timeouts.push(window.setTimeout(playNote, nextDelay));
    };

    this.timeouts.push(window.setTimeout(playNote, 2500));
  }
}
