"use client";

import { useEffect, useState } from "react";

export type BgmTrack = "lobby" | "battle" | "none";

const BGM_SOURCES: Record<Exclude<BgmTrack, "none">, string> = {
  lobby: "/audio/bgm-lobby.mp3",
  battle: "/audio/bgm-battle.mp3",
};

class SoundEffects {
  private ctx: AudioContext | null = null;
  private bgmAudio: HTMLAudioElement | null = null;
  private currentTrack: BgmTrack = "none";
  private unlockBound = false;
  public muted = false;

  private getContext(): AudioContext | null {
    if (this.muted || typeof window === "undefined") return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => undefined);
    }
    return this.ctx;
  }

  private bindAutoplayUnlock(): void {
    if (this.unlockBound || typeof window === "undefined") return;
    this.unlockBound = true;
    const resumeAudio = () => {
      if (!this.muted && this.currentTrack !== "none" && this.bgmAudio && this.bgmAudio.paused) {
        this.bgmAudio.play().catch(() => undefined);
      }
      window.removeEventListener("pointerdown", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
      this.unlockBound = false;
    };
    window.addEventListener("pointerdown", resumeAudio, { once: true });
    window.addEventListener("keydown", resumeAudio, { once: true });
  }

  setBgm(track: BgmTrack): void {
    if (typeof window === "undefined") return;
    if (this.currentTrack === track && this.bgmAudio) {
      if (!this.muted && track !== "none" && this.bgmAudio.paused) {
        this.bgmAudio.play().catch(() => this.bindAutoplayUnlock());
      }
      return;
    }

    this.currentTrack = track;

    if (this.bgmAudio) {
      this.bgmAudio.pause();
      this.bgmAudio.currentTime = 0;
    }

    if (track === "none") {
      this.bgmAudio = null;
      return;
    }

    const src = BGM_SOURCES[track];
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = track === "lobby" ? 0.35 : 0.4;
    audio.muted = this.muted;
    this.bgmAudio = audio;

    if (!this.muted) {
      audio.play().catch(() => {
        this.bindAutoplayUnlock();
      });
    }
  }

  setMuted(nextMuted: boolean): void {
    this.muted = nextMuted;
    if (this.bgmAudio) {
      this.bgmAudio.muted = nextMuted;
      if (!nextMuted && this.currentTrack !== "none" && this.bgmAudio.paused) {
        this.bgmAudio.play().catch(() => this.bindAutoplayUnlock());
      } else if (nextMuted && !this.bgmAudio.paused) {
        this.bgmAudio.pause();
      }
    }
  }

  playCountdown(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(620, ctx.currentTime);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.11);
  }

  playCardRaise(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(340, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(580, ctx.currentTime + 0.09);
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  }

  playCorrect(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      const start = ctx.currentTime + idx * 0.07;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  }

  playWrong(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(130, ctx.currentTime + 0.25);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);
  }

  playVictory(): void {
    const ctx = this.getContext();
    if (!ctx) return;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      const start = ctx.currentTime + idx * 0.1;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  }
}

export const sfx = new SoundEffects();

export function useRoomBgm(status?: "lobby" | "running" | "finished") {
  const [muted, setMutedState] = useState(() => sfx.muted);

  useEffect(() => {
    if (!status) return;
    if (status === "lobby") {
      sfx.setBgm("lobby");
    } else if (status === "running") {
      sfx.setBgm("battle");
    } else {
      sfx.setBgm("lobby");
    }
  }, [status]);

  useEffect(() => {
    return () => {
      sfx.setBgm("none");
    };
  }, []);

  function toggleMute() {
    const next = !muted;
    setMutedState(next);
    sfx.setMuted(next);
  }

  return { muted, toggleMute };
}
