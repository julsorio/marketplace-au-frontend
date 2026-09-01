import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar } from './shared/components/navbar/navbar';

/**
 * Componente raíz de la aplicación (`app-root`).
 * Aloja la barra de navegación (`Navbar`) y el `RouterOutlet` donde se renderizan los componentes
 * cargados de forma perezosa según la ruta activa.
 */
@Component({
  imports: [RouterOutlet, Navbar],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly title = signal('frontend-marketplace');
}
