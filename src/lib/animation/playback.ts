import { get, writable } from 'svelte/store';
import {
  animPhase,
  animPreview,
  currentPage,
  currentPageId,
  isPlaying,
  playbackElements
} from '$lib/stores/workspace';
import { boundaries, sampleAt, totalSeconds } from './timeline';

const NS = 'http://www.w3.org/2000/svg';

/** Seconds on the transport clock. The scrubber reads this, including while paused. */
export const transportClock = writable(0);

let clock: SVGSVGElement | null = null;
let raf = 0;
let rate = 1;
let lastStamp = 0;

function ensureClock(): SVGSVGElement {
  if (clock && clock.isConnected && clock.querySelector('animate')) return clock;
  document.getElementById('fct-anim-clock')?.remove();
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('id', 'fct-anim-clock');
  svg.setAttribute('width', '8');
  svg.setAttribute('height', '8');
  svg.style.position = 'absolute';
  svg.style.left = '-9999px';
  svg.style.pointerEvents = 'none';
  // A timed element is required: without one, Chrome ignores setCurrentTime
  // and getCurrentTime reports wall-clock time since the node was inserted.
  const rect = document.createElementNS(NS, 'rect');
  const anim = document.createElementNS(NS, 'animate');
  anim.setAttribute('attributeName', 'opacity');
  anim.setAttribute('from', '1');
  anim.setAttribute('to', '1');
  anim.setAttribute('dur', '36000s');
  anim.setAttribute('begin', '0s');
  anim.setAttribute('fill', 'freeze');
  rect.appendChild(anim);
  svg.appendChild(rect);
  document.body.appendChild(svg);
  svg.pauseAnimations();
  svg.setCurrentTime(0);
  clock = svg;
  return svg;
}

function publish(time: number) {
  const frames = get(currentPage)?.frames ?? [];
  const dur = totalSeconds(frames);
  const t = Math.max(0, Math.min(time, dur || 0));
  const sample = sampleAt(frames, t);
  playbackElements.set(sample.elements);
  animPhase.set(sample.phase);
  animPreview.set(frames.length >= 2);
  transportClock.set(t);
}

export function transportDuration(): number {
  return totalSeconds(get(currentPage)?.frames ?? []);
}

export function transportTime(): number {
  return clock?.getCurrentTime() ?? 0;
}

export function setSpeed(value: number) {
  rate = Number(value) || 1;
}

export function seek(time: number) {
  const svg = ensureClock();
  const frames = get(currentPage)?.frames ?? [];
  const dur = totalSeconds(frames);
  const t = Math.max(0, Math.min(time, dur || 0));
  svg.setCurrentTime(t);
  publish(t);
}

export function pauseTransport() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  clock?.pauseAnimations();
  isPlaying.set(false);
  if (clock) publish(clock.getCurrentTime());
}

export function clearTransport() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  clock?.pauseAnimations();
  clock?.setCurrentTime(0);
  isPlaying.set(false);
  animPreview.set(false);
  animPhase.set('');
  playbackElements.set([]);
  transportClock.set(0);
}

function tick(now: number) {
  const svg = ensureClock();
  const dur = transportDuration();
  let t = svg.getCurrentTime();
  if (rate !== 1) {
    const dt = lastStamp ? (now - lastStamp) / 1000 : 0;
    lastStamp = now;
    t = Math.min(dur, t + dt * rate);
    svg.setCurrentTime(t);
  } else {
    t = svg.getCurrentTime();
  }
  publish(t);
  if (t >= dur - 0.01) {
    svg.pauseAnimations();
    isPlaying.set(false);
    raf = 0;
    return;
  }
  raf = requestAnimationFrame(tick);
}

export function playTransport() {
  const frames = get(currentPage)?.frames ?? [];
  if (frames.length < 2) return;
  const svg = ensureClock();
  const dur = totalSeconds(frames);
  if (svg.getCurrentTime() >= dur - 0.02) svg.setCurrentTime(0);
  isPlaying.set(true);
  if (rate === 1) svg.unpauseAnimations();
  else svg.pauseAnimations();
  lastStamp = 0;
  if (raf) cancelAnimationFrame(raf);
  raf = requestAnimationFrame(tick);
}

export function toggleTransport() {
  if (get(isPlaying)) pauseTransport();
  else playTransport();
}

export function stepTransport(dir: 1 | -1) {
  const frames = get(currentPage)?.frames ?? [];
  if (frames.length < 2) return;
  pauseTransport();
  const svg = ensureClock();
  const cuts = boundaries(frames);
  const t = svg.getCurrentTime();
  const eps = 0.04;
  if (dir > 0) {
    const next = cuts.find(c => c > t + eps);
    seek(next ?? cuts[cuts.length - 1]);
  } else {
    const prev = [...cuts].reverse().find(c => c < t - eps);
    seek(prev ?? 0);
  }
}

export function restartTransport() {
  pauseTransport();
  seek(0);
}

let boundPageId = '';
currentPageId.subscribe(id => {
  if (id === boundPageId) return;
  const initial = boundPageId === '';
  boundPageId = id;
  if (!initial) clearTransport();
});
