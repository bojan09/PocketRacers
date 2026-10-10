// AudioWorklet that plays the engine voice (engineSynth.js) off the main
// thread. Parameters: rpm, throttle, gain, rpmFrac (smoothed by the game).
// Messages: { profile, variant } to change engine.

import { EngineVoice } from './engineSynth.js';

class EngineProcessor extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'rpm', defaultValue: 900, minValue: 0, maxValue: 20000, automationRate: 'k-rate' },
      { name: 'throttle', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'gain', defaultValue: 0, minValue: 0, maxValue: 2, automationRate: 'k-rate' },
      { name: 'rpmFrac', defaultValue: 0, minValue: 0, maxValue: 1.2, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.voice = new EngineVoice(sampleRate, 12345);
    this.port.onmessage = (e) => this.voice.setProfile(e.data.profile, e.data.variant);
  }

  process(inputs, outputs, p) {
    const out = outputs[0][0];
    if (out) this.voice.render(out, p.rpm[0], p.throttle[0], p.gain[0], Math.min(1, p.rpmFrac[0]));
    return true;
  }
}

registerProcessor('pocket-engine', EngineProcessor);
