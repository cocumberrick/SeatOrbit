/**
 * BookingUI — Seat Card + notice toast + Overview section tooltip + Billboard panel.
 *
 * The app never sells tickets. The Seat Card offers:
 *   - An outbound "Find Tickets on Ticketmaster" link (when a URL is configured).
 *   - A Photo Billboard flow (demo: $2.00 CAD value, no payment collected, stored locally).
 */

import { processPhoto } from './photoUpload.js';
import { STRIPE_FAN_FLAG_PAYMENT_CONFIGURED } from '../config/fanFlagPaymentConfig.js';

const NOTICE_DURATION_MS = 3200;

export function formatCad(amount) {
  return '$' + Number(amount).toFixed(2) + ' CAD';
}

export class BookingUI {
  constructor(container, handlers) {
    this.container = container;
    this.handlers = Object.assign({
      onCloseSeatCard: function () {},
      onSavePhoto: function () { return { ok: true }; },
      onCheckoutPhoto: function () { return { configured: false }; },
      onRemovePhoto: function () { return { ok: true }; },
      onViewIn3D: function () {},
      onTicketsClick: function () {},
      onPanelChange: function () {}
    }, handlers || {});
    this.noticeTimer = null;
    this.billboardRows = [];
    this.billboardSummary = null;
    this.currentSeat = null;
    this.panelOpen = false;
    this._uploading = false;
    this._seatCardCollapsed = false;
    this._seatCardCollapsing = false;
    this._seatCardTransitionTimer = null;
    this._seatCardTransitionHandler = null;

    this.root = document.createElement('div');
    this.root.className = 'booking-root';

    this.seatCard = this.buildSeatCard();
    this.seatCard.element.id = 'selected-seat-card';
    this.root.appendChild(this.seatCard.element);

    this.seatRestoreButton = document.createElement('button');
    this.seatRestoreButton.type = 'button';
    this.seatRestoreButton.className = 'seat-card-restore';
    this.seatRestoreButton.textContent = '•••';
    this.seatRestoreButton.setAttribute('aria-label', 'Show selected seat details');
    this.seatRestoreButton.setAttribute('aria-controls', this.seatCard.element.id);
    this.seatRestoreButton.setAttribute('aria-expanded', 'true');
    this.seatRestoreButton.setAttribute('aria-hidden', 'true');
    this.seatRestoreButton.tabIndex = -1;
    this.seatRestoreButton.addEventListener('click', () => this.expandSeatCard());
    this.root.appendChild(this.seatRestoreButton);

    this.sectionCard = this.buildSectionCard();
    this.root.appendChild(this.sectionCard.element);

    this.billboardPanel = this.buildBillboardPanel();
    this.root.appendChild(this.billboardPanel.element);

    this.aboutDialog = this.buildAboutDialog();

    this.toast = document.createElement('div');
    this.toast.className = 'booking-toast';
    this.toast.setAttribute('role', 'status');
    this.toast.setAttribute('aria-live', 'polite');

    this.sectionTooltip = this.buildSectionTooltip();

    this.hintText = '';
    this.viewHint = document.createElement('div');
    this.viewHint.className = 'view-hint';
    this.viewHint.setAttribute('role', 'status');
    this.viewHint.setAttribute('aria-live', 'polite');
    this.viewHint.hidden = true;
    this.container.classList.remove('has-collapsed-seat-card');

    container.appendChild(this.root);
    container.appendChild(this.toast);
    container.appendChild(this.sectionTooltip);
    container.appendChild(this.viewHint);
    document.body.appendChild(this.aboutDialog.element);
  }

