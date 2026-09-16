import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProductImageComponent } from './product-image';

describe('ProductImageComponent', () => {
  let fixture: ComponentFixture<ProductImageComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductImageComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ProductImageComponent);
  });

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  it('renders the image when a url is provided', async () => {
    fixture.componentRef.setInput('src', '/media/catalogo/prodotti/t-shirt-bianca-basic.svg');
    fixture.componentRef.setInput('alt', 'T-shirt bianca');
    await fixture.whenStable();

    const img = host().querySelector('img');
    expect(img).toBeTruthy();
    expect(img!.getAttribute('alt')).toBe('T-shirt bianca');
    expect(host().querySelector('.ce-fallback')).toBeNull();
  });

  it('renders the placeholder when the url is missing or blank', async () => {
    fixture.componentRef.setInput('src', '   ');
    await fixture.whenStable();

    expect(host().querySelector('img')).toBeNull();
    expect(host().querySelector('.ce-fallback')).toBeTruthy();
  });

  it('labels the placeholder in english when no alt text is given', async () => {
    fixture.componentRef.setInput('src', '   ');
    await fixture.whenStable();

    expect(host().querySelector('.ce-fallback')!.getAttribute('aria-label')).toBe('Image not available');
  });

  it('falls back to the placeholder when the image fails to load', async () => {
    fixture.componentRef.setInput('src', '/media/catalogo/prodotti/non-esiste.svg');
    await fixture.whenStable();

    const img = host().querySelector('img');
    expect(img).toBeTruthy();
    img!.dispatchEvent(new Event('error'));
    await fixture.whenStable();

    expect(host().querySelector('img')).toBeNull();
    expect(host().querySelector('.ce-fallback')).toBeTruthy();
  });

  it('shows the image again when a new url is set after a failure', async () => {
    fixture.componentRef.setInput('src', '/media/catalogo/prodotti/non-esiste.svg');
    await fixture.whenStable();
    host().querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(host().querySelector('.ce-fallback')).toBeTruthy();

    fixture.componentRef.setInput('src', '/media/catalogo/prodotti/jeans-blu-classico.svg');
    await fixture.whenStable();

    expect(host().querySelector('img')).toBeTruthy();
    expect(host().querySelector('.ce-fallback')).toBeNull();
  });
});
