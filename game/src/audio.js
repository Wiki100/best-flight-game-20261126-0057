// Sound, made in the browser with WebAudio: no audio files, nothing fetched.
// An engine hum that follows the throttle, wind that rises with speed, a
// chime when a ring is passed and a thud on a crash. Starts only after the
// player presses a key or clicks, as browsers require.

export function createAudio() {
  let context = null;
  let engine = null;
  let engineGain = null;
  let wind = null;
  let windGain = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (started) return;
    started = true;
    try {
      const AudioContext = window.AudioContext ?? window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      engine = context.createOscillator();
      engine.type = 'sawtooth';
      engine.frequency.value = 55;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 320;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      engine.connect(engineFilter).connect(engineGain).connect(context.destination);
      engine.start();
      const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
      wind = context.createBufferSource();
      wind.buffer = buffer;
      wind.loop = true;
      const windFilter = context.createBiquadFilter();
      windFilter.type = 'bandpass';
      windFilter.frequency.value = 700;
      windGain = context.createGain();
      windGain.gain.value = 0;
      wind.connect(windFilter).connect(windGain).connect(context.destination);
      wind.start();
    } catch {
      context = null;
    }
  }

  function tone(freq, when, duration, type, volume) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(volume, when + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, when + duration);
    osc.connect(gain).connect(context.destination);
    osc.start(when);
    osc.stop(when + duration + 0.05);
  }

  return {
    start() {
      ensure();
      if (context && context.state === 'suspended') context.resume().catch(() => {});
    },
    /** Called every frame while flying: throttle 0..1, speed m/s. */
    update(throttle, speed, flying) {
      if (!context || muted) return;
      const t = context.currentTime;
      if (engineGain) {
        engineGain.gain.setTargetAtTime(flying ? 0.045 + throttle * 0.05 : 0, t, 0.1);
        engine.frequency.setTargetAtTime(48 + throttle * 46 + speed * 0.12, t, 0.1);
      }
      if (windGain) windGain.gain.setTargetAtTime(flying ? Math.min(0.09, speed * 0.0009) : 0, t, 0.15);
    },
    ring() {
      if (!context || muted) return;
      const t = context.currentTime;
      tone(880, t, 0.35, 'sine', 0.18);
      tone(1318, t + 0.09, 0.4, 'sine', 0.14);
    },
    win() {
      if (!context || muted) return;
      const t = context.currentTime;
      [523, 659, 784, 1046].forEach((freq, i) => tone(freq, t + i * 0.12, 0.5, 'triangle', 0.16));
    },
    crash() {
      if (!context || muted) return;
      const t = context.currentTime;
      tone(70, t, 0.5, 'sine', 0.3);
      tone(45, t + 0.08, 0.6, 'triangle', 0.22);
    },
    toggleMute() {
      muted = !muted;
      if (context && engineGain) engineGain.gain.value = 0;
      if (context && windGain) windGain.gain.value = 0;
      return muted;
    },
  };
}
