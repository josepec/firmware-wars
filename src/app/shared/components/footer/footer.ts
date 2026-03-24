import { Component, signal, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';

const API_URL = 'https://firmware-wars-api.josepec.eu';

@Component({
  selector: 'app-footer',
  imports: [RouterLink],
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
})
export class Footer implements OnInit {
  readonly year = new Date().getFullYear();
  readonly version = signal('');

  ngOnInit(): void {
    fetch(`${API_URL}/version`)
      .then(r => r.json())
      .then((data: { version: string | null }) => {
        if (data.version) this.version.set(data.version);
      })
      .catch(() => {});
  }
}
