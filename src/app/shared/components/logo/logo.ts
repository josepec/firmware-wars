import { Component, ViewEncapsulation, input } from '@angular/core';

/**
 * LOGO OFICIAL DE FIRMWARE WARS — fuente única de la marca.
 *
 * Misma geometría que el favicon (`public/assets/favicon/favicon.svg`) y que
 * el SVG suelto de `public/assets/img/logo.svg`. Si el logo cambia, hay que
 * regenerar los tres.
 *
 * El trazo usa `currentColor`, así que el color lo pone quien lo monta:
 *   .mi-contenedor app-logo { color: #1a6b4a; }
 *
 * Va inline (y no como <img src>) a propósito: las portadas de PDF se
 * rasterizan en un worker y un fichero externo podría no haber cargado
 * todavía en el momento de la captura.
 */
@Component({
  selector: 'app-logo',
  encapsulation: ViewEncapsulation.None,
  template: `
    <svg [attr.viewBox]="'0 0 220 220'" xmlns="http://www.w3.org/2000/svg" role="img"
      [attr.aria-label]="title() || null" [attr.aria-hidden]="title() ? null : 'true'">
      @if (title()) { <title>{{ title() }}</title> }
      <g transform="translate(110 110) scale(0.86) translate(-100 -110)">
        <!-- Carcasa hexagonal -->
        <polygon points="100,10 186.6,60 186.6,160 100,210 13.4,160 13.4,60"
          fill="none" stroke="currentColor" stroke-width="13" stroke-linejoin="round" />
        <!-- Pistas del circuito (3 ramas a 120°) -->
        <g fill="none" stroke="currentColor" stroke-width="10" stroke-linecap="round" stroke-linejoin="round">
          <path d="M100,138 L100,174 L155.4,142 L155.4,114" />
          <path d="M100,138 L100,174 L155.4,142 L155.4,114" transform="rotate(120 100 110)" />
          <path d="M100,138 L100,174 L155.4,142 L155.4,114" transform="rotate(240 100 110)" />
        </g>
        <!-- Núcleo -->
        <polygon points="100,82 124.2,96 124.2,124 100,138 75.8,124 75.8,96"
          fill="none" stroke="currentColor" stroke-width="10" stroke-linejoin="round" />
        <!-- Nodos -->
        <g fill="none" stroke="currentColor" stroke-width="8">
          <circle cx="155.4" cy="104" r="10" />
          <circle cx="155.4" cy="104" r="10" transform="rotate(120 100 110)" />
          <circle cx="155.4" cy="104" r="10" transform="rotate(240 100 110)" />
        </g>
      </g>
    </svg>
  `,
  styles: [`
    app-logo {
      display: inline-flex;
    }
    app-logo svg {
      width: 100%;
      height: 100%;
      display: block;
    }
  `],
})
export class Logo {
  /** Texto accesible. Si se omite, el logo se marca como decorativo. */
  title = input<string>('');
}
