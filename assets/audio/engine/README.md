# Engine recordings

Drop seamless engine **loops** here and list them in `manifest.json`. The game
crossfades the two loops nearest the current RPM and pitches each one by
`rpm / recordedRpm`. With no layers listed it uses the synthesised engine.

```json
{
  "layers": [
    { "file": "idle.wav", "rpm": 900 },
    { "file": "low.wav", "rpm": 2500 },
    { "file": "mid.wav", "rpm": 4500 },
    { "file": "high.wav", "rpm": 6500 }
  ],
  "gain": 1
}
```

Requirements:

- **Licence: CC0 / public domain only**, approved before bundling. Record the
  source URL, author and licence for every file in `CREDITS.md` below.
- Format: **WAV, mono, 22–44 kHz, 16-bit** (gapless looping on every browser;
  MP3/AAC add encoder padding that clicks at the loop point).
- 1–3 s each, steady RPM, trimmed at zero crossings so the loop is seamless.
- Optional `loopStart` / `loopEnd` (seconds) per layer.
