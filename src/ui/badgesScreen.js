// Badges screen (every achievement with its progress) and the "badge
// earned" pop-ups, which can appear over any screen.

import { ACHIEVEMENTS } from '../data/achievements.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => (Number.isInteger(n) ? n.toLocaleString() : n.toFixed(1));

export class BadgesScreen {
  constructor({ achievements, onBack, click }) {
    Object.assign(this, { achievements, onBack, click });
    this.root = $('screen-badges');
    this.pops = $('badge-pops');
    $('badges-back').addEventListener('click', () => {
      click();
      onBack();
    });
  }

  open() {
    this.render();
    this.root.hidden = false;
  }

  close() {
    this.root.hidden = true;
  }

  get label() {
    return `${this.achievements.count} / ${ACHIEVEMENTS.length}`;
  }

  render() {
    const A = this.achievements;
    $('badges-count').textContent = `🏅 ${this.label}`;
    const grid = $('badge-grid');
    grid.textContent = '';
    // Earned first, then the closest to being earned.
    const list = ACHIEVEMENTS.map((a, i) => ({ a, i, got: A.earned(a.id), p: A.progress(a) })).sort((x, y) => y.got - x.got || y.p - x.p || x.i - y.i);
    for (const { a, got, p } of list) {
      const card = document.createElement('div');
      card.className = got ? 'badge-card earned' : 'badge-card';
      card.innerHTML = `<span class="badge-icon"></span><div><h3></h3><p></p><div class="badge-bar"><i></i></div><small></small></div>`;
      card.querySelector('.badge-icon').textContent = a.icon;
      card.querySelector('h3').textContent = a.name;
      card.querySelector('p').textContent = a.desc;
      card.querySelector('.badge-bar i').style.width = `${Math.round(p * 100)}%`;
      card.querySelector('small').textContent = got ? `Earned! ★${a.reward.toLocaleString()}` : a.goal > 1 ? `${fmt(Math.min(a.goal, Math.floor(A.stat(a.stat) * 10) / 10))} / ${fmt(a.goal)} · ★${a.reward.toLocaleString()}` : `★${a.reward.toLocaleString()}`;
      grid.append(card);
    }
  }

  /**
   * Celebrate a newly earned badge: a pop-up, or a chip inside `inline`
   * (the results panel) so nothing covers the medal.
   */
  pop(a) {
    if (this.inline) {
      const chip = document.createElement('span');
      chip.className = 'badge-chip';
      chip.textContent = `${a.icon} +★${a.reward.toLocaleString()}`;
      chip.title = a.name;
      this.inline.append(chip);
      return;
    }
    while (this.pops.children.length >= 3) this.pops.firstChild.remove();
    const el = document.createElement('div');
    el.className = 'badge-pop';
    el.innerHTML = `<span class="badge-icon"></span><div><small>Badge earned!</small><b></b><em></em></div>`;
    el.querySelector('.badge-icon').textContent = a.icon;
    el.querySelector('b').textContent = a.name;
    el.querySelector('em').textContent = `+★${a.reward.toLocaleString()}`;
    el.addEventListener('animationend', (e) => e.animationName === 'badge-out' && el.remove());
    this.pops.append(el);
  }
}