  buildAboutDialog() {
    const paymentDescription = STRIPE_FAN_FLAG_PAYMENT_CONFIGURED
      ? 'A configured Stripe Payment Link opens external Stripe Checkout; confirm its test/live mode, currency, and $2.00 CAD price in Stripe before sharing it. After Stripe redirects back, this browser restores a local flag preview. This static site cannot verify payment, provide server-backed access, or sync the photo to other devices.'
      : 'The Stripe Payment Link is not configured yet. Photos can be saved as local demo flags in this browser; no payment is collected.';
    const backdrop = document.createElement('div');
    backdrop.className = 'about-dialog-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <section class="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" aria-describedby="about-copy">
        <button class="about-dialog__close" type="button" aria-label="Close About">&times;</button>
        <p class="about-dialog__eyebrow">SeatOrbit · Canada Life Centre, Winnipeg</p>
        <h2 id="about-title">Explore the arena in 3D</h2>
        <p id="about-copy">SeatOrbit is an independent interactive 3D platform for exploring arenas and browsing seats. Canada Life Centre in Winnipeg is our first demonstration venue. Explore sections, select a seat, and preview its view.</p>
        <div class="about-dialog__grid">
          <article><h3>Views</h3><p>Arena Overview, Exterior View, and Ice Level with a 360° view from above the ice. Walk / Jump Mode is available on desktop.</p></article>
          <article><h3>Make it yours</h3><p>Switch between Jets Classic and Cyber Neon, then choose Lite, Standard, or Ultra to balance visual detail and performance.</p></article>
          <article><h3>Fan Flags</h3><p>Add a photo flag to a selected seat. Flags are saved in this browser on this device and remain visible in Lite mode. ${paymentDescription}</p></article>
        </div>
        <p class="about-dialog__disclaimer"><strong>Payment and ticketing notice:</strong> SeatOrbit is not the official box office of Canada Life Centre or the Winnipeg Jets and does not sell or reserve tickets. Ticket purchases are completed through external ticket operators. Fan flags, when configured, use an external Stripe Payment Link; this browser-only platform cannot verify payments or provide server-backed fulfillment. Saved fan photos remain in this browser. Seat prices are estimates; confirm event details, price, fees, and availability with the ticket operator.</p>
        <p class="about-dialog__copyright">© 2026 Danylo Marushchak. All rights reserved.</p>
        <p class="about-dialog__footnote">SeatOrbit is an independent project and is not affiliated with or endorsed by Canada Life Centre, True North Sports + Entertainment, the NHL, or the Winnipeg Jets.</p>
      </section>
    `;
    const closeButton = backdrop.querySelector('.about-dialog__close');
    closeButton.addEventListener('click', () => this.closeAbout());
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop) this.closeAbout();
    });
    return { element: backdrop, closeButton, trigger: null };
  }

  closeAbout() {
    if (!this.aboutDialog || this.aboutDialog.element.hidden) return false;
    this.aboutDialog.element.hidden = true;
    const trigger = this.aboutDialog.trigger;
    this.aboutDialog.trigger = null;
    if (trigger && typeof trigger.focus === 'function') trigger.focus();
    return true;
  }

  /* ---------- Section tooltip (Overview hover) ---------- */

  buildSectionTooltip() {
    const element = document.createElement('div');
    element.className = 'section-tooltip';
    element.setAttribute('role', 'tooltip');
    element.style.cssText = [
      'position:fixed', 'left:0', 'top:0', 'display:none', 'z-index:30',
      'padding:6px 12px', 'border-radius:6px', 'white-space:normal', 'text-align:center',
      'max-width:calc(100vw - 16px)', 'transform:translateX(-50%)',
      'background:rgba(4,30,66,0.96)', 'color:#ffffff',
      'border:1px solid rgba(142,144,144,0.72)',
      'font:600 13px/1.3 system-ui,sans-serif', 'pointer-events:none',
      'box-shadow:0 4px 14px rgba(0,0,0,0.45)'
    ].join(';');
    return element;
  }

  showSectionTooltip(label, minPrice, clientX, clientY) {
    const tip = this.sectionTooltip;
    const text = 'Section ' + label + ' - From ' + formatCad(minPrice);
    if (tip.textContent !== text) tip.textContent = text;
    tip.style.display = 'block';
    const maxWidth = Math.max(1, Math.min(320, window.innerWidth - 16));
    const halfWidth = maxWidth / 2;
    const centerX = Math.max(halfWidth + 8, Math.min(window.innerWidth - halfWidth - 8, clientX));
    const top = Math.max(8, Math.min(window.innerHeight - 56, clientY + 18));
    tip.style.left = centerX + 'px';
    tip.style.top = top + 'px';
  }

  hideSectionTooltip() {
    this.sectionTooltip.style.display = 'none';
  }

  buildSectionCard() {
    const element = document.createElement('aside');
    element.className = 'section-card';
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = `
      <button class="seat-card__close" type="button" aria-label="Close section details">&times;</button>
      <p class="section-card__eyebrow">Section overview</p>
      <h3 class="section-card__title" data-field="section">Section</h3>
      <p class="section-card__tier" data-field="tier"></p>
      <p class="section-card__summary" data-field="summary"></p>
      <div class="section-card__premium" data-field="premium" hidden>
        <span class="section-card__premium-badge">VIP experience</span>
        <strong>Premium Suite Lounge nearby</strong>
        <span>Glass-fronted lounge with dining and a bar. Access may require a premium ticket.</span>
      </div>
      <p class="section-card__hint">Select a seat to see its view and details.</p>
      <a class="btn btn--primary" data-field="tickets" target="_blank" rel="noopener noreferrer">Browse Ticketmaster</a>
    `;
    const fields = {
      section: element.querySelector('[data-field="section"]'),
      tier: element.querySelector('[data-field="tier"]'),
      summary: element.querySelector('[data-field="summary"]'),
      premium: element.querySelector('[data-field="premium"]'),
      tickets: element.querySelector('[data-field="tickets"]')
    };
    element.querySelector('.seat-card__close').addEventListener('click', () => this.hideSectionCard());
    fields.tickets.addEventListener('click', (event) => {
      if (!fields.tickets.getAttribute('href')) event.preventDefault();
    });
    return { element, fields };
  }

  showSectionCard(info) {
    const f = this.sectionCard.fields;
    f.section.textContent = 'Section ' + info.section;
    f.tier.textContent = info.tierName;
    const price = info.minPrice === null ? 'Price not listed' : 'From ' + formatCad(info.minPrice);
    f.summary.textContent = info.count + ' seats · ' + price;
    f.premium.hidden = !info.premium;
    if (info.ticketUrl) {
      f.tickets.href = info.ticketUrl;
      f.tickets.removeAttribute('aria-disabled');
      f.tickets.style.opacity = '';
    } else {
      f.tickets.removeAttribute('href');
      f.tickets.setAttribute('aria-disabled', 'true');
      f.tickets.style.opacity = '0.55';
      f.tickets.textContent = 'Ticket link not configured';
    }
    this.hideSeatCard();
    this.sectionCard.element.classList.add('is-visible');
    this.sectionCard.element.setAttribute('aria-hidden', 'false');
  }

  hideSectionCard() {
    if (!this.sectionCard) return;
    this.sectionCard.element.classList.remove('is-visible');
    this.sectionCard.element.setAttribute('aria-hidden', 'true');
  }

  /* ---------- Seat Card ---------- */

  buildSeatCard() {
    const element = document.createElement('aside');
    element.className = 'seat-card';
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = `
      <button class="seat-card__close" type="button" aria-label="Close seat details">&times;</button>
      <h3 class="seat-card__title">Selected Seat</h3>
      <dl class="seat-card__details">
        <dt>Section</dt><dd data-field="section">&ndash;</dd>
        <dt>Row</dt><dd data-field="row">&ndash;</dd>
        <dt>Seat</dt><dd data-field="seat">&ndash;</dd>
        <dt>Estimated Price</dt><dd data-field="price">&ndash;</dd>
      </dl>
      <p class="seat-card__hint">Estimated price. Confirm the final price on Ticketmaster.</p>
      <a class="btn btn--primary" data-field="tickets" target="_blank" rel="noopener noreferrer"
         style="display:block;text-align:center;text-decoration:none;">Find Tickets on Ticketmaster</a>
      <div class="seat-card__photo" data-field="photo"></div>
    `;

    const field = function (name) { return element.querySelector('[data-field="' + name + '"]'); };
    const fields = {
      section: field('section'),
      row: field('row'),
      seat: field('seat'),
      price: field('price'),
      tickets: field('tickets'),
      photo: field('photo')
    };

    const self = this;
    element.querySelector('.seat-card__close').addEventListener('click', function () {
      self.collapseSeatCard();
    });
    fields.tickets.addEventListener('click', function (event) {
      if (!fields.tickets.getAttribute('href')) {
        event.preventDefault();
        return;
      }
      const seat = self.currentSeat;
      if (seat) self.handlers.onTicketsClick({ section: seat.section, row: seat.row, seat: seat.seat });
    });

    return { element, fields };
  }

  showSeatCard(info) {
    const shouldExpand = this._seatCardCollapsed || this.seatCard.element.classList.contains('is-collapsing');
    this.hideSectionCard();
    const f = this.seatCard.fields;
    this.currentSeat = info;
    f.section.textContent = info.section;
    f.row.textContent = info.row;
    f.seat.textContent = info.seat;
    f.price.textContent = formatCad(info.price);

    if (info.ticketUrl) {
      f.tickets.setAttribute('href', info.ticketUrl);
      f.tickets.removeAttribute('aria-disabled');
      f.tickets.style.opacity = '';
      f.tickets.textContent = 'Find Tickets on Ticketmaster';
    } else {
      f.tickets.removeAttribute('href');
      f.tickets.setAttribute('aria-disabled', 'true');
      f.tickets.style.opacity = '0.55';
      f.tickets.textContent = 'Ticket link not configured.';
    }

    this.renderPhotoSection(info);

    this.seatCard.element.classList.add('is-visible');
    this.seatCard.element.setAttribute('aria-hidden', 'false');
    if (shouldExpand) this.expandSeatCard();
    this.updateHintVisibility();
  }

  hideSeatCard() {
    this.cancelSeatCardTransition();
    this._seatCardCollapsed = false;
    this._seatCardCollapsing = false;
    this.currentSeat = null;
    this.seatCard.element.classList.remove('is-visible');
    this.seatCard.element.classList.remove('is-collapsing', 'is-expanding');
    this.seatCard.element.style.removeProperty('--seat-collapse-x');
    this.seatCard.element.style.removeProperty('--seat-collapse-y');
    this.seatCard.element.style.removeProperty('--seat-collapse-sx');
    this.seatCard.element.style.removeProperty('--seat-collapse-sy');
    this.seatCard.element.setAttribute('aria-hidden', 'true');
    this.seatRestoreButton.classList.remove('is-visible');
    this.seatRestoreButton.setAttribute('aria-expanded', 'true');
    this.seatRestoreButton.setAttribute('aria-hidden', 'true');
    this.seatRestoreButton.tabIndex = -1;
    this.container.classList.remove('has-collapsed-seat-card');
    this.updateHintVisibility();
  }

  collapseSeatCard() {
    const element = this.seatCard.element;
    if (!this.currentSeat || !element.classList.contains('is-visible') || this._seatCardCollapsed || this._seatCardCollapsing) return;

    const cardRect = element.getBoundingClientRect();
    const targetRect = this.seatRestoreButton.getBoundingClientRect();
    element.style.setProperty('--seat-collapse-x', (targetRect.left - cardRect.left) + 'px');
    element.style.setProperty('--seat-collapse-y', (targetRect.top - cardRect.top) + 'px');
    element.style.setProperty('--seat-collapse-sx', String(targetRect.width / Math.max(cardRect.width, 1)));
    element.style.setProperty('--seat-collapse-sy', String(targetRect.height / Math.max(cardRect.height, 1)));

    this._seatCardCollapsing = true;
    this.seatRestoreButton.classList.add('is-visible');
    this.seatRestoreButton.setAttribute('aria-expanded', 'false');
    this.seatRestoreButton.setAttribute('aria-hidden', 'false');
    this.seatRestoreButton.tabIndex = 0;
    element.classList.add('is-collapsing');
    element.setAttribute('aria-hidden', 'true');
    this.seatRestoreButton.focus({ preventScroll: true });
    this.updateHintVisibility();

    const finish = (event) => {
      if (event && (event.target !== element || event.propertyName !== 'transform')) return;
      this.finishSeatCardCollapse();
    };
    this._seatCardTransitionHandler = finish;
    element.addEventListener('transitionend', finish);
    this._seatCardTransitionTimer = window.setTimeout(() => finish(), 430);
  }

  finishSeatCardCollapse() {
    if (!this._seatCardCollapsing) return;
    this.cancelSeatCardTransition();
    this._seatCardCollapsing = false;
    this._seatCardCollapsed = true;
    this.seatCard.element.classList.remove('is-collapsing', 'is-visible');
    this.seatCard.element.setAttribute('aria-hidden', 'true');
    this.seatCard.element.style.removeProperty('--seat-collapse-x');
    this.seatCard.element.style.removeProperty('--seat-collapse-y');
    this.seatCard.element.style.removeProperty('--seat-collapse-sx');
    this.seatCard.element.style.removeProperty('--seat-collapse-sy');
    this.container.classList.add('has-collapsed-seat-card');
    this.seatRestoreButton.focus({ preventScroll: true });
    this.updateHintVisibility();
  }

  expandSeatCard() {
    const element = this.seatCard.element;
    const wasCollapsing = element.classList.contains('is-collapsing');
    if (!this.currentSeat || (!this._seatCardCollapsed && !wasCollapsing)) return;

    this.cancelSeatCardTransition();
    this._seatCardCollapsing = false;
    this._seatCardCollapsed = false;
    this.container.classList.remove('has-collapsed-seat-card');
    this.seatRestoreButton.classList.remove('is-visible');
    this.seatRestoreButton.setAttribute('aria-expanded', 'true');
    this.seatRestoreButton.setAttribute('aria-hidden', 'true');
    this.seatRestoreButton.tabIndex = -1;

    if (wasCollapsing) {
      element.classList.remove('is-collapsing');
      element.style.removeProperty('--seat-collapse-x');
      element.style.removeProperty('--seat-collapse-y');
      element.style.removeProperty('--seat-collapse-sx');
      element.style.removeProperty('--seat-collapse-sy');
    } else {
      element.classList.add('is-visible');
      const cardRect = element.getBoundingClientRect();
      const buttonRect = this.seatRestoreButton.getBoundingClientRect();
      element.style.transition = 'none';
      element.style.transform = 'translate3d(' + (buttonRect.left - cardRect.left) + 'px, ' + (buttonRect.top - cardRect.top) + 'px, 0) scale(' + (buttonRect.width / Math.max(cardRect.width, 1)) + ', ' + (buttonRect.height / Math.max(cardRect.height, 1)) + ')';
      element.style.opacity = '0';
      void element.offsetWidth;
      element.style.removeProperty('transition');
      element.style.removeProperty('transform');
      element.style.removeProperty('opacity');
    }
    element.setAttribute('aria-hidden', 'false');
    const closeButton = element.querySelector('.seat-card__close');
    if (closeButton) closeButton.focus({ preventScroll: true });
    this.updateHintVisibility();
  }

  cancelSeatCardTransition() {
    if (this._seatCardTransitionTimer !== null) {
      clearTimeout(this._seatCardTransitionTimer);
      this._seatCardTransitionTimer = null;
    }
    if (this._seatCardTransitionHandler) {
      this.seatCard.element.removeEventListener('transitionend', this._seatCardTransitionHandler);
      this._seatCardTransitionHandler = null;
    }
  }

  setHint(text) {
    this.hintText = String(text || '');
    const isCompactScreen = window.matchMedia
      ? window.matchMedia('(max-width: 768px), (pointer: coarse)').matches
      : window.innerWidth <= 768;
    let displayText = this.hintText;
    if (isCompactScreen) {
      displayText = displayText
        .replace('Drag to look around the field. Press Esc to return.', 'Swipe to look around the ice.')
        .replace('Press Esc to return.', '')
        .trim();
    }
    this.viewHint.textContent = displayText;
    this.updateHintVisibility();
  }

  updateHintVisibility() {
    if (!this.viewHint) return;
    const cardExpanded = this.seatCard.element.classList.contains('is-visible') && !this._seatCardCollapsed && !this._seatCardCollapsing;
    this.viewHint.hidden = !this.hintText || cardExpanded;
    this.viewHint.setAttribute('aria-hidden', this.viewHint.hidden ? 'true' : 'false');
    this.container.classList.toggle('has-collapsed-seat-card', this._seatCardCollapsed);
  }

  renderPhotoSection(info) {
    const el = this.seatCard.fields.photo;
    if (!el) return;
    el.innerHTML = '';

    if (info.billboard) {
      el.classList.add('has-photo');
      const thumb = document.createElement('img');
      thumb.className = 'seat-card__photo-preview';
      thumb.src = info.billboard.dataUrl;
      thumb.alt = 'Photo displayed on a fan flag';
      el.appendChild(thumb);

      const paymentStatus = document.createElement('p');
      paymentStatus.className = 'seat-card__photo-notice';
      paymentStatus.textContent = STRIPE_FAN_FLAG_PAYMENT_CONFIGURED
        ? 'Local flag display only. Stripe payment is not verified by this site.'
        : 'Stored in this browser. This site has no payment record for this flag.';
      el.appendChild(paymentStatus);

      const actions = document.createElement('div');
      actions.className = 'seat-card__photo-actions';

      const changeBtn = document.createElement('button');
      changeBtn.type = 'button';
      changeBtn.className = 'btn btn--secondary btn--small';
      changeBtn.textContent = 'Change Photo';
      changeBtn.addEventListener('click', () => this.handlePhotoUpload(info));
      actions.appendChild(changeBtn);

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn--danger btn--small';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => this.handlePhotoRemove(info));
      actions.appendChild(removeBtn);

      el.appendChild(actions);
    } else {
      el.classList.remove('has-photo');
      const notice = document.createElement('p');
      notice.className = 'seat-card__photo-notice';
      notice.textContent = STRIPE_FAN_FLAG_PAYMENT_CONFIGURED
        ? 'Choose a photo to prepare a $2.00 CAD Stripe checkout. After returning, this browser restores a local flag preview; payment is not verified here.'
        : 'Add a local demo fan flag at this seat for $2.00 CAD. No payment is collected until a Stripe link is configured.';
      el.appendChild(notice);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn btn--primary btn--small';
      addBtn.textContent = STRIPE_FAN_FLAG_PAYMENT_CONFIGURED
        ? 'Choose Photo & Pay $2.00 CAD'
        : 'Save Local Demo Photo';
      addBtn.addEventListener('click', () => this.handlePhotoUpload(info));
      el.appendChild(addBtn);
    }
  }

  handlePhotoUpload(info) {
    if (this._uploading) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/jpeg,image/png,image/webp';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.addEventListener('change', async () => {
      const file = input.files && input.files[0];
      input.remove();
      if (!file) return;
      this._uploading = true;
      try {
        this.showNotice('Processing photo\u2026', 'info');
        const result = await processPhoto(file);
        if (!result.ok) {
          this.showNotice(result.message || 'Could not process that photo.', 'warning');
          return;
        }
        const target = { seatId: info.seatId, section: info.section, row: info.row, seat: info.seat };
        if (!info.billboard) {
          const checkout = this.handlers.onCheckoutPhoto(target, result.dataUrl);
          if (checkout && checkout.configured) {
            if (checkout.ok === false || !checkout.url) {
              this.showNotice(checkout.message || 'Could not start Stripe checkout.', 'warning');
              return;
            }
            this.showNotice('Photo prepared. Opening external Stripe Checkout\u2026', 'info');
            window.location.assign(checkout.url);
            return;
          }
        }
        const saveResult = this.handlers.onSavePhoto(target, result.dataUrl);
        if (saveResult && saveResult.ok === false) {
          this.showNotice(saveResult.message || 'Could not save the photo.', 'warning');
          return;
        }
        this.showNotice(
          STRIPE_FAN_FLAG_PAYMENT_CONFIGURED
            ? 'Fan flag saved locally on this device. Payment is not verified by this site.'
            : 'Fan flag saved locally as a demo. No payment was collected.',
          'success'
        );
      } finally {
        this._uploading = false;
      }
    });

    input.click();
  }

  handlePhotoRemove(info) {
    const result = this.handlers.onRemovePhoto(info.seatId);
    if (result && result.ok === false) {
      this.showNotice(result.message || 'Could not remove the photo.', 'warning');
      return;
    }
    this.showNotice('Fan flag photo removed.', 'info');
  }

  /* ---------- Billboard panel ---------- */

  buildBillboardPanel() {
    const element = document.createElement('aside');
    element.className = 'billboard-panel';
    element.setAttribute('aria-hidden', 'true');
    element.innerHTML = `
      <header class="billboard-panel__header">
        <h3>Your Fan Flags</h3>
        <button class="billboard-panel__close" type="button" aria-label="Close">&times;</button>
      </header>
      <p class="billboard-panel__summary" data-field="summary">No fan flags yet.</p>
      <ul class="billboard-panel__list" data-field="list"></ul>
    `;
    const self = this;
    element.querySelector('.billboard-panel__close').addEventListener('click', function () {
      self.closePanel();
    });
    return {
      element,
      fields: {
        summary: element.querySelector('[data-field="summary"]'),
        list: element.querySelector('[data-field="list"]')
      }
    };
  }

  renderBillboards(rows, summary) {
    this.billboardRows = rows || [];
    this.billboardSummary = summary || null;
    const fields = this.billboardPanel.fields;

    if (summary && summary.count > 0) {
      fields.summary.textContent = STRIPE_FAN_FLAG_PAYMENT_CONFIGURED
        ? summary.count + (summary.count === 1 ? ' fan flag saved locally. Payment is not verified here.' : ' fan flags saved locally. Payment is not verified here.')
        : summary.count + (summary.count === 1 ? ' local demo flag saved. No payment collected.' : ' local demo flags saved. No payment collected.');
    } else {
      fields.summary.textContent = 'No fan flags yet. Select a seat to add one.';
    }

    fields.list.innerHTML = '';
    for (const row of this.billboardRows) {
      const li = document.createElement('li');
      li.className = 'billboard-item';

      const thumb = document.createElement('img');
      thumb.className = 'billboard-thumb';
      thumb.src = row.dataUrl;
      thumb.alt = '';
      li.appendChild(thumb);

      const info = document.createElement('div');
      info.className = 'billboard-item__info';
      info.innerHTML = '<strong>Sec ' + row.section + ' \u00b7 Row ' + row.row + ' \u00b7 Seat ' + row.seat + '</strong>';
      li.appendChild(info);

      const actions = document.createElement('div');
      actions.className = 'billboard-item__actions';

      if (row.canView3D) {
        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'btn btn--small btn--secondary';
        viewBtn.textContent = 'View in 3D';
        viewBtn.addEventListener('click', () => this.handlers.onViewIn3D(row.seatId));
        actions.appendChild(viewBtn);
      }

      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'btn btn--small btn--danger';
      removeBtn.textContent = 'Remove';
      removeBtn.addEventListener('click', () => {
        const result = this.handlers.onRemovePhoto(row.seatId);
        if (result && result.ok === false) {
          this.showNotice(result.message || 'Could not remove the photo.', 'warning');
        }
      });
      actions.appendChild(removeBtn);

      li.appendChild(actions);
      fields.list.appendChild(li);
    }
  }

  togglePanel() {
    if (this.panelOpen) { this.closePanel(); return; }
    this.panelOpen = true;
    this.billboardPanel.element.classList.add('is-visible');
    this.billboardPanel.element.setAttribute('aria-hidden', 'false');
    this.handlers.onPanelChange('billboards');
  }

  closePanel() {
    if (!this.panelOpen) return false;
    this.panelOpen = false;
    this.billboardPanel.element.classList.remove('is-visible');
    this.billboardPanel.element.setAttribute('aria-hidden', 'true');
    this.handlers.onPanelChange(null);
    return true;
  }

  openAbout(trigger) {
    this.aboutDialog.trigger = trigger || document.activeElement;
    this.aboutDialog.element.hidden = false;
    this.aboutDialog.closeButton.focus();
  }

  handleEscape() {
    if (this.closeAbout()) return true;
    if (this.panelOpen) { this.closePanel(); return true; }
    return false;
  }

  /* ---------- Notices ---------- */

  showNotice(message, tone) {
    const toast = this.toast;
    toast.textContent = message;
    toast.className = 'booking-toast booking-toast--' + (tone || 'info') + ' is-visible';

    if (this.noticeTimer !== null) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(function () {
      toast.classList.remove('is-visible');
    }, NOTICE_DURATION_MS);
  }

  destroy() {
    this.cancelSeatCardTransition();
    if (this.noticeTimer !== null) clearTimeout(this.noticeTimer);
    this.container.classList.remove('has-collapsed-seat-card');
    this.root.remove();
    this.toast.remove();
    this.sectionTooltip.remove();
    this.viewHint.remove();
    this.aboutDialog.element.remove();
  }
}
