import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { Subscription } from 'rxjs';
import { QuickStart } from './quick-start/quick-start';

const TERMINAL_KEY = 'fw_terminal_closed';

@Component({
  selector: 'app-landing',
  imports: [RouterLink, NgClass, QuickStart],
  templateUrl: './landing.html',
  styleUrl: './landing.scss',
})
export class Landing implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly bootLines = signal<string[]>([]);
  readonly bootDone = signal(false);
  readonly showContent = signal(false);
  readonly terminalVisible = signal(true);

  private interval: ReturnType<typeof setInterval> | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private fragSub: Subscription | null = null;

  private readonly allBootLines = [
    '> SYSTEM INITIATED...',
    '> LOADING FIRMWARE WARS 28TH CYCLE...',
    '> CONNECTING TO ARENA DIGITAL...',
    '> BOTS.CFG LOADED [4 UNITS READY]',
    '> CORE COMBAT SYSTEM ONLINE',
    '> WELCOME, SENIOR PROGRAMMER.',
  ];

  ngOnInit() {
    // Clic en "Quick Start" estando ya en la home: solo cambia el fragment.
    this.fragSub = this.route.fragment.subscribe(f => {
      if (f === 'quick-start' && this.showContent()) this.scrollToQuickStart();
    });

    // Si llegamos con #quick-start (navbar u otra página), saltar el boot y bajar a la demo.
    if (this.route.snapshot.fragment === 'quick-start') {
      this.terminalVisible.set(false);
      this.showContent.set(true);
      this.timeout = setTimeout(() => this.scrollToQuickStart(), 120);
      return;
    }

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

  scrollToQuickStart() {
    document.getElementById('quick-start')?.scrollIntoView({ behavior: 'smooth' });
  }

  closeTerminal() {
    sessionStorage.setItem(TERMINAL_KEY, '1');
    this.terminalVisible.set(false);
    this.showContent.set(true);
  }

  ngOnDestroy() {
    if (this.interval) clearInterval(this.interval);
    if (this.timeout) clearTimeout(this.timeout);
    this.fragSub?.unsubscribe();
  }

  readonly bots = [
    {
      name: 'BRUTEBOT',
      type: 'ASALTO PESADO',
      preset: 'brutebot',
      life: 22,
      energy: 16,
      shield: 3,
      move: 1,
      nibbles: 120,
      nameClass: 'text-red-400',
      subtitleClass: 'text-red-400/65',
      cardClass: 'border-red-500/25 hover:border-red-500/50 hover:shadow-red-500/10',
      energyBarClass: 'bg-red-400/70',
      statClass: 'text-red-300',
      lifePercent: 100,
      energyPercent: 73,
    },
    {
      name: 'HACKBOT',
      type: 'INFILTRACIÓN LÓGICA',
      preset: 'hackbot',
      life: 18,
      energy: 18,
      shield: 3,
      move: 2,
      nibbles: 110,
      nameClass: 'text-violet-400',
      subtitleClass: 'text-violet-400/65',
      cardClass: 'border-violet-500/25 hover:border-violet-500/50 hover:shadow-violet-500/10',
      energyBarClass: 'bg-violet-400/70',
      statClass: 'text-violet-300',
      lifePercent: 82,
      energyPercent: 82,
    },
    {
      name: 'SCOUTBOT',
      type: 'RECONOCIMIENTO',
      preset: 'scoutbot',
      life: 18,
      energy: 18,
      shield: 2,
      move: 3,
      nibbles: 120,
      nameClass: 'text-yellow-400',
      subtitleClass: 'text-yellow-400/65',
      cardClass: 'border-yellow-500/25 hover:border-yellow-500/50 hover:shadow-yellow-500/10',
      energyBarClass: 'bg-yellow-400/70',
      statClass: 'text-yellow-300',
      lifePercent: 82,
      energyPercent: 82,
    },
    {
      name: 'COREBOT',
      type: 'PLATAFORMA ESTÁNDAR',
      preset: 'corebot',
      life: 22,
      energy: 18,
      shield: 1,
      move: 2,
      nibbles: 120,
      nameClass: 'text-cyan-400',
      subtitleClass: 'text-cyan-400/65',
      cardClass: 'border-cyan-500/25 hover:border-cyan-500/50 hover:shadow-cyan-500/10',
      energyBarClass: 'bg-cyan-400/70',
      statClass: 'text-cyan-300',
      lifePercent: 100,
      energyPercent: 82,
    },
  ];
}
