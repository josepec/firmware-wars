import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';
import { Footer } from './shared/components/footer/footer';
import { TabBar } from './shared/components/tab-bar/tab-bar';
import { Seo } from './core/services/seo';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer, TabBar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = 'Firmware Wars';

  constructor() {
    inject(Seo).init();
  }
}
