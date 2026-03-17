import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/landing/landing').then(m => m.Landing)
  },
  {
    path: 'docs',
    children: [
      { path: '', redirectTo: 'reglamento', pathMatch: 'full' },
      { path: 'print', loadComponent: () => import('./features/docs/docs-print').then(m => m.DocsPrint) },
      { path: '**', loadComponent: () => import('./features/docs/docs').then(m => m.Docs) },
    ],
  },
  {
    path: 'army-builder',
    loadComponent: () => import('./features/army-builder/army-builder').then(m => m.ArmyBuilder)
  },
  {
    path: 'list/:id',
    canActivate: [(route: import('@angular/router').ActivatedRouteSnapshot) => {
      return inject(Router).createUrlTree(['/army-builder'], { queryParams: { from: route.paramMap.get('id') } });
    }],
    children: [],
  },
  {
    path: 'admin',
    children: [
      { path: '', loadComponent: () => import('./features/admin/admin').then(m => m.Admin) },
      { path: 'scenarios/new', loadComponent: () => import('./features/admin/scenario-editor').then(m => m.ScenarioEditor) },
      { path: 'scenarios/:id', loadComponent: () => import('./features/admin/scenario-editor').then(m => m.ScenarioEditor) },
    ],
  },
  {
    path: '**',
    redirectTo: ''
  }
];
