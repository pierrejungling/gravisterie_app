import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent, appConfig } from '@root';
import { demarrerFondTopo } from './app/shared/core/service/topo-fond';

bootstrapApplication(AppComponent, appConfig)
  .catch(err => console.error(err));

demarrerFondTopo();
