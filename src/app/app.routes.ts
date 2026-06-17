import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login-page.component').then(m => m.LoginPageComponent) },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'recipes', loadComponent: () => import('./features/recipes/recipes-page/recipes-page.component').then(m => m.RecipesPageComponent) },
      { path: 'recipes/:id', loadComponent: () => import('./features/recipes/recipe-detail/recipe-detail.component').then(m => m.RecipeDetailComponent) },
      { path: 'import', loadComponent: () => import('./features/import/import-page/import-page.component').then(m => m.ImportPageComponent) },
      { path: 'settings', loadComponent: () => import('./features/settings/settings-page.component').then(m => m.SettingsPageComponent) },
      { path: '', redirectTo: 'recipes', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: 'recipes' },
];
