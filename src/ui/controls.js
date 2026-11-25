import { CAMERA_PRESETS } from '../scene/cameraPresets.js';
import { ARENA_FACTS } from '../config/stadiumConfig.js';
import { flyTo } from '../scene/cameraController.js';
import { QUALITY_LEVELS, QUALITY_MODE, normalizeQualityMode } from '../config/renderQuality.js';

const formatCapacity = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

const TOOLBAR_PRESETS = ['overview', 'exterior', 'fieldLevel'];

/**
 * Toolbar + info panel.
 *
 * args.camera, args.controls  — used for the camera flights
 * args.onViewReset(key)       — called after a preset button is pressed
 * args.onOpenBillboards(btn)  — called when the Billboards button is pressed
 * args.onOpenAbout(btn)       — called when the About button is pressed
 */
export function createUI(args) {
  const camera = args.camera;
  const controls = args.controls;
  const onViewReset = typeof args.onViewReset === 'function' ? args.onViewReset : function () {};
  const onOpenBillboards = typeof args.onOpenBillboards === 'function' ? args.onOpenBillboards : function () {};
  const onOpenAbout = typeof args.onOpenAbout === 'function' ? args.onOpenAbout : function () {};
  const onWalkMode = typeof args.onWalkMode === 'function' ? args.onWalkMode : function () {};
  const onSceneMode = typeof args.onSceneMode === 'function' ? args.onSceneMode : function () {};
  const onArenaStyle = typeof args.onArenaStyle === 'function' ? args.onArenaStyle : function () {};
  const initialArenaStyle = args.arenaStyle === 'cyber' ? 'cyber' : 'jets';
  const initialSceneMode = normalizeQualityMode(args.sceneMode);
  const initialDeviceNotice = String(args.deviceNotice || '');

  const toolbar = document.createElement('div');
  toolbar.id = 'toolbar';

  const brand = document.createElement('div');
  brand.className = 'brand';
  brand.innerHTML = 'Canada Life <span>Centre</span>';
  toolbar.appendChild(brand);

  const buttons = {};

  const leftTools = document.createElement('div');
  leftTools.className = 'toolbar-left-tools';
  toolbar.appendChild(leftTools);

  function setActive(key) {
    Object.keys(buttons).forEach(function (k) {
      buttons[k].classList.toggle('active', k === key);
    });
  }

  function flyToPreset(key, preset) {
    flyTo(camera, controls, preset.position, preset.target, 800, key);
  }

  TOOLBAR_PRESETS.forEach(function (key) {
    const preset = CAMERA_PRESETS[key];
    if (!preset) return;
    const btn = document.createElement('button');
    btn.textContent = preset.label;
    if (key === 'overview') btn.classList.add('active');
    btn.addEventListener('click', function () {
      setActive(key);
      onViewReset(key);
      flyToPreset(key, preset);
    });
    leftTools.appendChild(btn);
    buttons[key] = btn;
  });

  const walkBtn = document.createElement('button');
  walkBtn.className = 'walk-mode-button';
  walkBtn.textContent = CAMERA_PRESETS.walk.label;
  walkBtn.hidden = args.walkAvailable === false;
  walkBtn.addEventListener('click', function () {
    onWalkMode();
  });
  leftTools.appendChild(walkBtn);
  buttons.walk = walkBtn;

  const rightTools = document.createElement('div');
  rightTools.className = 'toolbar-right-tools';
  toolbar.appendChild(rightTools);

  const billboardBtn = document.createElement('button');
  billboardBtn.className = 'toolbar-billboards';
  billboardBtn.innerHTML = 'Fan Flags <span class="toolbar-badge" data-field="count" style="display:none">0</span>';
  const billboardBadge = billboardBtn.querySelector('[data-field="count"]');
  billboardBtn.addEventListener('click', function () {
    onOpenBillboards(billboardBtn);
  });
  rightTools.appendChild(billboardBtn);

  const aboutBtn = document.createElement('button');
  aboutBtn.className = 'toolbar-about';
  aboutBtn.textContent = 'About';
  aboutBtn.addEventListener('click', function () { onOpenAbout(aboutBtn); });
  rightTools.appendChild(aboutBtn);

  const styleLabel = document.createElement('label');
  styleLabel.className = 'scene-mode-control scene-style-control';
  styleLabel.textContent = 'STYLE';
  const styleSelect = document.createElement('select');
  styleSelect.className = 'scene-mode-select scene-style-select';
  styleSelect.setAttribute('aria-label', 'Arena visual style');
  [['jets', 'Jets Classic'], ['cyber', 'Cyber Neon']].forEach(function ([value, label]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    styleSelect.appendChild(option);
  });
  styleSelect.value = initialArenaStyle;
  styleSelect.addEventListener('change', function () { onArenaStyle(styleSelect.value); });
  styleLabel.appendChild(styleSelect);
  rightTools.appendChild(styleLabel);

  const qualityLabel = document.createElement('label');
  qualityLabel.className = 'scene-mode-control scene-quality-control';
  qualityLabel.textContent = 'QUALITY';
  const sceneModeSelect = document.createElement('select');
  sceneModeSelect.className = 'scene-mode-select scene-quality-select';
  sceneModeSelect.setAttribute('aria-label', 'Arena quality level');
  QUALITY_LEVELS.forEach(function (quality) {
    const option = document.createElement('option');
    option.value = String(quality.id);
    option.textContent = quality.label;
    option.title = quality.description;
    sceneModeSelect.appendChild(option);
  });
  sceneModeSelect.value = String(initialSceneMode);

  const deviceNotice = document.createElement('span');
  deviceNotice.className = 'device-tier-note';
  deviceNotice.setAttribute('role', 'status');
  deviceNotice.textContent = initialDeviceNotice === 'Lite auto-selected for this device'
    ? 'Auto: Lite'
    : initialDeviceNotice;
  if (initialDeviceNotice) {
    deviceNotice.title = initialDeviceNotice;
    deviceNotice.setAttribute('aria-label', initialDeviceNotice);
  }
  deviceNotice.hidden = !initialDeviceNotice;

  let currentSceneMode = initialSceneMode;
  let ultraConsentGranted = false;
  const ultraConsentKey = 'canada-life-centre:ultra-consent:v1';
  try {
    ultraConsentGranted = window.sessionStorage.getItem(ultraConsentKey) === 'granted';
  } catch (_error) {
    ultraConsentGranted = false;
  }

  const ultraDialog = document.createElement('div');
  ultraDialog.className = 'quality-dialog-backdrop';
  ultraDialog.hidden = true;
  ultraDialog.innerHTML = `
    <section class="quality-dialog" role="dialog" aria-modal="true" aria-labelledby="quality-dialog-title" aria-describedby="quality-dialog-copy">
      <p class="quality-dialog__eyebrow">Performance notice</p>
      <h2 id="quality-dialog-title">Switch to Ultra?</h2>
      <p id="quality-dialog-copy">Ultra enables maximum detail, extra arena objects and dynamic show effects. This can lower FPS and increase GPU and CPU load, especially on less powerful devices.</p>
      <div class="quality-dialog__actions">
        <button class="quality-dialog__cancel" type="button">Stay on Current</button>
        <button class="quality-dialog__confirm" type="button">Continue to Ultra</button>
      </div>
    </section>
  `;
  document.body.appendChild(ultraDialog);

  function setQuality(mode) {
    currentSceneMode = normalizeQualityMode(mode);
    sceneModeSelect.value = String(currentSceneMode);
    onSceneMode(currentSceneMode);
  }

  function closeUltraDialog() {
    ultraDialog.hidden = true;
    sceneModeSelect.value = String(currentSceneMode);
  }

  const stayOnCurrentButton = ultraDialog.querySelector('.quality-dialog__cancel');
  const continueToUltraButton = ultraDialog.querySelector('.quality-dialog__confirm');
  stayOnCurrentButton.addEventListener('click', closeUltraDialog);
  continueToUltraButton.addEventListener('click', function () {
    ultraConsentGranted = true;
    try {
      window.sessionStorage.setItem(ultraConsentKey, 'granted');
    } catch (_error) {
      // Keep the user's consent in memory for this page if session storage is unavailable.
    }
    closeUltraDialog();
    deviceNotice.hidden = true;
    setQuality(QUALITY_MODE.ULTRA);
  });
  ultraDialog.addEventListener('click', function (event) {
    if (event.target === ultraDialog) closeUltraDialog();
  });
  ultraDialog.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeUltraDialog();
      sceneModeSelect.focus();
    }
  });

  sceneModeSelect.addEventListener('change', function () {
    const requestedMode = normalizeQualityMode(sceneModeSelect.value);
    if (requestedMode === QUALITY_MODE.ULTRA && currentSceneMode !== QUALITY_MODE.ULTRA && !ultraConsentGranted) {
      sceneModeSelect.value = String(currentSceneMode);
      ultraDialog.hidden = false;
      stayOnCurrentButton.focus();
      return;
    }
    if (requestedMode !== currentSceneMode) deviceNotice.hidden = true;
    setQuality(requestedMode);
  });
  qualityLabel.appendChild(sceneModeSelect);
  rightTools.append(qualityLabel, deviceNotice);

  document.getElementById('app').appendChild(toolbar);

  const info = document.createElement('div');
  info.id = 'info-panel';
  info.innerHTML = `
    <h3>Canada Life Centre — Winnipeg, MB</h3>
    <p><span class="tag">NHL</span> Home of the Winnipeg Jets · ${formatCapacity(ARENA_FACTS.capacity)} seats</p>
    <p><span class="tag">ARENA</span> Opened ${ARENA_FACTS.opened} · ${ARENA_FACTS.levels.join(' / ')} levels</p>
    <p><span class="tag">TIP</span> Click a seat to see its view and estimated ticket price. Press Esc to step back.</p>
  `;
  document.getElementById('app').appendChild(info);

  return {
    setActive,
    setWalkMode: function (active) {
      walkBtn.textContent = active ? 'Exit Walk / Jump' : CAMERA_PRESETS.walk.label;
      walkBtn.classList.toggle('active', !!active);
      if (active) setActive('walk');
    },
    setWalkAvailable: function (available) {
      walkBtn.hidden = !available;
      if (!available) {
        walkBtn.classList.remove('active');
        walkBtn.textContent = CAMERA_PRESETS.walk.label;
      }
    },
    setBillboardsOpen: function (open) {
      billboardBtn.classList.toggle('active', !!open);
    },
    setBillboardCount: function (n) {
      const num = Number(n) || 0;
      billboardBadge.textContent = String(num);
      billboardBadge.style.display = num > 0 ? '' : 'none';
    },
    setSceneMode: function (mode) {
      currentSceneMode = normalizeQualityMode(mode);
      sceneModeSelect.value = String(currentSceneMode);
    },
    setArenaStyle: function (style) {
      styleSelect.value = style === 'cyber' ? 'cyber' : 'jets';
    }
  };
}
