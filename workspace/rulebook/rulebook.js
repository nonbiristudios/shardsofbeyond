class GameTitle extends HTMLElement {
  static observedAttributes = ["color", "size"];

  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    // Create the header content
    const header = document.createElement('header');
    header.className = 'mb-4';

    // Create the h1 element with the title
    const h1 = document.createElement('h1');
    h1.className = 'text-center';
    h1.textContent = document.title; // Set text from <title> tag

    header.appendChild(h1);
    shadow.appendChild(header);
  }
}

customElements.define("game-title", GameTitle);