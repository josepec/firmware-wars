import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

@Component({
  selector: 'app-docs',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './docs.html',
  styleUrl: './docs.scss',
})
export class Docs {}
