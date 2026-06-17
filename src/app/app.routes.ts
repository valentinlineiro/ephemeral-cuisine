import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login-page.component').then(m => m.LoginPageComponent) },
  { path: 'auth/callback', loadComponent: () => import('./features/auth/auth-callback.component').then(m => m.AuthCallbackComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      // v2 main tabs
      { path: 'tonight', loadComponent: () => import('./features/tonight/tonight-page.component').then(m => m.TonightPageComponent) },
      { path: 'ranking', loadComponent: () => import('./features/ranking/ranking-page.component').then(m => m.RankingPageComponent) },
      { path: 'inventory', loadComponent: () => import('./features/inventory/inventory-page/inventory-page.component').then(m => m.InventoryPageComponent) },
      { path: 'techniques', loadComponent: () => import('./features/techniques/techniques-page/techniques-page.component').then(m => m.TechniquesPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings-page.component').then(m => m.SettingsPageComponent) },
      // v1 routes kept but off main nav
      { path: 'recipes', loadComponent: () => import('./features/recipes/recipes-page/recipes-page.component').then(m => m.RecipesPageComponent) },
      { path: 'recipes/:id', loadComponent: () => import('./features/recipes/recipe-detail/recipe-detail.component').then(m => m.RecipeDetailComponent) },
      { path: 'import', loadComponent: () => import('./features/import/import-page/import-page.component').then(m => m.ImportPageComponent) },
      { path: '', redirectTo: 'tonight', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'tonight' },
];
