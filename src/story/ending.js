import { mem } from './memory.js';
import { L } from './script.js';

/**
 * The closing card's 7 lines, chosen from memory (DESIGN R3.9): street (panel), Sami (teachFirst),
 * one job (board > wheel > shutter, else the door grey), radio, then the three fixed lines.
 * Pure: falls back to E.lines when E.cards is missing.
 */
export function endingLines(m = mem, E = L.ending) {
  const c = E?.cards;
  if (!c) return [...(E?.lines || [])];
  const j = m.jobs || {};
  return [
    c.street[m.panel] ?? c.street.plain,
    m.teachFirst === false ? c.sami.second : c.sami.first,
    j.board ? c.job.board : j.wheel ? c.job.wheel : j.shutter ? c.job.shutter : m.grey?.assisted ? c.grey.odile : c.grey.own,
    j.radio ? c.radio.fixed : c.radio.one,
    c.ask, c.runs, c.watch,
  ];
}
