import { mem, joWarmth } from './memory.js';
import { L } from './script.js';

/**
 * The closing card's 9 lines, chosen from memory (DESIGN R3.9, SCRIPT-R4 §8.9), in this order:
 * street (panel), Sami (teachFirst), M. Durand, one job (board > wheel > shutter, else the door grey), radio,
 * « Demander. », Jo (warm when joWarmth() >= 3: the line over the crack; cool: the sauces), runs, watch.
 * Pure: falls back to E.lines when E.cards is missing.
 */
export function endingLines(m = mem, E = L.ending) {
  const c = E?.cards;
  if (!c) return [...(E?.lines || [])];
  const j = m.jobs || {};
  return [
    c.street[m.panel] ?? c.street.plain,
    m.teachFirst === false ? c.sami.second : c.sami.first,
    c.durand,
    j.board ? c.job.board : j.wheel ? c.job.wheel : j.shutter ? c.job.shutter : m.grey?.assisted ? c.grey.odile : c.grey.own,
    j.radio ? c.radio.fixed : c.radio.one,
    c.ask,
    joWarmth(m) >= 3 ? c.jo.warm : c.jo.cool,
    c.runs,
    c.watch,
  ];
}
