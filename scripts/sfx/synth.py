#!/usr/bin/env python3
"""Synthesise the R4 sounds that are simplest (and most exact) to build from first principles: the clue
sound, bubbles, buzzes, haptics, phone chimes and small mechanical clicks.

    .cache/sfx/venv/bin/python -I scripts/sfx/synth.py --dl .cache/sfx/dl [--force]

Writes float WAVs (48 kHz mono) to <dl>/synth/<name>_NN.wav (one-shot variants) or <dl>/synth/<name>.wav (loops),
which scripts/sfx/recipes.json builds like any other source (pack "synth"). Everything is computed here from
seeded noise, damped sinusoids and filters: no third-party audio, so the output is the project's own work (CC0,
like the rest of the code). build.py calls ensure() before building, so a fresh checkout makes these without
any download; the files are rewritten only when SYNTH_VERSION changes or one is missing.

Loops are rendered circularly (every resonance tail wraps around), then the head is appended once more, so
build.py's loop crossfade blends identical material and the loop has no seam.
"""
import json
import os
import sys

import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt

SR = 48000
SYNTH_VERSION = 1


# ------------------------------------------------------------------ building blocks

def t_axis(dur):
    return np.arange(int(round(dur * SR))) / SR


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo / (SR / 2), hi / (SR / 2)], btype="band", output="sos"), x)


def lp(x, f, order=2):
    return sosfilt(butter(order, f / (SR / 2), output="sos"), x)


def hp(x, f, order=2):
    return sosfilt(butter(order, f / (SR / 2), btype="high", output="sos"), x)


def modes(dur, spec, rng, t0=0.0):
    """Sum of damped sinusoids [(freq, amp, tau_seconds)] struck at t0: the ring of a small metal part."""
    t = t_axis(dur) - t0
    on = t >= 0
    y = np.zeros_like(t)
    for f, a, tau in spec:
        ph = rng.uniform(0, 2 * np.pi)
        y += on * a * np.exp(-np.maximum(t, 0) / tau) * np.sin(2 * np.pi * f * np.maximum(t, 0) + ph)
    return y


def burst(dur, t0, length, lo, hi, rng, shape=2.0):
    """A short band-passed noise burst (the contact of a strike) starting at t0."""
    n = len(t_axis(dur))
    y = np.zeros(n)
    i0, L = int(t0 * SR), max(8, int(length * SR))
    if i0 >= n:
        return y
    L = min(L, n - i0)
    e = np.exp(-np.linspace(0, 1, L) * shape * 3) * np.minimum(1, np.linspace(0, 1, L) * L / 24)
    seg = rng.standard_normal(L + 256)
    seg = bp(seg, lo, min(hi, SR / 2 - 200))[256:]
    y[i0 : i0 + L] = seg * e
    return y


def env_ar(t, a, d, start, length):
    """Attack-release gate: 0 before start, rises in a, holds, falls in d at start + length."""
    x = t - start
    up = np.clip(x / max(a, 1e-4), 0, 1)
    down = np.clip((length - x) / max(d, 1e-4), 0, 1)
    return np.where((x >= 0) & (x <= length), np.minimum(up, down), 0.0)


def floor_noise(n, rng, db=-72):
    return rng.standard_normal(n) * 10 ** (db / 20)


def peak_norm(y, peak=0.5):
    m = np.abs(y).max()
    return y * (peak / m) if m > 0 else y


def circular(y_lin, L):
    """Fold a linear render of length > L back onto L samples (tails wrap round: a seamless loop body)."""
    out = np.zeros(L)
    for i in range(0, len(y_lin), L):
        seg = y_lin[i : i + L]
        out[: len(seg)] += seg
    return out


def circ_filter(fn, x, pre=0.5):
    """Filter a loop body as if it had always been looping (the filter state wraps round)."""
    P = min(len(x), int(pre * SR))
    return fn(np.concatenate([x[-P:], x]))[P:]


