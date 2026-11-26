import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { AppComponent, appConfig } from '@root';
import { HttpInterceptor } from '@api';
import { demarrerFondTopo } from './app/shared/core/service/topo-fond';
import { DemoBackendInterceptor } from './demo/demo-backend.interceptor';

// Démonstration publique : pas de serveur, pas de temps réel, connexion automatique.
const fetchReel = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit) =>
  String(input).includes('/api/events') ? Promise.resolve(new Response(null, { status: 404 })) : fetchReel(input, init);
try {
  localStorage.setItem('token', JSON.stringify({ token: 'demo-token', refreshToken: 'demo-refresh', isEmpty: false }));
  localStorage.setItem('currentUser', 'Démo');
} catch { /* stockage indisponible : la page de connexion acceptera n'importe quoi */ }

// Arrivée sur la racine de la démo : on va directement au tableau de bord.
{
  const base = document.baseURI.replace(location.origin, '').replace(/\/$/, '');
  if (location.pathname.replace(/\/$/, '') === base) history.replaceState(null, '', base + '/dashboard');
}

// Barre de défilement fine, aux couleurs de l'app (la piste laisse voir le fond, jamais de bande blanche).
{
  const st = document.createElement('style');
  st.textContent =
    'html::-webkit-scrollbar{width:10px;height:10px;background:transparent}' +
    'html::-webkit-scrollbar-track{background:transparent}' +
    'html::-webkit-scrollbar-thumb{background:rgba(128,118,106,.55);border-radius:10px;border:2px solid transparent;background-clip:content-box}' +
    'html::-webkit-scrollbar-thumb:hover{background:rgba(128,118,106,.85);background-clip:content-box}' +
    '@supports not selector(::-webkit-scrollbar){html{scrollbar-width:thin;scrollbar-color:rgba(128,118,106,.6) transparent}}';
  document.head.appendChild(st);
}

bootstrapApplication(AppComponent, {
  ...appConfig,
  providers: [...appConfig.providers, provideHttpClient(withInterceptors([DemoBackendInterceptor, HttpInterceptor]))],
}).catch(err => console.error(err));

demarrerFondTopo();
