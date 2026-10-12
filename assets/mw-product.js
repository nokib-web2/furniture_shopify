/* Meldwood product interactions: PDP gallery + variant picker, review slider, AJAX add to cart. */

if (!customElements.get('mw-product')) {
  customElements.define(
    'mw-product',
    class MwProduct extends HTMLElement {
      connectedCallback() {
        this.slides = Array.from(this.querySelectorAll('.mw-product__slide[data-media-id]'));
        this.thumbs = Array.from(this.querySelectorAll('[data-mw-thumb]'));
        const data = this.querySelector('[data-mw-variants]');
        this.variants = data ? JSON.parse(data.textContent) : [];
        this.optionInputs = Array.from(this.querySelectorAll('[data-mw-option]'));
        this.variantInput = this.querySelector('[data-mw-variant-id]');
        this.addButton = this.querySelector('[data-mw-add-button]');
        this.qtyInput = this.querySelector('.mw-product__qty-input');

        this.querySelector('[data-mw-media-prev]')?.addEventListener('click', () => this.stepMedia(-1));
        this.querySelector('[data-mw-media-next]')?.addEventListener('click', () => this.stepMedia(1));
        this.thumbs.forEach((thumb) => thumb.addEventListener('click', () => this.showMedia(thumb.dataset.mwThumb)));
        this.optionInputs.forEach((input) => input.addEventListener('change', () => this.onOptionChange()));
        this.querySelectorAll('[data-mw-qty]').forEach((button) =>
          button.addEventListener('click', () => {
            if (!this.qtyInput) return;
            const next = (parseInt(this.qtyInput.value, 10) || 1) + parseInt(button.dataset.mwQty, 10);
            this.qtyInput.value = Math.max(1, next);
          })
        );
      }

      currentIndex() {
        return Math.max(0, this.slides.findIndex((slide) => !slide.hidden));
      }

      stepMedia(direction) {
        if (!this.slides.length) return;
        const index = (this.currentIndex() + direction + this.slides.length) % this.slides.length;
        this.showMedia(this.slides[index].dataset.mediaId);
      }

      showMedia(mediaId) {
        if (!mediaId) return;
        const target = this.slides.find((slide) => slide.dataset.mediaId === String(mediaId));
        if (!target) return;
        this.slides.forEach((slide) => (slide.hidden = slide !== target));
        this.thumbs.forEach((thumb) => {
          const active = thumb.dataset.mwThumb === String(mediaId);
          thumb.classList.toggle('is-active', active);
          if (active) thumb.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
        });
      }

      onOptionChange() {
        const selected = [];
        this.optionInputs.forEach((input) => {
          if (input.checked) selected[parseInt(input.dataset.mwOption, 10)] = input.value;
        });
        const variant = this.variants.find((v) => v.options.every((value, i) => value === selected[i]));
        this.updateVariant(variant);
      }

      updateVariant(variant) {
        const button = this.addButton;
        if (!variant) {
          if (button) {
            button.disabled = true;
            button.textContent = button.dataset.labelUnavailable;
          }
          const checkout = this.querySelector('[data-mw-checkout]');
          if (checkout) checkout.hidden = true;
          return;
        }

        if (this.variantInput) this.variantInput.value = variant.id;
        if (button) {
          button.disabled = !variant.available;
          button.textContent = variant.available ? button.dataset.labelAdd : button.dataset.labelSoldOut;
        }
        // Shopify's "Buy it now" can't check out a sold-out variant, so hide it instead of letting it fail.
        const checkout = this.querySelector('[data-mw-checkout]');
        if (checkout) checkout.hidden = !variant.available;

        const price = this.querySelector('[data-mw-price]');
        const compare = this.querySelector('[data-mw-compare]');
        const sku = this.querySelector('[data-mw-sku]');
        if (price) price.textContent = variant.price;
        if (compare) compare.textContent = variant.compare || '';
        if (sku) sku.textContent = variant.sku;
        if (variant.media) this.showMedia(variant.media);

        if (this.dataset.url) {
          window.history.replaceState({}, '', `${this.dataset.url}?variant=${variant.id}`);
        }
      }
    }
  );
}

/* "Write a review" button opens the review form. */
document.addEventListener('click', (event) => {
  const trigger = event.target.closest('[data-mw-review-open]');
  if (!trigger) return;
  const form = document.getElementById(trigger.getAttribute('aria-controls'));
  if (!form) return;
  form.hidden = false;
  document.querySelectorAll(`[aria-controls="${form.id}"]`).forEach((el) => el.setAttribute('aria-expanded', 'true'));
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  form.querySelector('input:not([type="hidden"]), textarea')?.focus({ preventScroll: true });
});

if (!customElements.get('mw-review-slider')) {
  customElements.define(
    'mw-review-slider',
    class MwReviewSlider extends HTMLElement {
      connectedCallback() {
        this.slides = Array.from(this.querySelectorAll('[data-mw-review]'));
        this.querySelector('[data-mw-review-next]')?.addEventListener('click', () => {
          const index = this.slides.findIndex((slide) => !slide.hidden);
          const next = (index + 1) % this.slides.length;
          this.slides.forEach((slide, i) => (slide.hidden = i !== next));
        });
      }
    }
  );
}

/* Add to cart: opens Dawn's cart drawer when enabled, otherwise falls back to the normal
   /cart/add submit. "Buy Now" buttons (name="return_to") always submit natively to checkout. */
if (!window.mwAddToCartBound) {
  window.mwAddToCartBound = true;

  document.addEventListener('submit', (event) => {
    const form = event.target.closest('form[data-mw-add]');
    if (!form || event.submitter?.name === 'return_to') return;

    const cartDrawer = document.querySelector('cart-drawer');
    if (!cartDrawer || typeof cartDrawer.renderContents !== 'function') return;

    event.preventDefault();
    const button = event.submitter || form.querySelector('[type="submit"]');
    button?.setAttribute('aria-busy', 'true');

    const formData = new FormData(form);
    formData.append(
      'sections',
      cartDrawer.getSectionsToRender().map((section) => section.id)
    );
    formData.append('sections_url', window.location.pathname);

    fetch(window.routes?.cart_add_url || '/cart/add', {
      method: 'POST',
      headers: { Accept: 'application/javascript', 'X-Requested-With': 'XMLHttpRequest' },
      body: formData,
    })
      .then((response) => response.json())
      .then((state) => {
        if (state.status) {
          window.alert(state.description || state.message);
          return;
        }
        cartDrawer.classList.remove('is-empty');
        cartDrawer.renderContents(state);
      })
      .catch(() => form.submit())
      .finally(() => button?.removeAttribute('aria-busy'));
  });
}