def loop_file(body, extra):
    """Loop body + its own head again (build.py's `loop` mode reads dur + xfade seconds)."""
    n = int(extra * SR)
    return np.concatenate([body, np.tile(body, n // len(body) + 1)[:n]])


# ------------------------------------------------------------------ the sounds

def pawl_click(v):
    """The clue sound (SCRIPT-R4 §4): a dry ratchet tick centred at 2.4 kHz, ~25 ms, and a softer second tick
    12 ms later (the pawl falling off the next tooth). One click per wheel turn."""
    rng = np.random.default_rng(5200 + v)
    dur = 0.15
    f0 = 2400 * (1 + rng.uniform(-0.035, 0.035))
    gap = 0.012 * (1 + rng.uniform(-0.15, 0.15))
    second = rng.uniform(0.32, 0.5)
    def tick(t0, g, fs):
        f = f0 * fs
        y = modes(dur, [(f, 1.0, 0.0034), (f * 1.53, 0.5, 0.0024), (f * 2.41, 0.32, 0.0015), (f * 0.57, 0.28, 0.0046)], rng, t0)
        y += 0.7 * burst(dur, t0, 0.0012, 1500, 9000, rng)       # the tooth's contact
        y += modes(dur, [(390 * fs, 0.1, 0.006)], rng, t0)         # a little hub body under it
        return g * y
    y = tick(0.004, 1.0, 1.0) + tick(0.004 + gap, second, 1.0 + rng.uniform(0.01, 0.05))
    y = hp(y, 300)
    return peak_norm(y + floor_noise(len(y), rng))


def bubble_one(t, t0, r_mm, amp, rng):
    """One Minnaert bubble (f = 3.26 m Hz / r), damped (van den Doel), its pitch rising as it nears the top."""
    f0 = 3260.0 / r_mm
    d = 0.043 * f0 + 0.0014 * f0 ** 1.5
    x = np.maximum(t - t0, 0)
    f = f0 * (1 + 0.1 * d * x)
    ph = 2 * np.pi * np.cumsum(f) / SR
    on = (t >= t0).astype(float)
    a = np.minimum(1, x / 0.0008)
    return on * amp * a * np.exp(-d * x) * np.sin(ph - ph[min(int(t0 * SR), len(ph) - 1)])


def bubble(v):
    """A single bubble (PUNCTURE: one per bubble the game draws; the game's size picks the rate)."""
    rng = np.random.default_rng(6100 + v)
    dur = 0.16
    t = t_axis(dur)
    r = [1.3, 1.6, 1.9, 2.2, 2.6, 3.0, 1.45, 2.4][v - 1]
    y = bubble_one(t, 0.004, r, 1.0, rng)
    y += 0.06 * burst(dur, 0.004 + rng.uniform(0.03, 0.05), 0.003, 2500, 9000, rng)  # it breaks the surface
    return peak_norm(lp(y, 9000) + floor_noise(len(y), rng))


def bubble_chain(v):
    """« Le petit chapelet » (SCRIPT-R4 §6.5.2): a thin chain of small bubbles from the hole."""
    rng = np.random.default_rng(6200 + v)
    n = [6, 9, 12, 8][v - 1]
    times = np.cumsum(rng.gamma(3.0, 0.024, n))
    times = times - times[0] + 0.004
    dur = times[-1] + 0.12
    t = t_axis(dur)
    y = np.zeros_like(t)
    for i, t0 in enumerate(times):
        y += bubble_one(t, t0, rng.uniform(0.9, 2.1), rng.uniform(0.45, 1.0), rng)
        if rng.random() < 0.5:
            y += 0.05 * burst(dur, t0 + rng.uniform(0.02, 0.05), 0.003, 2500, 9000, rng)
    stir = lp(rng.standard_normal(len(t)), 500) * 0.004  # the water moving a little
    return peak_norm(lp(y, 9000) + stir)


def tattoo_machine():
    """A coil tattoo machine (ENCRE FINE): the armature hammering ~118 times a second, each stroke ringing the
    frame and sparking the contact screw, over the coils' hum. Rendered as a seamless 10 s loop."""
    rng = np.random.default_rng(7300)
    L = int(10 * SR)
    t = np.arange(L) / SR
    # periodic speed drift (whole cycles per loop), so the loop wraps cleanly
    f = 118 * (1 + 0.012 * np.sin(2 * np.pi * 0.2 * t) + 0.005 * np.sin(2 * np.pi * 1.3 * t + 1.1))
    ph = np.cumsum(f) / SR
    ph *= np.round(ph[-1]) / ph[-1]  # an integer number of strokes per loop
    strokes = np.flatnonzero(np.diff(np.floor(ph)) > 0) + 1
    imp = np.zeros(L)
    imp[strokes] = rng.uniform(0.75, 1.0, len(strokes)) * (1 + 0.15 * np.sin(2 * np.pi * 0.7 * t[strokes]))
    ir_len = int(0.012 * SR)
    ir = modes(0.012, [(1870, 1.0, 0.0018), (3280, 0.6, 0.0013), (5150, 0.35, 0.0008), (790, 0.5, 0.003)], rng)
    ir += 0.4 * burst(0.012, 0.0, 0.0004, 4000, 14000, rng)
    hits = np.real(np.fft.ifft(np.fft.fft(imp) * np.fft.fft(np.concatenate([ir, np.zeros(L - ir_len)]))))  # circular
    hum = circ_filter(lambda z: lp(z, 1400), np.tanh(3.0 * np.sin(2 * np.pi * ph)) * 0.22)
    y = circ_filter(lambda z: hp(z, 90), 0.55 * hits + hum)
    return peak_norm(y), 10.0


def neon_flicker(v):
    """CHEZ GÉRARD's neon flickering (R4 Ch2, Ch5, Ch6 Week 5): the 100 Hz transformer buzz and the tube's
    sizzle cutting out and striking back, a tick on every strike."""
    rng = np.random.default_rng(8400 + v)
    dur = [0.55, 0.8, 1.05, 0.7][v - 1]
    t = t_axis(dur)
    k = np.arange(1, 28)
    buzz = sum((1 / kk ** 0.85) * np.sin(2 * np.pi * 100 * kk * t + rng.uniform(0, 6.3)) for kk in k)
    sizzle = bp(rng.standard_normal(len(t)), 4500, 10000) * (0.4 + 0.6 * np.abs(np.sin(2 * np.pi * 50 * t))) * 2.5
    tone = 0.22 * buzz / np.abs(buzz).max() + 0.035 * sizzle / np.abs(sizzle).max()  # mostly buzz, a little hiss
    gate = np.zeros_like(t)
    y = np.zeros_like(t)
    x, on = 0.004, True
    while x < dur - 0.03:
        seg = rng.uniform(0.025, 0.14) if on else rng.uniform(0.012, 0.08)
        if on:
            gate = np.maximum(gate, env_ar(t, 0.002, 0.004, x, seg))
            y += 0.5 * burst(dur, x, 0.004, 1500, 12000, rng) + 0.35 * burst(dur, x, 0.012, 300, 3000, rng, shape=1.2)
        x += seg
        on = not on
    gate *= np.clip((dur - t) / 0.02, 0, 1)
    y += tone * gate
    return peak_norm(y + floor_noise(len(y), rng))


def motor(t, starts, lengths, f_run, rng, spin=0.04):
    """An eccentric vibration motor: spins up and down (pitch with it) for each (start, length)."""
    g = np.zeros_like(t)
    fr = np.full_like(t, f_run * 0.6)
    for s, L in zip(starts, lengths):
        e = env_ar(t, spin, spin * 1.4, s, L)
        g = np.maximum(g, e)
        fr = np.where((t >= s) & (t <= s + L), f_run * (0.6 + 0.4 * np.clip((t - s) / spin, 0, 1)), fr)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    y = np.sin(ph) + 0.45 * np.sin(2 * ph + 0.7) + 0.25 * np.sin(3 * ph + 1.9) + 0.1 * np.sin(5 * ph)
    rattle = bp(rng.standard_normal(len(t)), 900, 3200) * (0.5 + 0.5 * np.sin(ph)) * 0.35
    return (y + rattle) * g


def phone_buzz_hand(v):
    """The phone vibrating in Hugo's hand (no table to rattle on): R4 Ch6 Week 9 « the phone buzzes loudly »."""
    rng = np.random.default_rng(9100 + v)
    pat = [([0.004, 0.62], [0.4, 0.4]), ([0.004], [0.85]), ([0.004, 0.36, 0.72], [0.22, 0.22, 0.22])][v - 1]
    dur = pat[0][-1] + pat[1][-1] + 0.12
    t = t_axis(dur)
    y = motor(t, pat[0], pat[1], 168 + rng.uniform(-6, 6), rng)
    return peak_norm(lp(y, 1800) + floor_noise(len(t), rng))


def watch_haptic(v):
    """A sport watch's double haptic tap on the wrist (every STRIDE buzz), heard through the sleeve."""
    rng = np.random.default_rng(9200 + v)
    f = [172, 165, 180][v - 1]
    on = [0.085, 0.095, 0.08][v - 1]
    gap = [0.075, 0.07, 0.085][v - 1]
    dur = 0.004 + 2 * on + gap + 0.08
    t = t_axis(dur)
    y = np.zeros_like(t)
    for s in (0.004, 0.004 + on + gap):
        e = env_ar(t, 0.003, 0.018, s, on)
        y += e * (np.sin(2 * np.pi * f * (t - s)) + 0.22 * np.sin(4 * np.pi * f * (t - s)))
        y += e * bp(rng.standard_normal(len(t)), 1800, 4200) * 0.05  # the case buzzing on its strap
    return peak_norm(lp(y, 2500) + floor_noise(len(t), rng))


def watch_haptic_long(v):
    """STRIDE celebrating (« SÉANCE NOCTURNE DÉTECTÉE ! BELLE SORTIE À 3 H ! » mid-stakeout): short, short,
    long, a little higher each time; too loud for a stakeout, which is the joke."""
    rng = np.random.default_rng(9300 + v)
    seq = [(0.004, 0.09, 165), (0.17, 0.09, 172), (0.34, 0.42, 182)] if v == 1 else [(0.004, 0.08, 168), (0.15, 0.08, 168), (0.30, 0.08, 176), (0.45, 0.38, 184)]
    dur = seq[-1][0] + seq[-1][1] + 0.1
    t = t_axis(dur)
    y = np.zeros_like(t)
    for s, L, f in seq:
        e = env_ar(t, 0.003, 0.02, s, L)
        y += e * (np.sin(2 * np.pi * f * (t - s)) + 0.25 * np.sin(4 * np.pi * f * (t - s)))
        y += e * bp(rng.standard_normal(len(t)), 1800, 4200) * 0.06
    return peak_norm(lp(y, 2500) + floor_noise(len(t), rng))


def bell_note(t, t0, f, amp, decay=0.3):
    """A soft mallet note: a struck bar's partials (1, 3.93, 9.2) with fast-dying overtones."""
    x = np.maximum(t - t0, 0)
    on = (t >= t0) * np.minimum(1, x / 0.0015)
    return on * amp * (np.exp(-x / decay) * np.sin(2 * np.pi * f * x)
                       + 0.22 * np.exp(-x / (decay * 0.22)) * np.sin(2 * np.pi * f * 3.93 * x)
                       + 0.07 * np.exp(-x / (decay * 0.08)) * np.sin(2 * np.pi * f * 9.2 * x))


def phone_sms(v):
    """An SMS arriving (Jo, R4 Ch6 Week 9 boardDone): two soft mallet notes, rising a fifth."""
    rng = np.random.default_rng(9400 + v)
    dur = 0.75
    t = t_axis(dur)
    y = bell_note(t, 0.004, 880, 0.8, 0.22) + bell_note(t, 0.115, 1318.5, 1.0, 0.28)
    return peak_norm(y * np.clip((dur - t) / 0.05, 0, 1) + floor_noise(len(t), rng))


def stride_alert(v):
    """The STRIDE app's notification (« Envoyer un bravo ? »): three quick rising notes, bright and eager."""
    rng = np.random.default_rng(9500 + v)
    dur = 0.6
    t = t_axis(dur)
    y = sum(bell_note(t, 0.004 + i * 0.07, f, a, 0.16) for i, (f, a) in enumerate([(1046.5, 0.7), (1318.5, 0.8), (1568, 1.0)]))
    return peak_norm(y * np.clip((dur - t) / 0.05, 0, 1) + floor_noise(len(t), rng))


def stride_bravo(v):
    """« Bravo » sent: a small upward whoop and a pop (a thumbs-up leaving the phone)."""
    rng = np.random.default_rng(9600 + v)
    dur = 0.36
    t = t_axis(dur)
    f = 520 + 1100 * np.clip(t / 0.16, 0, 1) ** 1.6
    whoop = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_ar(t, 0.01, 0.05, 0.004, 0.16) * 0.5
    air = bp(rng.standard_normal(len(t)), 1500, 6000) * env_ar(t, 0.03, 0.06, 0.004, 0.15) * 0.18
    pop = bell_note(t, 0.17, 1975.5, 0.9, 0.09)
    return peak_norm(whoop + air + pop + floor_noise(len(t), rng))


def stopwatch_click(v):
    """Durand's wind-up stopwatch: the crown pressed (a two-stage click, the lever, then the start/stop
    mechanism) and released."""
    rng = np.random.default_rng(9700 + v)
    dur = 0.26
    f = 1 + rng.uniform(-0.04, 0.04)
    spec = [(3150 * f, 1.0, 0.0016), (4700 * f, 0.6, 0.0011), (6900 * f, 0.4, 0.0007), (980 * f, 0.35, 0.004)]
    y = modes(dur, spec, rng, 0.004) + 0.5 * burst(dur, 0.004, 0.001, 2000, 12000, rng)
    y += 0.55 * (modes(dur, [(s[0] * 1.12, s[1], s[2]) for s in spec], rng, 0.004 + 0.03 + rng.uniform(0, 0.008)))
    y += 0.3 * (modes(dur, [(s[0] * 0.93, s[1], s[2]) for s in spec], rng, 0.15 + rng.uniform(0, 0.02)))
    return peak_norm(hp(y, 400) + floor_noise(len(y), rng))


def stopwatch_tick():
    """The stopwatch running: 5 beats a second (18,000 an hour), tick and tock a hair apart in pitch. 4 s loop."""
    rng = np.random.default_rng(9800)
    L = int(4 * SR)
    y = np.zeros(L + int(0.02 * SR))
    for i in range(20):
        fs = 1.0 if i % 2 == 0 else 0.9
        t0 = i * 0.2 + 0.1  # the loop wraps half-way between two beats
        seg = modes(0.02, [(4300 * fs, 1.0, 0.0009), (6100 * fs, 0.5, 0.0006), (1250 * fs, 0.25, 0.0025)], rng)
        a = int(t0 * SR)
        y[a : a + len(seg)] += seg * (0.85 if i % 2 else 1.0)
    y = circ_filter(lambda z: hp(z, 600), circular(y, L)) + floor_noise(L, rng, -70)
    return peak_norm(y), 4.0


def air_hiss(v):
    """Air escaping: the valve's « pssht » (v1) and a slower leak from the tube (v2)."""
    rng = np.random.default_rng(9900 + v)
    dur = [0.5, 1.4][v - 1]
    t = t_axis(dur)
    e = env_ar(t, 0.012, 0.25 if v == 2 else 0.12, 0.004, dur - 0.01) * (np.exp(-t / 0.9) if v == 2 else 1)
    n = bp(rng.standard_normal(len(t)), 2600, 9000)
    whistle = 0.06 * np.sin(2 * np.pi * np.cumsum(5200 + 120 * np.sin(2 * np.pi * 7 * t)) / SR)
    return peak_norm((n + whistle) * e + floor_noise(len(t), rng))


def cork_pin(v):
    """A push pin into the cork board (R4 Ch6 DEDUCTION): the plastic head tapped, the cork's short crunch,
    the board's dull thump."""
    rng = np.random.default_rng(10000 + v)
    dur = 0.15
    f = 1 + rng.uniform(-0.06, 0.06)
    y = modes(dur, [(2800 * f, 0.6, 0.0011), (5100 * f, 0.3, 0.0007)], rng, 0.004)
    for k in range(rng.integers(3, 6)):
        y += 0.45 * burst(dur, 0.006 + k * rng.uniform(0.0015, 0.003), 0.003, 300, 2200, rng)
    y += modes(dur, [(210 * f, 0.5, 0.012)], rng, 0.005)
    return peak_norm(lp(y, 9000) + floor_noise(len(y), rng))


def stamp_thump(v):
    """The rubber stamp « RÉSOLU » coming down on the board: a padded thump, paper slap, a small lift."""
    rng = np.random.default_rng(10100 + v)
    dur = 0.32
    y = modes(dur, [(140, 1.0, 0.03), (310, 0.4, 0.015), (720, 0.15, 0.008)], rng, 0.004)
    y += 0.5 * lp(burst(dur, 0.004, 0.008, 400, 4000, rng, shape=1.5), 3500)
    y += 0.12 * burst(dur, 0.16 + rng.uniform(0, 0.03), 0.02, 600, 3000, rng, shape=1.0)  # the stamp lifts off
    return peak_norm(y + floor_noise(len(y), rng))


def shutter_glide(v):
    """Mme Benali's shutter once oiled (R4 Ch5 onward): it rolls up in one smooth go. A low rumble of the slats
    winding onto the drum (slowing as the coil grows), each slat a soft muted tick, then a padded stop: the
    anti-scream. No squeal, no rattle."""
    rng = np.random.default_rng(10200 + v)
    run = [1.6, 1.9][v - 1]
    dur = run + 0.35
    t = t_axis(dur)
    e = env_ar(t, 0.12, 0.25, 0.004, run)
    rumble = lp(bp(rng.standard_normal(len(t)), 90, 900), 700) * (1 + 0.25 * np.sin(2 * np.pi * 3.1 * t))
    y = 0.6 * rumble / np.abs(rumble).max() * e
    x, gap = 0.05, 0.055
    while x < run - 0.05:  # slat joints passing over the drum, further apart as the coil grows
        y += 0.18 * lp(burst(dur, x, 0.006, 300, 2500, rng, shape=1.5), 1800) * rng.uniform(0.6, 1.0)
        x += gap * rng.uniform(0.9, 1.1)
        gap *= 1.012
    y += 0.5 * modes(dur, [(95, 1.0, 0.04), (230, 0.4, 0.02)], rng, run)  # the padded stop at the top
    return peak_norm(y + floor_noise(len(t), rng))


def dough_roll(v):
    """CROISSANT's roll (R4 Ch5): palms rolling a dough triangle on a floured board, one stroke. Soft dark
    friction swelling and fading with the hands, a faint sticky crackle, a little flour hiss on top."""
    rng = np.random.default_rng(10300 + v)
    run = [0.75, 0.95, 1.15][v - 1]
    dur = run + 0.1
    t = t_axis(dur)
    x = np.clip((t - 0.004) / run, 0, 1)
    e = np.sin(np.pi * x) ** 1.5 * (1 + 0.3 * np.sin(2 * np.pi * rng.uniform(3, 5) * t))  # the dough turning over
    rub = lp(bp(rng.standard_normal(len(t)), 150, 2200), 1400)
    rub /= np.abs(rub).max()
    crackle = np.zeros_like(t)
    idx = rng.choice(len(t), size=int(run * 60), replace=False)
    crackle[idx] = rng.uniform(-1, 1, len(idx))
    crackle = lp(hp(crackle, 600), 3500) * 0.8
    flour = bp(rng.standard_normal(len(t)), 3000, 7000) * 0.04
    return peak_norm((0.8 * rub + crackle + flour) * e + floor_noise(len(t), rng))


# name: (variant count or None for a loop, function)
SOUNDS = {
    "pawl_click": (6, pawl_click),
    "bubble": (8, bubble),
    "bubble_chain": (4, bubble_chain),
    "tattoo_machine": (None, tattoo_machine),
    "neon_flicker": (4, neon_flicker),
    "phone_buzz_hand": (3, phone_buzz_hand),
    "watch_haptic": (3, watch_haptic),
    "watch_haptic_long": (2, watch_haptic_long),
    "phone_sms": (1, phone_sms),
    "stride_alert": (1, stride_alert),
    "stride_bravo": (1, stride_bravo),
    "stopwatch_click": (2, stopwatch_click),
    "stopwatch_tick": (None, stopwatch_tick),
    "air_hiss": (2, air_hiss),
    "cork_pin": (4, cork_pin),
    "stamp_thump": (2, stamp_thump),
    "shutter_glide": (2, shutter_glide),
    "dough_roll": (3, dough_roll),
}
LOOP_EXTRA = 1.0  # seconds of head appended after a loop body (build.py reads dur + xfade <= this)


def files_of(name):
    n, _ = SOUNDS[name]
    return [f"{name}.wav"] if n is None else [f"{name}_{i:02d}.wav" for i in range(1, n + 1)]


def ensure(dl, force=False, log=print):
    """Write <dl>/synth/*.wav when missing or SYNTH_VERSION changed. Returns the number of files written."""
    out = os.path.join(dl, "synth")
    os.makedirs(out, exist_ok=True)
    stamp = os.path.join(out, "version.json")
    try:
        old = json.load(open(stamp)).get("version")
    except Exception:
        old = None
    wrote = 0
    for name, (n, fn) in SOUNDS.items():
        files = files_of(name)
        if not force and old == SYNTH_VERSION and all(os.path.exists(os.path.join(out, f)) for f in files):
            continue
        if n is None:
            body, _ = fn()
            sf.write(os.path.join(out, files[0]), loop_file(body, LOOP_EXTRA).astype(np.float32), SR, subtype="FLOAT")
        else:
            for i, f in enumerate(files, 1):
                sf.write(os.path.join(out, f), fn(i).astype(np.float32), SR, subtype="FLOAT")
        wrote += len(files)
    json.dump({"version": SYNTH_VERSION}, open(stamp, "w"))
    if wrote:
        log(f"synth: wrote {wrote} files to {out}")
    return wrote


if __name__ == "__main__":
    a = sys.argv[1:]
    dl = a[a.index("--dl") + 1] if "--dl" in a else os.path.join(os.getcwd(), ".cache/sfx/dl")
    ensure(dl, force="--force" in a)
