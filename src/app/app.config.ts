import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideMarkdown, MARKED_EXTENSIONS } from 'ngx-markdown';

import { routes } from './app.routes';
import { markdownExtensions } from './shared/markdown/marked-extensions';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(),
    provideMarkdown({
      markedExtensions: [
        { provide: MARKED_EXTENSIONS, useValue: markdownExtensions, multi: true },
      ],
    }),
  ]
};
