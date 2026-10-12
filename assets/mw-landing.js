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

/* Hero image labels: replay the entrance whenever the hero scrolls into view, and let the
   labels follow the cursor with depth (parallax). Skipped for "None" and reduced motion. */
(() => {
  const init = () => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelectorAll('.mw-hero--ready').forEach((hero) => {
      if (hero.dataset.mwHeroBound) return;
      hero.dataset.mwHeroBound = 'true';

      if (reduceMotion) {
        hero.classList.add('is-in-view');
        return;
      }

      new IntersectionObserver(
        (entries) => entries.forEach((entry) => hero.classList.toggle('is-in-view', entry.isIntersecting)),
        { threshold: 0.25 }
      ).observe(hero);

      const media = hero.querySelector('.mw-hero__media');
      if (!media || !window.matchMedia('(hover: hover)').matches) return;

      let frame;
      media.addEventListener('pointermove', (event) => {
        const rect = media.getBoundingClientRect();
        const x = (event.clientX - rect.left) / rect.width - 0.5;
        const y = (event.clientY - rect.top) / rect.height - 0.5;
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          media.style.setProperty('--mw-mx', x.toFixed(3));
          media.style.setProperty('--mw-my', y.toFixed(3));
        });
      });
      media.addEventListener('pointerleave', () => {
        cancelAnimationFrame(frame);
        media.style.setProperty('--mw-mx', 0);
        media.style.setProperty('--mw-my', 0);
      });
    });
  };

  init();
  document.addEventListener('shopify:section:load', init);
})();

/* Shop page: infinite scroll / load more, and category switching without page reloads.
   Uses Shopify's Section Rendering API (?section_id=) so only this section's HTML is fetched.
   Without JavaScript the normal page-number links still work. */
