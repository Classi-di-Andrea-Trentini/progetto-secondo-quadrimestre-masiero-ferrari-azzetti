Il carrello che vedi nell'immagine è un pannello laterale (sidebar/drawer) che si apre sopra la pagina, non una pagina separata. È la scelta migliore per l'UX di un e-commerce.
In Angular ti conviene farlo così:
Un componente CartSidebarComponent che funge da drawer laterale, gestito da un servizio CartService che tiene lo stato del carrello.
src/
├── app/
│   ├── components/
│   │   └── cart-sidebar/
│   │       ├── cart-sidebar.component.ts
│   │       ├── cart-sidebar.component.html
│   │       └── cart-sidebar.component.scss
│   ├── services/
│   │   └── cart.service.ts       ← stato globale del carrello
Il CartService usa un BehaviorSubject per tenere i prodotti nel carrello e lo condivide tra tutti i componenti (navbar, sidebar, pagina prodotto ecc.).
La navbar ha il bottone con il numero di articoli → al click apre la sidebar → la sidebar mostra i prodotti.
