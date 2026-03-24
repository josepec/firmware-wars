import { Component, ViewEncapsulation, input } from '@angular/core';

@Component({
  selector: 'app-cover-page',
  encapsulation: ViewEncapsulation.None,
  template: `
    <!-- Top bar -->
    <div class="cover-top-bar">
      <div class="cover-top-left">
        <div class="cover-rights">ALL RIGHTS RESERVED</div>
        <div class="cover-classified">&copy;{{ copyrightYears() }}</div>
      </div>
      <div class="cover-top-right">
        <div class="cover-access-label">ACCESS LEVEL:</div>
        <div class="cover-access-value">SENIOR PROGRAMMER</div>
      </div>
    </div>

    <!-- Content -->
    <div class="cover-center">
      <!-- Title -->
      <div class="cover-title-firmware">FIRMWARE</div>
      <div class="cover-title-wars">WARS</div>

      <!-- Hex circuit icon -->
      <div class="cover-hex-icon">
        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <polygon points="50,5 90,27.5 90,72.5 50,95 10,72.5 10,27.5" fill="none" stroke="#1a6b4a" stroke-width="2.5" />
          <polygon points="50,22 73,35 73,65 50,78 27,65 27,35" fill="none" stroke="#1a6b4a" stroke-width="1.5" />
          <line x1="50" y1="22" x2="50" y2="5" stroke="#1a6b4a" stroke-width="1" />
          <line x1="73" y1="35" x2="90" y2="27.5" stroke="#1a6b4a" stroke-width="1" />
          <line x1="73" y1="65" x2="90" y2="72.5" stroke="#1a6b4a" stroke-width="1" />
          <line x1="50" y1="78" x2="50" y2="95" stroke="#1a6b4a" stroke-width="1" />
          <line x1="27" y1="65" x2="10" y2="72.5" stroke="#1a6b4a" stroke-width="1" />
          <line x1="27" y1="35" x2="10" y2="27.5" stroke="#1a6b4a" stroke-width="1" />
          <circle cx="50" cy="50" r="8" fill="none" stroke="#1a6b4a" stroke-width="1.5" />
          <circle cx="50" cy="50" r="3" fill="#1a6b4a" />
          <circle cx="50" cy="22" r="2.5" fill="#1a6b4a" />
          <circle cx="73" cy="35" r="2.5" fill="#1a6b4a" />
          <circle cx="73" cy="65" r="2.5" fill="#1a6b4a" />
          <circle cx="50" cy="78" r="2.5" fill="#1a6b4a" />
          <circle cx="27" cy="65" r="2.5" fill="#1a6b4a" />
          <circle cx="27" cy="35" r="2.5" fill="#1a6b4a" />
          <line x1="50" y1="42" x2="50" y2="22" stroke="#1a6b4a" stroke-width="0.7" />
          <line x1="57" y1="46" x2="73" y2="35" stroke="#1a6b4a" stroke-width="0.7" />
          <line x1="57" y1="54" x2="73" y2="65" stroke="#1a6b4a" stroke-width="0.7" />
          <line x1="50" y1="58" x2="50" y2="78" stroke="#1a6b4a" stroke-width="0.7" />
          <line x1="43" y1="54" x2="27" y2="65" stroke="#1a6b4a" stroke-width="0.7" />
          <line x1="43" y1="46" x2="27" y2="35" stroke="#1a6b4a" stroke-width="0.7" />
        </svg>
      </div>

      <!-- Bot silhouettes strip -->
      <div class="cover-bot-strip">
        <img [src]="imageSrc()" alt="" onerror="this.style.display='none'">
      </div>

      <!-- Subtitle -->
      <div class="cover-subtitle-block">
        <div class="cover-manual">{{ subtitle() }}</div>
        @if (systemLine()) {
          <div class="cover-system">{{ systemLine() }}</div>
        }
        <div class="cover-version" id="cover-version"></div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: contents; }

    /* ── Top bar ── */
    .cover-top-bar {
      width: 100%;
      display: flex;
      justify-content: space-between;
      padding: 0.2cm 0.1cm 0;
      font-family: 'Share Tech Mono', monospace;
      font-size: 6.5pt;
      color: #888;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      line-height: 1.7;
    }

    .cover-top-right { text-align: right; }
    .cover-classified { color: #1a6b4a; }
    .cover-access-value { color: #1a6b4a; }

    /* ── Center content ── */
    .cover-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 2.7cm 0.55cm 0;
    }

    .cover-title-firmware {
      font-family: 'Orbitron', sans-serif;
      font-weight: 900;
      font-size: 36pt;
      letter-spacing: 0.08em;
      color: #0a0a0a;
      line-height: 1;
      text-align: center;
    }

    .cover-title-wars {
      font-family: 'Orbitron', sans-serif;
      font-weight: 900;
      font-size: 48pt;
      letter-spacing: 0.13em;
      color: #1a6b4a;
      line-height: 0.95;
      text-align: center;
      margin-bottom: 0.05cm;
    }

    /* ── Hex circuit icon ── */
    .cover-hex-icon {
      margin-bottom: 0;

      svg {
        width: 2.2cm;
        height: 2.2cm;
      }
    }

    /* ── Bot silhouettes strip ── */
    .cover-bot-strip {
      display: flex;
      justify-content: center;
      align-items: center;
      width: 100%;
      height: 5cm;

      img {
        height: 4.6cm;
        opacity: 0.8;
        object-fit: contain;
      }
    }

    /* ── Subtitle block ── */
    .cover-subtitle-block {
      text-align: center;
      margin-top: 0.1cm;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.02cm;
    }

    .cover-manual {
      font-family: 'Rajdhani', sans-serif;
      font-weight: 700;
      font-size: 20pt;
      letter-spacing: 0.1em;
      color: #0a0a0a;
      text-transform: uppercase;
    }

    .cover-system {
      font-family: 'Rajdhani', sans-serif;
      font-weight: 500;
      font-size: 9pt;
      letter-spacing: 0.18em;
      color: #888;
      text-transform: uppercase;
    }

    .cover-version {
      font-family: 'Rajdhani', sans-serif;
      font-weight: 400;
      font-size: 8pt;
      letter-spacing: 0.12em;
      color: #999;
      text-transform: uppercase;
    }
  `],
})
export class CoverPage {
  imageSrc = input.required<string>();
  subtitle = input.required<string>();
  systemLine = input<string>();
  copyrightYears = input.required<string>();
}
