# Engine recordings

Drop seamless engine **loops** here (one folder per engine profile) and list
them in `manifest.json`. The game crossfades the two loops nearest the current
RPM and pitches each one by `rpm / recordedRpm`. A profile with no entry uses
the synthesised engine.

Profiles (see `src/audio/engine.js`): `i4` (hatch), `flat6` (sports), `v8`
(muscle), `v10` (race), `v6` (jeep, SUV), `v8truck` (pickup), `monster`,
`diesel` (cargo truck).

```json
{
  "profiles": {
    "v8": {
      "layers": [
        { "file": "v8/idle.wav", "rpm": 750 },
        { "file": "v8/low.wav", "rpm": 2500 },
        { "file": "v8/mid.wav", "rpm": 4500 },
        { "file": "v8/high.wav", "rpm": 6500 }
      ],
      "gain": 1
    }
  }
}
```

Requirements:

- **Licence: CC0 / public domain only**, approved before bundling. Record the
  source URL, author and licence for every file in `CREDITS.md` below.
- Format: **WAV, mono, 22–44 kHz, 16-bit** (gapless looping on every browser;
  MP3/AAC add encoder padding that clicks at the loop point).
- 1–3 s each, steady RPM, trimmed at zero crossings so the loop is seamless.
- Optional `loopStart` / `loopEnd` (seconds) per layer.