if (!customElements.get('mw-collection-browser')) {
  customElements.define(
    'mw-collection-browser',
    class MwCollectionBrowser extends HTMLElement {
      connectedCallback() {
        this.sectionId = this.dataset.sectionId;
        this.mode = this.dataset.mode || 'infinite';
        this.autoBatches = parseInt(this.dataset.autoBatches, 10);
        if (Number.isNaN(this.autoBatches)) this.autoBatches = 3;
        this.loadsDone = 0;

        if (this.mode !== 'pages') this.classList.add('is-enhanced');
        this.addEventListener('click', this.onClick.bind(this));
        this.onPopState = () => this.switchTo(window.location.href, { push: false });
        window.addEventListener('popstate', this.onPopState);
        this.setupLoader();
      }

      disconnectedCallback() {
        window.removeEventListener('popstate', this.onPopState);
        this.observer?.disconnect();
      }

      sectionUrl(href) {
        const url = new URL(href, window.location.origin);
        url.searchParams.set('section_id', this.sectionId);
        return url.toString();
      }

      async fetchSection(href) {
        const response = await fetch(this.sectionUrl(href));
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return new DOMParser().parseFromString(await response.text(), 'text/html');
      }

      /* ---------- Infinite scroll / load more ---------- */
      setupLoader() {
        this.observer?.disconnect();
        this.loader = this.querySelector('[data-mw-loader]');
        this.grid = this.querySelector('[data-mw-grid]');
        if (!this.loader || !this.grid || this.mode === 'pages') return;

        this.button = this.loader.querySelector('[data-mw-load-more]');
        this.button?.addEventListener('click', () => this.loadNext());

        if (!this.loader.dataset.nextUrl) {
          this.finish();
          return;
        }

        if (this.mode === 'load_more' || this.reachedAutoLimit()) {
          this.showButton();
          return;
        }

        this.observer = new IntersectionObserver(
          (entries) => {
            if (entries.some((entry) => entry.isIntersecting)) this.loadNext();
          },
          { rootMargin: '0px 0px 600px 0px' }
        );
        this.observer.observe(this.loader);
      }

      reachedAutoLimit() {
        return this.autoBatches > 0 && this.loadsDone >= this.autoBatches;
      }

      showButton() {
        if (this.button) this.button.hidden = false;
      }

      finish() {
        this.observer?.disconnect();
        this.loader?.classList.add('is-done');
        if (this.button) this.button.hidden = true;
      }

      async loadNext() {
        const nextUrl = this.loader?.dataset.nextUrl;
        if (!nextUrl || this.loading) return;
        this.loading = true;
        this.loader.classList.add('is-loading');
        if (this.button) this.button.hidden = true;

        try {
          const html = await this.fetchSection(nextUrl);
          const items = html.querySelectorAll('[data-mw-grid] > li');
          items.forEach((item, index) => {
            item.classList.add('mw-collection__item--new');
            item.style.setProperty('--mw-item-delay', `${index * 60}ms`);
            this.grid.append(item);
          });

          const nextLoader = html.querySelector('[data-mw-loader]');
          this.loader.dataset.nextUrl = nextLoader?.dataset.nextUrl || '';
          this.updateStatus();
          this.loadsDone += 1;

          if (!this.loader.dataset.nextUrl) {
            this.finish();
          } else if (this.mode === 'load_more' || this.reachedAutoLimit()) {
            this.observer?.disconnect();
            this.showButton();
          }
        } catch (error) {
          // Network problem: let the shopper retry with the button.
          this.observer?.disconnect();
          this.showButton();
        } finally {
          this.loading = false;
          this.loader?.classList.remove('is-loading');
        }
      }

      updateStatus() {
        const status = this.loader.querySelector('[data-mw-status]');
        const template = this.loader.dataset.statusTemplate;
        if (!status || !template) return;
        status.textContent = template
          .replace('[shown]', this.grid.children.length)
          .replace('[total]', this.loader.dataset.total);
      }

      /* ---------- Categories and quick filters without reload ---------- */
      onClick(event) {
        const link = event.target.closest('a.mw-collection__category, a.mw-collection__filter');
        if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
        const url = new URL(link.href, window.location.origin);
        if (url.origin !== window.location.origin || !url.pathname.includes('/collections/')) return;
        event.preventDefault();
        this.switchTo(url.toString(), { push: true });
      }

      async switchTo(href, { push }) {
        this.classList.add('is-switching');
        this.setAttribute('aria-busy', 'true');

        try {
          const html = await this.fetchSection(href);
          const nextBrowser = html.querySelector('mw-collection-browser');
          if (!nextBrowser) throw new Error('Missing section markup');

          const nextHero = html.querySelector('[data-mw-collection-hero]');
          const hero = this.closest('.mw-collection')?.querySelector('[data-mw-collection-hero]');
          if (nextHero && hero) hero.replaceWith(nextHero);

          this.innerHTML = nextBrowser.innerHTML;
          this.dataset.title = nextBrowser.dataset.title || '';
          if (this.dataset.title) document.title = this.dataset.title;
          if (push) window.history.pushState({ mwCollection: true }, '', href);

          this.loadsDone = 0;
          this.setupLoader();

          const top = this.getBoundingClientRect().top;
          if (top < 0) this.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (error) {
          window.location.href = href;
        } finally {
          this.classList.remove('is-switching');
          this.removeAttribute('aria-busy');
        }
      }
    }
  );
}

/* Finish swatches: clicking a color shows that finish's image on the right. */
if (!customElements.get('mw-finish-picker')) {
  customElements.define(
    'mw-finish-picker',
    class MwFinishPicker extends HTMLElement {
      connectedCallback() {
        this.swatches = Array.from(this.querySelectorAll('[data-mw-finish-swatch]'));
        this.images = Array.from(this.querySelectorAll('[data-mw-finish-image]'));
        this.swatches.forEach((swatch) => swatch.addEventListener('click', () => this.select(swatch)));

        const active = this.images.find((img) => img.classList.contains('is-active'));
        this.swatches.forEach((s) =>
          s.setAttribute('aria-pressed', String(active?.dataset.mwFinishImage === s.dataset.mwFinishSwatch))
        );
      }

      select(swatch) {
        const image = this.images.find((img) => img.dataset.mwFinishImage === swatch.dataset.mwFinishSwatch);
        if (!image) return;
        this.swatches.forEach((s) => s.setAttribute('aria-pressed', String(s === swatch)));
        this.images.forEach((img) => img.classList.toggle('is-active', img === image));
        image.loading = 'eager';
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
