import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing').then(m => m.Landing)
  },
  {
    path: 'docs',
    loadComponent: () => import('./features/docs/docs').then(m => m.Docs)
  },
  {
    path: 'docs/print',
    loadComponent: () => import('./features/docs/docs-print').then(m => m.DocsPrint)
  },
  {
    path: 'docs/:section',
    loadComponent: () => import('./features/docs/docs').then(m => m.Docs)
  },
  {
    path: 'army-builder',
    loadComponent: () => import('./features/army-builder/army-builder').then(m => m.ArmyBuilder)
  },
  {
    path: 'list/:id',
    loadComponent: () => import('./features/list-viewer/list-viewer').then(m => m.ListViewer)
  },
  {
    path: '**',
    redirectTo: ''
  }
];
