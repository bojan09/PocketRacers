// Developer handling-tuning panel, opened with ?tune in the URL. Edits the
// live handling object so changes are felt immediately while driving.

const RANGES = {
  maxSpeed: [6000, 18000, 100],
  accel: [2000, 10000, 100],
  brake: [5000, 25000, 500],
  steerSpeed: [1, 4, 0.05],
  steerRamp: [1, 12, 0.25],
  steerReturn: [2, 20, 0.5],
  grip: [2, 20, 0.5],
  centrifugal: [0, 0.6, 0.01],
  nitroAccel: [1, 3, 0.05],
  nitroTop: [1, 2, 0.02],
};

export function mountTuningPanel(handling) {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:absolute;z-index:9;left:8px;top:120px;background:rgba(0,0,0,.7);color:#fff;font:12px ui-monospace,monospace;padding:8px;border-radius:8px;max-height:60vh;overflow:auto;touch-action:pan-y';
  for (const [key, [min, max, step]] of Object.entries(RANGES)) {
    const row = document.createElement('label');
    row.style.cssText = 'display:block;margin:2px 0';
    const val = document.createElement('span');
    val.textContent = ` ${handling[key]}`;
    const inputEl = document.createElement('input');
    Object.assign(inputEl, { type: 'range', min, max, step, value: handling[key] });
    inputEl.style.width = '140px';
    inputEl.addEventListener('input', () => {
      handling[key] = Number(inputEl.value);
      val.textContent = ` ${handling[key]}`;
    });
    row.append(key, document.createElement('br'), inputEl, val);
    panel.append(row);
  }
  const dump = document.createElement('button');
  dump.textContent = 'Copy JSON';
  dump.addEventListener('click', () => navigator.clipboard?.writeText(JSON.stringify(handling, null, 2)));
  panel.append(dump);
  document.getElementById('app').append(panel);
}
