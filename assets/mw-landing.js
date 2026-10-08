/* Meldwood landing page interactions: hero carousel, product tabs, header dropdowns. */

if (!customElements.get('mw-carousel')) {
  customElements.define(
    'mw-carousel',
    class MwCarousel extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-mw-track]');
        this.prevButton = this.querySelector('[data-mw-prev]');
        this.nextButton = this.querySelector('[data-mw-next]');
        if (!this.track) return;

        this.onScroll = this.updateButtons.bind(this);
        this.prevButton?.addEventListener('click', () => this.step(-1));
        this.nextButton?.addEventListener('click', () => this.step(1));
        this.track.addEventListener('scroll', this.onScroll, { passive: true });
        window.addEventListener('resize', this.onScroll);
        this.updateButtons();
      }

      disconnectedCallback() {
        window.removeEventListener('resize', this.onScroll);
      }

      step(direction) {
        const slide = this.track.firstElementChild;
        if (!slide) return;
        const gap = parseFloat(getComputedStyle(this.track).columnGap) || 0;
        this.track.scrollBy({ left: direction * (slide.getBoundingClientRect().width + gap), behavior: 'smooth' });
      }

      updateButtons() {
        const maxScroll = this.track.scrollWidth - this.track.clientWidth;
        if (this.prevButton) this.prevButton.disabled = this.track.scrollLeft <= 1;
        if (this.nextButton) this.nextButton.disabled = this.track.scrollLeft >= maxScroll - 1;
      }
    }
  );
}

if (!customElements.get('mw-tabs')) {
  customElements.define(
    'mw-tabs',
    class MwTabs extends HTMLElement {
      connectedCallback() {
        this.tabs = Array.from(this.querySelectorAll('[data-mw-tab]'));
        this.tabs.forEach((tab, index) => {
          tab.addEventListener('click', () => this.select(index));
          tab.addEventListener('keydown', (event) => this.onKeydown(event, index));
        });
      }

      onKeydown(event, index) {
        const keys = { ArrowRight: 1, ArrowLeft: -1 };
        if (!(event.key in keys)) return;
        event.preventDefault();
        const next = (index + keys[event.key] + this.tabs.length) % this.tabs.length;
        this.select(next);
        this.tabs[next].focus();
      }

      select(index) {
        this.tabs.forEach((tab, i) => {
          const selected = i === index;
          tab.setAttribute('aria-selected', selected);
          tab.tabIndex = selected ? 0 : -1;
          const panel = document.getElementById(tab.getAttribute('aria-controls'));
          if (panel) panel.hidden = !selected;
        });
      }
    }
  );
}

if (!window.mwDismissableBound) {
  window.mwDismissableBound = true;

  const closeOpen = (except) => {
    document.querySelectorAll('details[data-mw-dismissable][open]').forEach((details) => {
      if (details !== except) details.removeAttribute('open');
    });
  };

  document.addEventListener('click', (event) => {
    closeOpen(event.target.closest('details[data-mw-dismissable]'));
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    const open = document.querySelector('details[data-mw-dismissable][open]');
    if (!open) return;
    closeOpen();
    open.querySelector('summary')?.focus();
  });
}
