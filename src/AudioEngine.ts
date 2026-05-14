export class AudioEngine {
  private context: AudioContext | null = null;
  private samples = new Map<string, AudioBuffer>();
  private masterGain: GainNode | null = null;

  async initialize(): Promise<void> {
    if (!this.context) {
      this.context = new AudioContext({ latencyHint: "interactive" });
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = 0.7;
      this.masterGain.connect(this.context.destination);
      await this.createBuiltins();
    }
    if (this.context.state !== "running") {
      await this.context.resume();
    }
  }

  registerSample(id: string, buffer: AudioBuffer): void {
    this.samples.set(id, buffer);
  }

  hasSample(id: string): boolean {
    return this.samples.has(id);
  }

  setMasterVolume(volume: number): void {
    if (!this.context || !this.masterGain) {
      return;
    }
    const clamped = Math.max(0, Math.min(1, volume));
    this.masterGain.gain.setTargetAtTime(clamped, this.context.currentTime, 0.03);
  }

  async decodeAudioFile(file: File): Promise<AudioBuffer> {
    await this.initialize();
    const data = await file.arrayBuffer();
    return await this.context!.decodeAudioData(data);
  }

  async decodeDataUrl(dataUrl: string): Promise<AudioBuffer> {
    await this.initialize();
    const response = await fetch(dataUrl);
    const arrayBuffer = await response.arrayBuffer();
    return await this.context!.decodeAudioData(arrayBuffer);
  }

  playSample(id: string, velocity = 0.8): void {
    if (!this.context || !this.masterGain) {
      return;
    }
    const buffer = this.samples.get(id);
    if (!buffer) {
      return;
    }
    const source = this.context.createBufferSource();
    source.buffer = buffer;

    const gain = this.context.createGain();
    gain.gain.value = Math.min(1, Math.max(0.05, velocity));

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start();
  }

  startHeldPreview(
    id: string,
    options?: { playbackRate?: number; volume?: number }
  ): (() => void) | null {
    if (!this.context || !this.masterGain) {
      return null;
    }
    const buffer = this.samples.get(id);
    if (!buffer) {
      return null;
    }

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = options?.playbackRate ?? 0.6;

    const gain = this.context.createGain();
    const now = this.context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(options?.volume ?? 0.85, now + 0.02);

    source.connect(gain);
    gain.connect(this.masterGain);
    source.start(now);

    let stopped = false;
    return () => {
      if (stopped || !this.context) {
        return;
      }
      stopped = true;
      const t = this.context.currentTime;
      gain.gain.cancelScheduledValues(t);
      gain.gain.setValueAtTime(gain.gain.value, t);
      gain.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      source.stop(t + 0.09);
    };
  }

  private async createBuiltins(): Promise<void> {
    if (!this.context) {
      return;
    }
    this.samples.set("kick", this.makeKick());
    this.samples.set("snare", this.makeSnare());
    this.samples.set("hihat", this.makeHiHat());
    this.samples.set("clap", this.makeClap());
    this.samples.set("tom", this.makeTom());

    this.samples.set("piano-c4", this.makePianoNote(261.63));
    this.samples.set("piano-d4", this.makePianoNote(293.66));
    this.samples.set("piano-e4", this.makePianoNote(329.63));
    this.samples.set("piano-g4", this.makePianoNote(392.0));
    this.samples.set("piano-a4", this.makePianoNote(440.0));

    this.samples.set("click", this.makeClick());

    await this.tryReplaceFromFile("kick", "/samples/kick.wav");
    await this.tryReplaceFromFile("snare", "/samples/snare.wav");
    await this.tryReplaceFromFile("hihat", "/samples/hihat.wav");
    await this.tryReplaceFromFile("clap", "/samples/clap.wav");
    await this.tryReplaceFromFile("tom", "/samples/tom.wav");
    await this.tryReplaceFromFile("piano-c4", "/samples/piano-c4.wav");
    await this.tryReplaceFromFile("piano-d4", "/samples/piano-d4.wav");
    await this.tryReplaceFromFile("piano-e4", "/samples/piano-e4.wav");
    await this.tryReplaceFromFile("piano-g4", "/samples/piano-g4.wav");
    await this.tryReplaceFromFile("piano-a4", "/samples/piano-a4.wav");
  }

  private makeKick(): AudioBuffer {
    const ctx = this.context as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 0.24;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 16);
      const freq = 150 - t * 430;
      data[i] = Math.sin(2 * Math.PI * Math.max(35, freq) * t) * env;
    }
    return buffer;
  }

  private makeSnare(): AudioBuffer {
    const ctx = this.context as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 0.2;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 24);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  }

  private makeHiHat(): AudioBuffer {
    const ctx = this.context as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 0.08;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 45);
      data[i] = (Math.random() * 2 - 1) * env;
    }
    return buffer;
  }

  private makeClap(): AudioBuffer {
    const ctx = this.context as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 0.18;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const pulse = t < 0.03 || (t > 0.045 && t < 0.075) || (t > 0.09 && t < 0.13) ? 1 : 0.3;
      const env = Math.exp(-t * 20);
      data[i] = (Math.random() * 2 - 1) * env * pulse;
    }
    return buffer;
  }

  private makeTom(): AudioBuffer {
    const ctx = this.context as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 0.28;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 13);
      const freq = 180 - t * 210;
      data[i] = Math.sin(2 * Math.PI * Math.max(70, freq) * t) * env;
    }
    return buffer;
  }

  private makePianoNote(frequency: number): AudioBuffer {
    const ctx = this.context as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 1.2;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 4.8);
      const fundamental = Math.sin(2 * Math.PI * frequency * t);
      const overtone1 = Math.sin(2 * Math.PI * frequency * 2 * t) * 0.32;
      const overtone2 = Math.sin(2 * Math.PI * frequency * 3 * t) * 0.18;
      data[i] = (fundamental + overtone1 + overtone2) * env * 0.75;
    }
    return buffer;
  }

  private makeClick(): AudioBuffer {
    const ctx = this.context as AudioContext;
    const sampleRate = ctx.sampleRate;
    const duration = 0.05;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i += 1) {
      const t = i / sampleRate;
      const env = Math.exp(-t * 55);
      data[i] = Math.sin(2 * Math.PI * 1800 * t) * env;
    }
    return buffer;
  }

  private async tryReplaceFromFile(id: string, path: string): Promise<void> {
    if (!this.context) {
      return;
    }
    try {
      const response = await fetch(path);
      if (!response.ok) {
        return;
      }
      const data = await response.arrayBuffer();
      const decoded = await this.context.decodeAudioData(data);
      this.samples.set(id, decoded);
    } catch {
      // Keep generated fallback sample.
    }
  }
}
