import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';

const TERMINAL_KEY = 'fw_terminal_closed';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, NgClass],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements OnInit, OnDestroy {
  readonly bootLines = signal<string[]>([]);
  readonly bootDone = signal(false);
  readonly showContent = signal(false);
  readonly terminalVisible = signal(true);

  private interval: ReturnType<typeof setInterval> | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;

  private readonly allBootLines = [
    '> SYSTEM INITIATED...',
    '> LOADING FIRMWARE WARS 28TH CYCLE...',
    '> CONNECTING TO ARENA DIGITAL...',
    '> BOTS.CFG LOADED [4 UNITS READY]',
    '> CORE COMBAT SYSTEM ONLINE',
    '> WELCOME, SENIOR PROGRAMMER.',
  ];

  ngOnInit() {
    if (sessionStorage.getItem(TERMINAL_KEY)) {
      this.terminalVisible.set(false);
      this.showContent.set(true);
      return;
    }

    let i = 0;
    this.interval = setInterval(() => {
      if (i < this.allBootLines.length) {
        this.bootLines.update(lines => [...lines, this.allBootLines[i]]);
        i++;
      } else {
        clearInterval(this.interval!);
        this.bootDone.set(true);
        this.timeout = setTimeout(() => this.showContent.set(true), 500);
      }
    }, 380);
  }

  closeTerminal() {
    sessionStorage.setItem(TERMINAL_KEY, '1');
    this.terminalVisible.set(false);
    this.showContent.set(true);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
    if (this.timeout) clearTimeout(this.timeout);
  }

  readonly bots = [
    {
      name: 'BruteBot',
      type: 'ASALTO PESADO',
      life: 22,
      energy: 16,
      attack: 4,
      armor: 3,
      move: 2,
      energyDice: '1d8',
      nameClass: 'text-red-400',
      subtitleClass: 'text-red-400/65',
      cardClass: 'border-red-500/25 hover:border-red-500/50 hover:shadow-red-500/10',
      energyBarClass: 'bg-red-400/70',
      statClass: 'text-red-300',
      lifePercent: 88,
      energyPercent: 73,
    },
    {
      name: 'HackBot',
      type: 'INFILTRACIÓN LÓGICA',
      life: 18,
      energy: 20,
      attack: 2,
      armor: 3,
      move: 3,
      energyDice: '1d6',
      nameClass: 'text-violet-400',
      subtitleClass: 'text-violet-400/65',
      cardClass: 'border-violet-500/25 hover:border-violet-500/50 hover:shadow-violet-500/10',
      energyBarClass: 'bg-violet-400/70',
      statClass: 'text-violet-300',
      lifePercent: 72,
      energyPercent: 91,
    },
    {
      name: 'ScoutBot',
      type: 'RECONOCIMIENTO',
      life: 18,
      energy: 20,
      attack: 3,
      armor: 2,
      move: 4,
      energyDice: '1d10',
      nameClass: 'text-yellow-400',
      subtitleClass: 'text-yellow-400/65',
      cardClass: 'border-yellow-500/25 hover:border-yellow-500/50 hover:shadow-yellow-500/10',
      energyBarClass: 'bg-yellow-400/70',
      statClass: 'text-yellow-300',
      lifePercent: 72,
      energyPercent: 91,
    },
    {
      name: 'CoreBot',
      type: 'PLATAFORMA ESTÁNDAR',
      life: 20,
      energy: 16,
      attack: 4,
      armor: 3,
      move: 2,
      energyDice: '1d4',
      nameClass: 'text-cyan-400',
      subtitleClass: 'text-cyan-400/65',
      cardClass: 'border-cyan-500/25 hover:border-cyan-500/50 hover:shadow-cyan-500/10',
      energyBarClass: 'bg-cyan-400/70',
      statClass: 'text-cyan-300',
      lifePercent: 80,
      energyPercent: 73,
    },
  ];
}
