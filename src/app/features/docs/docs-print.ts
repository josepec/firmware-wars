import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MarkdownComponent } from 'ngx-markdown';

@Component({
  selector: 'app-docs-print',
  imports: [RouterLink, MarkdownComponent],
  templateUrl: './docs-print.html',
  styleUrl: './docs-print.scss',
})
export class DocsPrint {
  readonly sections = [
    { id: 'intro',      num: '01', title: 'INIT.SYS',     subtitle: 'Introducción'        },
    { id: 'ambient',    num: '02', title: 'AMBIENT.DSK',   subtitle: 'Ambientación'        },
    { id: 'hardware',   num: '03', title: 'HARDWARE.CFG',  subtitle: 'Componentes'         },
    { id: 'setup',      num: '04', title: 'SETUP.PRT',     subtitle: 'Preparación'         },
    { id: 'core-cycle', num: '05', title: 'CORE.CYCLE',    subtitle: 'Ciclo de Turno'      },
    { id: 'bots',       num: '06', title: 'BOTS.CFG',      subtitle: 'Unidades de Combate' },
    { id: 'tables',     num: '07', title: 'TECH.REF',      subtitle: 'Referencia Técnica'  },
    { id: 'quick-ref',  num: '08', title: 'QUICK.REF',     subtitle: 'Referencia Rápida'   },
  ];

  print(): void {
    window.print();
  }
}
