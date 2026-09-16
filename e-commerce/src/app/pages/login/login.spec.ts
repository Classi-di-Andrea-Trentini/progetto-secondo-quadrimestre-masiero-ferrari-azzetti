import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { Login } from './login';

describe('Login', () => {
  let component: Login;
  let fixture: ComponentFixture<Login>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(Login);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('starts without an error message', () => {
    expect(component.error()).toBeNull();
  });
});

/**
 * Il ritorno da un accesso con Google andato storto.
 *
 * Il giro OAuth finisce con un redirect del browser, non con una risposta che il
 * componente possa leggere: quando il backend rifiuta (indirizzo mai confermato,
 * account gia' collegato a un'altra identita' Google) rimanda qui con il motivo in
 * `?error=`. Senza, la persona tornerebbe alla pagina di accesso senza sapere
 * perche' e riproverebbe all'infinito.
 */
describe('Login — ritorno da Google con un errore', () => {
  const messaggio =
    "Esiste gia' un account con questo indirizzo, ma l'indirizzo non e' mai stato confermato.";

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Login],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap({ error: messaggio }) } },
        },
      ],
    }).compileComponents();
  });

  it('shows the reason the backend gave', async () => {
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.componentInstance.error()).toBe(messaggio);
    expect(fixture.nativeElement.textContent).toContain('mai stato confermato');
  });
});
