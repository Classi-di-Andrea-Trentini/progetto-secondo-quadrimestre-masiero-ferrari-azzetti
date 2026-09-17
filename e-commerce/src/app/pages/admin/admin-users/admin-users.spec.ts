import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

import { AdminUsers } from './admin-users';
import { AdminUser } from '../../../services/admin.service';
import { expectResponsiveCardList } from '../admin-card-list.testing';

describe('AdminUsers', () => {
  let component: AdminUsers;
  let fixture: ComponentFixture<AdminUsers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUsers],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminUsers);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  // Sotto `md` la tabella diventa una lista di card: una per utente, e lo
  // stato vuoto quando non ci sono risultati (helper condiviso da ogni
  // pagina con lo stesso pattern, vedi admin-card-list.testing.ts).
  it('should render one card per user on the mobile card branch, and the empty state with none', () => {
    const sample: AdminUser[] = [
      {
        id: 'u1', email: 'ada@example.com', fullName: 'Ada Lovelace', role: 'user',
        emailVerifiedAt: '2026-01-01T00:00:00Z', createdAt: '2026-01-01T00:00:00Z',
        _count: { orders: 3 },
      },
    ];
    expectResponsiveCardList<AdminUser>({
      fixture,
      setLoading: (v) => component.loading.set(v),
      setItems: (items) => component.users.set(items),
      sampleItems: sample,
      expectedTextInFirstCard: 'Ada Lovelace',
      emptyMessage: 'No users found',
    });
  });
});
