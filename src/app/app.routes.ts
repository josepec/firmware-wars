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
      { path: 'campaign-print', loadComponent: () => import('./features/docs/campaign-print').then(m => m.CampaignPrint) },
      { path: 'scenarios-print', loadComponent: () => import('./features/docs/scenarios-print').then(m => m.ScenariosPrint) },
      { path: 'cover-print', loadComponent: () => import('./features/docs/cover-print').then(m => m.CoverPrint) },
      { path: '**', loadComponent: () => import('./features/docs/docs').then(m => m.Docs) },
    ],
  },
  {
    path: 'army-builder',
    loadComponent: () => import('./features/army-builder/army-builder').then(m => m.ArmyBuilder)
  },
  {
    path: 'noticias',
    loadComponent: () => import('./features/news/news-list').then(m => m.NewsList)
  },
  {
    path: 'noticias/:slug',
    loadComponent: () => import('./features/news/news-post').then(m => m.NewsPost)
  },
  {
    path: 'soporte',
    loadComponent: () => import('./features/support/support').then(m => m.Support)
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
    loadComponent: () => import('./features/admin/admin-layout').then(m => m.AdminLayout),
    children: [
      { path: '', redirectTo: 'scenarios', pathMatch: 'full' },
      { path: 'scenarios', loadComponent: () => import('./features/admin/admin').then(m => m.Admin) },
      { path: 'scenarios/new', loadComponent: () => import('./features/admin/scenario-editor').then(m => m.ScenarioEditor) },
      { path: 'scenarios/:id', loadComponent: () => import('./features/admin/scenario-editor').then(m => m.ScenarioEditor) },
      { path: 'hex-types', loadComponent: () => import('./features/admin/hex-type-list').then(m => m.HexTypeList) },
      { path: 'functions', loadComponent: () => import('./features/admin/function-list').then(m => m.FunctionList) },
      { path: 'functions/new', loadComponent: () => import('./features/admin/function-editor').then(m => m.FunctionEditor) },
      { path: 'functions/:id', loadComponent: () => import('./features/admin/function-editor').then(m => m.FunctionEditor) },
      { path: 'threats', loadComponent: () => import('./features/admin/threat-list').then(m => m.ThreatList) },
      { path: 'threats/new', loadComponent: () => import('./features/admin/threat-editor').then(m => m.ThreatEditor) },
      { path: 'threats/:id', loadComponent: () => import('./features/admin/threat-editor').then(m => m.ThreatEditor) },
      { path: 'simulator', loadComponent: () => import('./features/admin/simulator/simulator-list').then(m => m.SimulatorList) },
      { path: 'simulator/new', loadComponent: () => import('./features/admin/simulator/simulator-setup').then(m => m.SimulatorSetup) },
      { path: 'simulator/play/:id', loadComponent: () => import('./features/admin/simulator/simulator-play').then(m => m.SimulatorPlay) },
      { path: 'simulator/view/:id', loadComponent: () => import('./features/admin/simulator/simulator-viewer').then(m => m.SimulatorViewer) },
      { path: 'posts', loadComponent: () => import('./features/admin/post-list').then(m => m.PostList) },
      { path: 'posts/new', loadComponent: () => import('./features/admin/post-editor').then(m => m.PostEditor) },
      { path: 'posts/:id', loadComponent: () => import('./features/admin/post-editor').then(m => m.PostEditor) },
      { path: 'faqs', loadComponent: () => import('./features/admin/faq-list').then(m => m.FaqList) },
      { path: 'faqs/new', loadComponent: () => import('./features/admin/faq-editor').then(m => m.FaqEditor) },
      { path: 'faqs/:id', loadComponent: () => import('./features/admin/faq-editor').then(m => m.FaqEditor) },
      { path: 'messages', loadComponent: () => import('./features/admin/message-list').then(m => m.MessageList) },
    ],
  },
  {
    path: '**',
    redirectTo: ''
  }
];
