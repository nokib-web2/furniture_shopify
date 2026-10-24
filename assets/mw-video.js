/* Meldwood tutorial popup player.
   Any element with [data-mw-video-open] inside a [data-mw-video] container opens the
   player markup from that container's <template data-mw-video-template> in a dialog.
   Closing the dialog removes the player, which stops the video. */
(() => {
  if (window.mwVideoBound) return;
  window.mwVideoBound = true;

  let dialog;
  let lastTrigger;

  const getDialog = () => {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'mw mw-video-modal';
    dialog.setAttribute('aria-label', 'Video');
    dialog.innerHTML =
      '<button type="button" class="mw-video-modal__close" aria-label="Close video">&times;</button><div class="mw-video-modal__body"></div>';
    document.body.append(dialog);

    dialog.querySelector('.mw-video-modal__close').addEventListener('click', () => dialog.close());
    // Click on the dark backdrop (outside the content) closes the popup.
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.querySelector('.mw-video-modal__body').innerHTML = '';
      document.documentElement.style.overflow = '';
      lastTrigger?.focus();
    });
    return dialog;
  };

  const open = (trigger) => {
    const container = trigger.closest('[data-mw-video]');
    const template = container?.querySelector('template[data-mw-video-template]');
    if (!template) return;

    const modal = getDialog();
    const body = modal.querySelector('.mw-video-modal__body');
    body.innerHTML = '';
    body.append(template.content.cloneNode(true));
    lastTrigger = trigger;
    document.documentElement.style.overflow = 'hidden';
    modal.showModal();

    const video = body.querySelector('video');
    if (video) {
      video.play().catch(() => {});
    }
  };

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-mw-video-open]');
    if (!trigger) return;
    event.preventDefault();
    open(trigger);
  });
})();
