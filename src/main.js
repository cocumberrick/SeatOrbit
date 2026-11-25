import './style.css';
import * as THREE from 'three';
import { ARENA, BOWL, RINK } from './config/stadiumConfig.js';
import { CAMERA_PRESETS } from './scene/cameraPresets.js';
import { createScene, applyRenderQuality } from './scene/createScene.js';
import { createEnvironment } from './scene/createEnvironment.js';
import { createLighting } from './scene/createLighting.js';
import { flyTo, cancelFlight, isCameraFlightActive, setTargetAheadOfCamera, clampWalkCamera, clampCameraForMode } from './scene/cameraController.js';
import { createStadium } from './stadium/createStadium.js';
import { computeSectionBounds, seatKey } from './stadium/seatLayout.js';
import { getTierBackOval, getTierLayouts } from './stadium/arenaHelpers.js';
import { createUI } from './ui/controls.js';
import { BookingUI } from './ui/bookingUI.js';
import { photoBillboardsStore } from './state/photoBillboardsStore.js';
import { savePendingFanFlagCheckout, takePendingFanFlagCheckout } from './state/pendingFanFlagCheckout.js';
import { getFanFlagPaymentUrl, STRIPE_FAN_FLAG_PAYMENT_CONFIGURED } from './config/fanFlagPaymentConfig.js';
import { getTicketUrl } from './config/ticketingConfig.js';
import { detectDeviceTier } from './utils/deviceTier.js';
import { QUALITY_MODE, normalizeQualityMode } from './config/renderQuality.js';

const EYE_HEIGHT = 1.15;
const DEFAULT_ARENA_STYLE = 'jets';

const LOOK_SENSITIVITY = 0.005;
const LOOK_YAW_LIMIT = Math.PI / 3;
const LOOK_PITCH_UP = Math.PI / 6;
const LOOK_PITCH_DOWN = Math.PI / 3;
const SEAT_HINT = 'Drag to look around the field. Press Esc to return.';
const WALK_HINT = 'WASD roam the arena | Mouse look or click-drag | Space jump | Esc exit';
const WALK_SPEED = 7.5;
const WALK_GRAVITY = 24;
const WALK_JUMP_SPEED = 20;
const WALK_MAX_STEP_UP = 0.5;
const WALK_MAX_JUMP_HEIGHT = 9.5;

const OUTLINE_BASE_COLOUR = 0x8e9090;
const OUTLINE_BASE_OPACITY = 0.55;
const OUTLINE_HOVER_COLOUR = 0xac162c;
const OUTLINE_HOVER_OPACITY = 1.0;

const HOVER_MIN_INTERVAL_MS = 40;

const VIEW = { OVERVIEW: 'overview', SECTION: 'section', SEAT: 'seat', WALK: 'walk' };

function isInsideStadiumOval(x, z, oval) {
  const radius = Math.min(oval.radius, oval.halfL, oval.halfW);
  const cornerX = Math.max(0, Math.abs(x) - (oval.halfL - radius));
  const cornerZ = Math.max(0, Math.abs(z) - (oval.halfW - radius));
  return cornerX * cornerX + cornerZ * cornerZ <= radius * radius;
}

function getRoundedOvalSignedDistance(x, z, oval) {
  const radius = Math.min(oval.radius, oval.halfL, oval.halfW);
  const qx = Math.abs(x) - (oval.halfL - radius);
  const qz = Math.abs(z) - (oval.halfW - radius);
  return Math.hypot(Math.max(qx, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qz), 0) - radius;
}

function expandOval(oval, distance) {
  return {
    halfL: oval.halfL + distance,
    halfW: oval.halfW + distance,
    radius: oval.radius + distance
  };
}

function init() {
  const container = document.getElementById('app');

  const loading = document.createElement('div');
  loading.id = 'loading';
  loading.innerHTML = '<div class="spinner"></div><p>Building stadium geometry\u2026</p>';
  container.appendChild(loading);

  try {
    const sceneData = createScene(container);
    const renderer = sceneData.renderer;
    const scene = sceneData.scene;
    const camera = sceneData.camera;
    const controls = sceneData.controls;
    const mobileMediaQuery = window.matchMedia('(max-width: 768px), (pointer: coarse)');
    let mobileControls = mobileMediaQuery.matches || window.innerWidth <= 768;
    let renderFrame = 0;
    function requestRender() {
      if (renderFrame) return;
      renderFrame = requestAnimationFrame(animate);
    }
    const deviceTier = detectDeviceTier(renderer);
    const DEFAULT_SCENE_MODE = deviceTier.mode;
    applyRenderQuality(renderer, DEFAULT_SCENE_MODE);
    const defaultCameraFov = camera.fov;
    const initialPreset = CAMERA_PRESETS.overview;
    camera.position.fromArray(initialPreset.position);
    controls.target.fromArray(initialPreset.target);
    controls.update();

    const arenaEnvironment = createEnvironment(scene);
    
    // Ð˜Ð¡ÐŸÐ ÐÐ’Ð›Ð•ÐÐž: ÐŸÐµÑ€ÐµÐ´Ð°ÐµÐ¼ renderer Ð´Ð»Ñ ÑÐ¾Ð·Ð´Ð°Ð½Ð¸Ñ PMREM Ð¾ÐºÑ€ÑƒÐ¶ÐµÐ½Ð¸Ñ (Ð¾Ñ‚Ñ€Ð°Ð¶ÐµÐ½Ð¸Ð¹)
    const lights = createLighting(scene, renderer);

    const stadium = createStadium(scene, DEFAULT_SCENE_MODE, requestRender);
    const walkLayouts = getTierLayouts();
    const rinkOval = {
      halfL: RINK.LENGTH / 2,
      halfW: RINK.WIDTH / 2,
      radius: RINK.CORNER_RADIUS
    };
    const walkArenaOval = expandOval(
      getTierBackOval(walkLayouts[2]),
      ARENA.concourse2.width - 0.65
    );
    const tierBackDistances = walkLayouts.map((layout) => layout.backOffset);
    const tierFrontDistances = walkLayouts.map((layout) => layout.frontOffset - layout.cfg.rowDepth / 2);
    const walkArenaRadialLimit = getRoundedOvalSignedDistance(0, walkArenaOval.halfW, rinkOval);
    const tierConcourseFloors = [
      BOWL.fieldElevation + ARENA.concourse1.elevation,
      BOWL.fieldElevation + ARENA.concourse2.elevation,
      walkLayouts[2].baseY + walkLayouts[2].cfg.rows * walkLayouts[2].cfg.riserHeight + 0.4
    ];
    const roofGroup = scene.getObjectByName('RoofGroup');
    if (!roofGroup) console.warn('[Roof] RoofGroup not found; the roof will stay visible in Overview.');
    let videoBoardSuspension = scene.getObjectByName('VideoBoardSuspension');

    const seatMesh = stadium.getObjectByName('Seats');
    const bowl = stadium.getObjectByName('Bowl');
    if (!seatMesh) throw new Error('Seat mesh not found in the stadium.');
    const seatDistanceSoftening = seatMesh.material && seatMesh.material.userData
      ? seatMesh.material.userData.seatDistanceSoftening
      : null;

    const controller = seatMesh.userData.seatLayout;
    if (!controller) throw new Error('SeatLayoutBuilder is not attached to the seat mesh.');

    const seatData = seatMesh.userData.seatData;

    function isWalkableAt(x, z) {
      return isInsideStadiumOval(x, z, walkArenaOval);
    }

    function getWalkGroundY(x, z) {
      const distance = getRoundedOvalSignedDistance(x, z, rinkOval);
      let floorY = BOWL.fieldElevation;

      if (distance > 0) {
        for (let tierIndex = 0; tierIndex < walkLayouts.length; tierIndex++) {
          const layout = walkLayouts[tierIndex];
          const frontDistance = tierFrontDistances[tierIndex];
          const backDistance = tierBackDistances[tierIndex];
          const firstRowY = layout.baseY + layout.cfg.riserHeight;
          const lastRowY = layout.baseY + layout.cfg.rows * layout.cfg.riserHeight;

          if (distance < frontDistance) {
            const rampStart = tierIndex === 0 ? 0 : tierBackDistances[tierIndex - 1];
            const rampFloor = tierIndex === 0 ? BOWL.fieldElevation : tierConcourseFloors[tierIndex - 1];
            const rampLength = Math.max(frontDistance - rampStart, 0.001);
            const rampT = THREE.MathUtils.clamp((distance - rampStart) / rampLength, 0, 1);
            floorY = THREE.MathUtils.lerp(rampFloor, firstRowY, rampT);
            break;
          }

          if (distance <= backDistance) {
            const rowOffset = Math.max(0, distance - frontDistance);
            const rowIndex = Math.min(layout.cfg.rows - 1, Math.floor(rowOffset / layout.pitch));
            floorY = layout.baseY + (rowIndex + 1) * layout.cfg.riserHeight;
            break;
          }

          floorY = lastRowY;
        }

        if (distance > tierBackDistances[2]) {
          const rampT = THREE.MathUtils.clamp(
            (distance - tierBackDistances[2]) / Math.max(walkArenaRadialLimit - tierBackDistances[2], 0.001),
            0,
            1
          );
          floorY = THREE.MathUtils.lerp(
            walkLayouts[2].baseY + walkLayouts[2].cfg.rows * walkLayouts[2].cfg.riserHeight,
            tierConcourseFloors[2],
            rampT
          );
        }
      }

      return floorY + EYE_HEIGHT;
    }

    function canWalkMoveTo(x, z) {
      if (!isWalkableAt(x, z)) return false;
      const destinationGroundY = getWalkGroundY(x, z);
      if (walkGrounded) return destinationGroundY <= camera.position.y + WALK_MAX_STEP_UP;
      return camera.position.y >= destinationGroundY - 0.08;
    }

    const sectionBounds = seatMesh.userData.sectionBounds || computeSectionBounds(seatData);
    const sectionSummary = new Map();
    for (const seat of seatData) {
      if (!seat || seat.active === false) continue;
      let summary = sectionSummary.get(String(seat.section));
      if (!summary) {
        summary = { count: 0, minPrice: Infinity, tier: seat.tier };
        sectionSummary.set(String(seat.section), summary);
      }
      summary.count++;
      if (Number.isFinite(Number(seat.price))) summary.minPrice = Math.min(summary.minPrice, Number(seat.price));
    }

    const seatLabelKey = (section, row, seat) => section + '|' + row + '|' + seat;
    const seatByLabel = new Map();
    for (const seat of seatData) {
      if (!seat || seat.active === false) continue;
      seatByLabel.set(seatLabelKey(seat.section, seat.row, seat.seat), seat.id);
    }

    const fieldCentre = new THREE.Vector3(0, BOWL.fieldElevation, 0);
    const walkStartLook = new THREE.Vector3();
    const sectionCameraPosition = new THREE.Vector3();
    const sectionCameraTarget = new THREE.Vector3();
    const seatCameraPosition = new THREE.Vector3();
    const seatCameraTarget = new THREE.Vector3();
    const pickTargets = [seatMesh, bowl].filter(Boolean);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    let viewMode = VIEW.OVERVIEW;
    let walkYaw = 0;
    let walkPitch = 0;
    let walkVerticalVelocity = 0;
    let walkGrounded = true;
    let walkJumpRequested = false;
    const walkKeys = new Set();
    let walkDragPointerId = null;
    const walkLastPointer = { x: 0, y: 0 };
    let walkDragActive = false;
    let walkHasPointerLock = false;
    const walkForward = new THREE.Vector3();
    const walkRight = new THREE.Vector3();
    const walkMovement = new THREE.Vector3();
    const walkPreviousPosition = new THREE.Vector3();
    let lastFrameTime = performance.now();
    let fpsFrames = 0;
    let fpsWindowStart = lastFrameTime;
    let displayedFps = 0;
    let lastDebugUpdate = 0;
    let currentSection = null;
    let selection = null;
    const selectedSet = new Set();

    let toolbar = null;
    let sceneMode = DEFAULT_SCENE_MODE;
    let arenaStyle = DEFAULT_ARENA_STYLE;

    function applySceneMode(mode) {
      const nextMode = normalizeQualityMode(mode);
      const modeChanged = nextMode !== sceneMode;
      sceneMode = nextMode;
      stadium.userData.setSceneMode(sceneMode);
      videoBoardSuspension = scene.getObjectByName('VideoBoardSuspension');
      lights.setSceneMode(sceneMode);
      applyRenderQuality(renderer, sceneMode);
      document.documentElement.dataset.sceneMode = String(sceneMode);
      if (toolbar) toolbar.setSceneMode(sceneMode);
      if (modeChanged && viewMode === VIEW.OVERVIEW && activePreset === 'overview') {
        const preset = sceneMode === QUALITY_MODE.ULTRA ? CAMERA_PRESETS.gameNightOverview : CAMERA_PRESETS.overview;
        configureCameraMode('overview');
        flyTo(camera, controls, preset.position, preset.target, 850, 'overview');
      }
      requestRender();
    }

    function applyArenaStyle(style) {
      arenaStyle = style === 'cyber' ? 'cyber' : 'jets';
      stadium.userData.setArenaStyle(arenaStyle);
      lights.setArenaStyle(arenaStyle);
      arenaEnvironment.setArenaStyle(arenaStyle);
      document.documentElement.dataset.arenaStyle = arenaStyle;
      if (toolbar) toolbar.setArenaStyle(arenaStyle);
      requestRender();
    }

    const outlineGroup = seatMesh.userData.sectionOutlines || null;
    if (outlineGroup && !outlineGroup.parent) scene.add(outlineGroup);
    const outlineRaycaster = new THREE.Raycaster();
    outlineRaycaster.params.Line.threshold = 0.5;
    let hoveredOutline = null;
    let hoveredSectionLabel = null;
    const outlinePickTargets = [];
    if (outlineGroup) {
      outlineGroup.traverse((o) => { if (o.isLine || o.isMesh) outlinePickTargets.push(o); });
    }

    let activePreset = 'overview';

    let hoveredSeatId = null;
    let seatHoverCursorSet = false;
    let pendingPointer = null;
    let hoverFrame = 0;
    let lastHoverTime = 0;
    const lastHover = { x: NaN, y: NaN, mode: null };

    let seatYaw = 0;
    let seatPitch = 0;
    let initialYaw = 0;
    let initialPitch = 0;
    let isDraggingLook = false;
    let lookStartX = 0;
    let lookStartY = 0;
    let lookStartYaw = 0;
    let lookStartPitch = 0;
    let lookPointerId = null;

    const booking = new BookingUI(container, {
      onCloseSeatCard: clearSelection,
      onSavePhoto: savePhoto,
      onCheckoutPhoto: beginFanFlagCheckout,
      onRemovePhoto: removePhoto,
      onViewIn3D: viewSeatIn3D,
      onTicketsClick: onTicketsClick,
      onPanelChange: function (name) {
        if (toolbar) toolbar.setBillboardsOpen(name === 'billboards');
        requestRender();
      }
    });

    let hintEl = null;
    function setHint(text) {
      if (typeof booking.setHint === 'function') { booking.setHint(text); return; }
      if (!hintEl) {
        hintEl = document.createElement('div');
        hintEl.id = 'view-hint';
        hintEl.setAttribute('role', 'status');
        hintEl.style.cssText = [
          'position:absolute', 'left:50%', 'bottom:24px', 'transform:translateX(-50%)',
          'padding:8px 16px', 'border-radius:8px', 'background:rgba(0,0,0,0.65)',
          'color:#fff', 'font:14px/1.3 system-ui,sans-serif', 'pointer-events:none',
          'z-index:20', 'white-space:nowrap', 'display:none'
        ].join(';');
        container.appendChild(hintEl);
      }
      hintEl.textContent = text || '';
      hintEl.style.display = text ? 'block' : 'none';
    }

    function refreshSeatCard() {
      if (!selection) { booking.hideSeatCard(); return; }
      const seat = seatData[selection.id];
      if (!seat || seat.active === false) { booking.hideSeatCard(); return; }
      booking.showSeatCard({
        seatId: seat.id,
        section: seat.section,
        row: seat.row,
        seat: seat.seat,
        price: seat.price,
        ticketUrl: getTicketUrl(),
        billboard: photoBillboardsStore.get(seat.id)
      });
    }

    function selectSeat(id) {
      const previous = Array.from(selectedSet);
      selectedSet.clear();
      selection = { id };
      selectedSet.add(id);
      for (const prev of previous) if (prev !== id) controller.setVisual(prev, { selected: false });
      controller.setVisual(id, { selected: true });
      refreshSeatCard();
      requestRender();
    }

    function clearSelection() {
      const previous = Array.from(selectedSet);
      selectedSet.clear();
      selection = null;
      for (const id of previous) controller.setVisual(id, { selected: false });
      booking.hideSeatCard();
      booking.hideSectionCard();
      requestRender();
    }

    function matchesSeat(item) {
      const seat = seatData[item.seatId];
      return !!seat && seat.active !== false &&
             seat.section === item.section && seat.row === item.row && seat.seat === item.seat;
    }

    function reconcileBillboards() {
      const moves = [];
      photoBillboardsStore.getAll().forEach(function (item) {
        if (matchesSeat(item)) return;
        const target = seatByLabel.get(seatLabelKey(item.section, item.row, item.seat));
        if (target !== undefined) {
          moves.push({ from: item.seatId, to: { seatId: target, section: item.section, row: item.row, seat: item.seat } });
        }
      });
      if (moves.length) photoBillboardsStore.rekeyMany(moves);
    }

    function syncBillboards() {
      const items = photoBillboardsStore.getAll();
      const rows = items.map(function (item) {
        const resolved = matchesSeat(item);
        return {
          seatId: item.seatId,
          section: item.section,
          row: item.row,
          seat: item.seat,
          dataUrl: item.dataUrl,
          canView3D: resolved
        };
      });

      booking.renderBillboards(rows, photoBillboardsStore.getDemoSummary());
      if (toolbar) toolbar.setBillboardCount(items.length);
      if (selection) refreshSeatCard();
    }

    function savePhoto(target, dataUrl) {
      const seat = seatData[target.seatId];
      if (!seat || seat.active === false) {
        return { ok: false, title: 'Seat Not Found', message: 'We couldn\u2019t find that seat. Please select it again.' };
      }
      const result = photoBillboardsStore.get(target.seatId)
        ? photoBillboardsStore.updateAvatar(target.seatId, dataUrl)
        : photoBillboardsStore.save(
            { seatId: target.seatId, section: target.section, row: target.row, seat: target.seat },
            dataUrl
          );
      requestRender();
      return result;
    }

    function beginFanFlagCheckout(target, dataUrl) {
      if (!STRIPE_FAN_FLAG_PAYMENT_CONFIGURED) return { configured: false };
      const seat = seatData[target.seatId];
      if (!seat || seat.active === false) {
        return { configured: true, ok: false, message: 'Seat not found. Select the seat again before starting checkout.' };
      }
      const referenceId = seatKey(seat.section, seat.row, seat.seat);
      const paymentUrl = getFanFlagPaymentUrl(referenceId);
      if (!paymentUrl) {
        return { configured: true, ok: false, message: 'The Stripe Payment Link is not valid. Check VITE_STRIPE_FAN_FLAG_PAYMENT_URL and reload the site.' };
      }
      const savedDraft = savePendingFanFlagCheckout({
        referenceId,
        section: seat.section,
        row: seat.row,
        seat: seat.seat,
        dataUrl
      });
      if (!savedDraft.ok) return { configured: true, ok: false, message: savedDraft.message };
      return { configured: true, ok: true, url: paymentUrl };
    }

    function restoreFanFlagAfterStripeReturn() {
      const returnUrl = new URL(window.location.href);
      if (returnUrl.searchParams.get('fan_flag_return') !== '1' || !returnUrl.searchParams.get('session_id')) return;

      const draft = takePendingFanFlagCheckout();
      if (!draft) {
        booking.showNotice('Stripe return detected, but this tab has no recent fan-flag photo to restore.', 'warning');
      } else {
        const expectedReference = seatKey(draft.section, draft.row, draft.seat);
        const seatId = expectedReference === draft.referenceId
          ? seatByLabel.get(seatLabelKey(draft.section, draft.row, draft.seat))
          : undefined;
        const seat = seatId === undefined ? null : seatData[seatId];
        if (!seat || seat.active === false) {
          booking.showNotice('The selected seat could not be matched after returning. Your photo draft was not attached.', 'warning');
        } else {
          const result = photoBillboardsStore.get(seatId)
            ? photoBillboardsStore.updateAvatar(seatId, draft.dataUrl)
            : photoBillboardsStore.save({ seatId, section: seat.section, row: seat.row, seat: seat.seat }, draft.dataUrl);
          if (result.ok) {
            selectSeat(seatId);
            booking.showNotice('Fan flag restored as a local display. This site cannot verify the Stripe payment.', 'info');
          } else {
            booking.showNotice(result.message || 'Could not restore the local fan-flag photo.', 'warning');
          }
        }
      }

      returnUrl.searchParams.delete('fan_flag_return');
      returnUrl.searchParams.delete('session_id');
      window.history.replaceState(window.history.state, '', returnUrl.pathname + returnUrl.search + returnUrl.hash);
    }

    function removePhoto(seatId) {
      const result = photoBillboardsStore.remove(seatId);
      requestRender();
      return result;
    }

    function onTicketsClick(info) {
      console.info('[Tickets] Outbound click: section ' + info.section + ', row ' + info.row + ', seat ' + info.seat);
    }

    function initBillboards() {
      const photoStoreResult = photoBillboardsStore.load();
      reconcileBillboards();
      photoBillboardsStore.subscribe(function (change) {
        if (change.source === 'external') reconcileBillboards();
        syncBillboards();
        requestRender();
      });
      syncBillboards();
      if (photoStoreResult.code === 'storage-unavailable' || photoStoreResult.code === 'malformed' ||
          photoStoreResult.code === 'unsupported-version' || photoStoreResult.code === 'partial') {
        booking.showNotice(photoStoreResult.message, 'warning');
      }
    }

    function clampLook() {
      seatYaw = Math.max(Math.min(seatYaw, initialYaw + LOOK_YAW_LIMIT), initialYaw - LOOK_YAW_LIMIT);
      seatPitch = Math.max(Math.min(seatPitch, initialPitch + LOOK_PITCH_UP), initialPitch - LOOK_PITCH_DOWN);
    }

    function applyLook() {
      camera.rotation.set(seatPitch, seatYaw, 0);
    }

    function leaveSeatLook() {
      if (controls.enabled) return;
      isDraggingLook = false;
      lookPointerId = null;
      setTargetAheadOfCamera(camera, controls, null, fieldCentre);
      camera.rotation.order = 'XYZ';
      controls.enabled = true;
      setHint('');
    }

    function flyToPreset(preset) {
      const destination = sceneMode === QUALITY_MODE.ULTRA && activePreset === 'overview'
        ? CAMERA_PRESETS.gameNightOverview
        : preset;
      flyTo(camera, controls, destination.position, destination.target, 800, activePreset);
    }

    function configureCameraMode(key) {
      const settings = {
        overview: { min: 78, max: 220, pan: false, polar: 0.95 },
        fieldLevel: { min: 12, max: 22, pan: false, polar: 1.42 },
        exterior: { min: 78, max: 230, pan: false, polar: 1.48 },
        section: { min: 18, max: 105, pan: false, polar: 1.48 }
      }[key] || { min: 30, max: 240, pan: true, polar: Math.PI * 0.49 };
      controls.minDistance = settings.min;
      controls.maxDistance = settings.max;
      controls.enablePan = settings.pan;
      controls.minPolarAngle = key === 'overview' ? 0.18 : key === 'fieldLevel' ? 1.25 : 0.08;
      controls.maxPolarAngle = settings.polar;
      camera.fov = key === 'fieldLevel' ? 82 : defaultCameraFov;
      camera.updateProjectionMatrix();
    }

    configureCameraMode('overview');

    function stopWalk(animateToOverview = true) {
      if (viewMode !== VIEW.WALK) return;
      walkKeys.clear();
      endWalkDrag();
      walkHasPointerLock = false;
      walkJumpRequested = false;
      walkVerticalVelocity = 0;
      walkGrounded = true;
      viewMode = VIEW.OVERVIEW;
      activePreset = 'overview';
      controls.enabled = true;
      camera.rotation.order = 'YXZ';
      setTargetAheadOfCamera(camera, controls, 40, fieldCentre);
      configureCameraMode('overview');
      controls.update();
      camera.rotation.order = 'YXZ';
      if (toolbar) toolbar.setWalkMode(false);
      if (toolbar && animateToOverview) toolbar.setActive('overview');
      setHint('');
      if (document.pointerLockElement === renderer.domElement) document.exitPointerLock();
      if (animateToOverview) flyToPreset(CAMERA_PRESETS.overview);
    }

    function startWalk() {
      if (mobileControls) return;
      if (viewMode === VIEW.WALK) {
        stopWalk(true);
        return;
      }
      cancelFlight();
      clearSelection();
      clearHover();
      if (currentSection !== null) controller.setSectionVisual(currentSection, { sectionSelected: false });
      currentSection = null;
      viewMode = VIEW.WALK;
      activePreset = 'walk';
      camera.fov = defaultCameraFov;
      camera.updateProjectionMatrix();
      walkKeys.clear();
      walkJumpRequested = false;
      walkVerticalVelocity = 0;
      walkGrounded = true;
      controls.enabled = false;
      camera.rotation.order = 'YXZ';
      camera.position.set(0, getWalkGroundY(0, 0), 0);
      walkStartLook.set(0, camera.position.y, -20);
      camera.lookAt(walkStartLook);
      controls.target.copy(walkStartLook);
      walkYaw = camera.rotation.y;
      walkPitch = camera.rotation.x;
      camera.rotation.set(walkPitch, walkYaw, 0, 'YXZ');
      clampWalkCamera(camera, camera.position.y);
      if (toolbar) {
        toolbar.setActive('walk');
        toolbar.setWalkMode(true);
      }
      setHint(WALK_HINT);
      try {
        const lockResult = renderer.domElement.requestPointerLock?.();
        if (lockResult && typeof lockResult.catch === 'function') lockResult.catch(() => {});
      } catch (error) {
        // Click-drag mouse look remains available when pointer lock is blocked.
      }
    }

    function showSectionCard(label) {
      const summary = sectionSummary.get(String(label));
      if (!summary) return;
      const tierName = ({ 100: 'Lower Bowl', 200: 'Club Level', 300: 'Upper Bowl', lower: 'Lower Bowl', club: 'Club Level', upper: 'Upper Bowl' })[summary.tier] || 'Arena Seating';
      const premiumSections = new Set(['125', '126', '224', '227']);
      booking.showSectionCard({
        section: label,
        tierName,
        count: summary.count,
        minPrice: Number.isFinite(summary.minPrice) ? summary.minPrice : null,
        premium: premiumSections.has(String(label)),
        ticketUrl: getTicketUrl()
      });
    }

    function flyToSection(label) {
      const bounds = sectionBounds[label];
      if (!bounds) return;
      const cx = bounds.centre.x;
      const cz = bounds.centre.z;
      const length = Math.hypot(cx, cz) || 1;
      const towardField = { x: -cx / length, z: -cz / length };
      const distance = bounds.radius * 1.5 + 8;
      const height = bounds.y + bounds.radius * 0.7 + 4;

      flyTo(
        camera, controls,
        sectionCameraPosition.set(cx + towardField.x * distance, height, cz + towardField.z * distance),
        sectionCameraTarget.set(cx, bounds.y, cz),
        800,
        'section'
      );
    }

    function flyToSeat(id) {
      const p = seatData[id].position;
      const length = Math.hypot(p.x, p.z) || 1;
      const towardField = { x: -p.x / length, z: -p.z / length };
      flyTo(
        camera, controls,
        seatCameraPosition.set(p.x + towardField.x * 12, p.y + 7, p.z + towardField.z * 12),
        seatCameraTarget.set(p.x, p.y + 0.5, p.z),
        800,
        'section'
      );
    }

    function enterOverview() {
      clearSelection();
      if (currentSection !== null) controller.setSectionVisual(currentSection, { sectionSelected: false });
      currentSection = null;
      viewMode = VIEW.OVERVIEW;
      activePreset = 'overview';
      configureCameraMode('overview');
      leaveSeatLook();
      if (toolbar) toolbar.setActive('overview');
      flyToPreset(CAMERA_PRESETS.overview);
    }

    function enterSectionView(label, focusSeatId) {
      clearSelection();
      clearHover();
      if (currentSection !== null && currentSection !== label) {
        controller.setSectionVisual(currentSection, { sectionSelected: false });
      }
      currentSection = label;
      controller.setSectionVisual(label, { sectionSelected: true });
      viewMode = VIEW.SECTION;
      configureCameraMode('section');
      leaveSeatLook();
      if (toolbar) toolbar.setActive(null);
      if (focusSeatId === undefined) {
        flyToSection(label);
        showSectionCard(label);
        return;
      }
      flyToSeat(focusSeatId);
      selectSeat(focusSeatId);
    }

    function viewSeatIn3D(seatId) {
      const seat = seatData[seatId];
      if (!seat || seat.active === false) {
        booking.showNotice('That seat could not be found.', 'warning');
        return;
      }
      enterSectionView(seat.section, seatId);
    }

    function enterSeatView(id) {
      const seat = seatData[id];
      currentSection = seat.section;
      viewMode = VIEW.SEAT;
      if (toolbar) toolbar.setActive(null);
      selectSeat(id);

      cancelFlight();
      controls.enabled = false;
      isDraggingLook = false;
      lookPointerId = null;

      camera.rotation.order = 'YXZ';
      camera.position.set(seat.position.x, seat.position.y + EYE_HEIGHT, seat.position.z);
      clampCameraForMode(camera, controls, 'seat');
      camera.up.set(0, 1, 0);
      camera.lookAt(fieldCentre);
      camera.rotation.z = 0;

      initialYaw = camera.rotation.y;
      initialPitch = camera.rotation.x;
      seatYaw = initialYaw;
      seatPitch = initialPitch;
      applyLook();

      setHint(SEAT_HINT);
    }

    function resetViewState(key) {
      if (viewMode === VIEW.WALK) stopWalk(false);
      clearSelection();
      if (currentSection !== null) controller.setSectionVisual(currentSection, { sectionSelected: false });
      currentSection = null;
      viewMode = VIEW.OVERVIEW;
      activePreset = key || 'overview';
      configureCameraMode(key || 'overview');
      leaveSeatLook();
    }

    toolbar = createUI({
      camera,
      controls,
      sceneMode: DEFAULT_SCENE_MODE,
      arenaStyle: DEFAULT_ARENA_STYLE,
      walkAvailable: !mobileControls,
      deviceNotice: deviceTier.autoSelected && DEFAULT_SCENE_MODE === QUALITY_MODE.LITE
        ? 'Lite auto-selected for this device'
        : '',
      onViewReset: resetViewState,
      onWalkMode: startWalk,
      onSceneMode: applySceneMode,
      onArenaStyle: applyArenaStyle,
      onOpenBillboards: function (button) { booking.togglePanel(); },
      onOpenAbout: function (button) { booking.openAbout(button); requestRender(); }
    });
    applyArenaStyle(DEFAULT_ARENA_STYLE);
    applySceneMode(DEFAULT_SCENE_MODE);
    initBillboards();
    restoreFanFlagAfterStripeReturn();

    controls.addEventListener('start', cancelFlight);

    function handleSeatClick(id) {
      const seat = seatData[id];
      if (!seat || seat.active === false) return;

      if (viewMode === VIEW.OVERVIEW) { enterSectionView(seat.section); return; }
      if (seat.section !== currentSection) { enterSectionView(seat.section); return; }
      enterSeatView(id);
    }

    const dom = renderer.domElement;
    let downAt = null;
    const activeTouchPointers = new Set();
    const debugOverlay = document.createElement('pre');
    debugOverlay.setAttribute('aria-live', 'polite');
    debugOverlay.style.cssText = 'position:fixed;top:112px;left:12px;z-index:10000;margin:0;padding:10px 12px;border:1px solid #52657c;border-radius:8px;background:rgba(5,12,22,.88);color:#d7e7f7;font:12px/1.55 ui-monospace,monospace;white-space:pre;pointer-events:none;display:none;';
    debugOverlay.textContent = 'Renderer diagnostics';
    document.body.appendChild(debugOverlay);
    let debugVisible = new URLSearchParams(window.location.search).get('debug') === '1';
    debugOverlay.style.display = debugVisible ? 'block' : 'none';
    window.addEventListener('keydown', function (event) {
      if (event.code !== 'F3') return;
      event.preventDefault();
      debugVisible = !debugVisible;
      debugOverlay.style.display = debugVisible ? 'block' : 'none';
      requestRender();
    });

    let canvasRect = dom.getBoundingClientRect();
    function updateCanvasRect() { canvasRect = dom.getBoundingClientRect(); }
    function setPointerNdc(x, y) {
      pointer.set(
        ((x - canvasRect.left) / canvasRect.width) * 2 - 1,
        -((y - canvasRect.top) / canvasRect.height) * 2 + 1
      );
    }

    dom.addEventListener('pointerdown', function (e) {
      pendingPointer = null;
      if (viewMode === VIEW.WALK) return;
      if (e.pointerType === 'touch') {
        activeTouchPointers.add(e.pointerId);
        if (activeTouchPointers.size > 1) { downAt = null; return; }
      }
      if (e.button !== 0 || !e.isPrimary) return;
      downAt = { x: e.clientX, y: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType };
    });

    window.addEventListener('pointermove', function (event) {
      if (viewMode !== VIEW.WALK) return;
      if (document.pointerLockElement === dom) {
        walkYaw -= event.movementX * LOOK_SENSITIVITY;
        walkPitch = THREE.MathUtils.clamp(walkPitch - event.movementY * LOOK_SENSITIVITY, -1.35, 1.35);
        camera.rotation.set(walkPitch, walkYaw, 0, 'YXZ');
        requestRender();
      } else if (walkDragActive && walkDragPointerId === event.pointerId) {
        const dx = event.clientX - walkLastPointer.x;
        const dy = event.clientY - walkLastPointer.y;
        walkLastPointer.x = event.clientX;
        walkLastPointer.y = event.clientY;
        walkYaw -= dx * LOOK_SENSITIVITY;
        walkPitch = THREE.MathUtils.clamp(walkPitch - dy * LOOK_SENSITIVITY, -1.35, 1.35);
        camera.rotation.set(walkPitch, walkYaw, 0, 'YXZ');
        requestRender();
      }
    });

    dom.addEventListener('pointerdown', function (event) {
      if (viewMode !== VIEW.WALK || document.pointerLockElement === dom || event.button !== 0) return;
      walkDragPointerId = event.pointerId;
      walkLastPointer.x = event.clientX;
      walkLastPointer.y = event.clientY;
      walkDragActive = true;
      try { dom.setPointerCapture(event.pointerId); } catch (err) { /* Pointer capture is optional. */ }
    });
    function endWalkDrag(event) {
      if (event && walkDragPointerId !== event.pointerId) return;
      const pointerId = walkDragPointerId;
      walkDragPointerId = null;
      walkDragActive = false;
      if (pointerId !== null && dom.hasPointerCapture && dom.hasPointerCapture(pointerId)) {
        try { dom.releasePointerCapture(pointerId); } catch (err) { /* Pointer capture is optional. */ }
      }
    }
    dom.addEventListener('pointerup', endWalkDrag);
    dom.addEventListener('pointercancel', endWalkDrag);
    dom.addEventListener('pointercancel', function (event) {
      downAt = null;
      if (event.pointerType === 'touch') activeTouchPointers.delete(event.pointerId);
    });

    document.addEventListener('pointerlockchange', function () {
      if (document.pointerLockElement === dom) {
        walkHasPointerLock = true;
      } else if (viewMode === VIEW.WALK && walkHasPointerLock) {
        walkHasPointerLock = false;
        stopWalk(true);
      }
    });

    function outlinesActive() {
      return !!outlineGroup && outlineGroup.visible && viewMode === VIEW.OVERVIEW &&
        (activePreset === 'overview' || activePreset === 'fieldLevel');
    }

    function pickOutlineAt(x, y) {
      setPointerNdc(x, y);
      outlineRaycaster.setFromCamera(pointer, camera);
      const hits = outlineRaycaster.intersectObjects(outlinePickTargets, false);
      for (const hit of hits) {
        const outline = hit.object.isMesh ? hit.object.parent : hit.object;
        if (outline && outline.userData && outline.userData.sectionLabel) return outline;
      }
      return null;
    }

    function styleOutline(outline, hovered) {
      outline.material.color.setHex(hovered ? OUTLINE_HOVER_COLOUR : OUTLINE_BASE_COLOUR);
      outline.material.opacity = hovered ? OUTLINE_HOVER_OPACITY : OUTLINE_BASE_OPACITY;
    }

    function setHoveredOutline(outline) {
      if (outline === hoveredOutline) return;
      if (hoveredOutline) styleOutline(hoveredOutline, false);
      hoveredOutline = outline;
      if (hoveredOutline) styleOutline(hoveredOutline, true);
      const nextSection = hoveredOutline && hoveredOutline.userData
        ? String(hoveredOutline.userData.sectionLabel)
        : null;
      if (hoveredSectionLabel !== nextSection) {
        if (hoveredSectionLabel !== null) {
          controller.setSectionVisual(hoveredSectionLabel, { sectionHovered: false });
        }
        if (nextSection !== null) controller.setSectionVisual(nextSection, { sectionHovered: true });
        hoveredSectionLabel = nextSection;
        requestRender();
      }
    }

    function clearHover() {
      setHoveredOutline(null);
      booking.hideSectionTooltip();
      dom.style.cursor = '';
    }

    function setHoveredSeat(id) {
      if (id === hoveredSeatId) return;
      const previous = hoveredSeatId;
      hoveredSeatId = id;
      if (previous !== null) controller.setVisual(previous, { hovered: false });
      if (id !== null) controller.setVisual(id, { hovered: true });
      requestRender();
    }

    function clearSeatHover() {
      setHoveredSeat(null);
      if (seatHoverCursorSet) {
        dom.style.cursor = '';
        seatHoverCursorSet = false;
      }
    }

    function setSeatCursor(cursor) {
      dom.style.cursor = cursor;
      seatHoverCursorSet = cursor !== '';
    }

    function runSeatHover(at) {
      setPointerNdc(at.x, at.y);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(pickTargets, true);
      const first = hits[0];
      const id = first && first.object === seatMesh && first.instanceId !== undefined
        ? first.instanceId
        : null;

      if (id === null) { setHoveredSeat(null); setSeatCursor(''); return; }
      const seat = seatData[id];
      if (!seat || seat.active === false) { setHoveredSeat(null); setSeatCursor(''); return; }
      if (seat.section !== currentSection) {
        setHoveredSeat(null);
        setSeatCursor('pointer');
      } else {
        setHoveredSeat(id);
        setSeatCursor('pointer');
      }
    }

    function runOutlineHover(at) {
      const outline = pickOutlineAt(at.x, at.y);
      setHoveredOutline(outline);
      if (outline) {
        booking.showSectionTooltip(outline.userData.sectionLabel, outline.userData.minPrice, at.x, at.y);
        dom.style.cursor = 'pointer';
      } else {
        booking.hideSectionTooltip();
        dom.style.cursor = '';
      }
    }

    function queueHover(x, y) {
      pendingPointer = { x, y };
      if (!hoverFrame) hoverFrame = requestAnimationFrame(runHover);
    }

    function runHover() {
      hoverFrame = 0;
      const at = pendingPointer;
      if (!at) return;
      const now = performance.now();
      if (now - lastHoverTime < HOVER_MIN_INTERVAL_MS) {
        hoverFrame = requestAnimationFrame(runHover);
        return;
      }
      pendingPointer = null;
      lastHoverTime = now;
      if (at.x === lastHover.x && at.y === lastHover.y && viewMode === lastHover.mode) return;
      lastHover.x = at.x; lastHover.y = at.y; lastHover.mode = viewMode;
      if (viewMode === VIEW.SECTION) runSeatHover(at);
      else if (outlinesActive()) runOutlineHover(at);
    }

    dom.addEventListener('pointermove', function (e) {
      if (viewMode === VIEW.SEAT) {
        if (hoveredOutline) clearHover();
        return;
      }
      const blocked = e.pointerType === 'touch' || e.buttons > 0;

      if (viewMode === VIEW.SECTION) {
        if (hoveredOutline) clearHover();
        if (blocked) clearSeatHover();
        else queueHover(e.clientX, e.clientY);
        return;
      }

      if (!outlinesActive() || blocked) {
        if (hoveredOutline) clearHover();
        return;
      }
      queueHover(e.clientX, e.clientY);
    });
    dom.addEventListener('pointerleave', function () {
      downAt = null;
      pendingPointer = null;
      lastHover.x = lastHover.y = NaN;
      if (hoveredOutline) clearHover();
      clearSeatHover();
    });

    dom.addEventListener('pointerup', function (e) {
      if (e.pointerType === 'touch') activeTouchPointers.delete(e.pointerId);
      if (viewMode === VIEW.WALK) { downAt = null; return; }
      if (!downAt || !e.isPrimary || e.pointerId !== downAt.pointerId) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      const tapThreshold = downAt.pointerType === 'touch' ? 14 : 6;
      downAt = null;
      if (moved > tapThreshold) return;

      if (outlinesActive()) {
        const outline = pickOutlineAt(e.clientX, e.clientY);
        if (outline) {
          const label = outline.userData.sectionLabel;
          clearHover();
          enterSectionView(label);
          return;
        }
      }

      setPointerNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(pickTargets, true);
      const first = hits[0];
      if (first && first.object === seatMesh && first.instanceId !== undefined) {
        handleSeatClick(first.instanceId);
      } else if (!booking.closePanel(false) && selection) {
        clearSelection();
      }
    });

    dom.style.touchAction = 'none';

    dom.addEventListener('pointerdown', function (e) {
      if (viewMode !== VIEW.SEAT) return;
      if (e.button !== 0 || !e.isPrimary) return;
      isDraggingLook = true;
      lookPointerId = e.pointerId;
      lookStartX = e.clientX;
      lookStartY = e.clientY;
      lookStartYaw = seatYaw;
      lookStartPitch = seatPitch;
      try { dom.setPointerCapture(e.pointerId); } catch (err) { /* not critical */ }
    });

    dom.addEventListener('pointermove', function (e) {
      if (viewMode !== VIEW.SEAT || !isDraggingLook) return;
      if (e.pointerId !== lookPointerId) return;
      const deltaX = e.clientX - lookStartX;
      const deltaY = e.clientY - lookStartY;
      seatYaw = lookStartYaw - deltaX * LOOK_SENSITIVITY;
      seatPitch = lookStartPitch - deltaY * LOOK_SENSITIVITY;
      clampLook();
      applyLook();
      requestRender();
    });

    function endLookDrag(e) {
      if (!isDraggingLook) return;
      if (e && e.pointerId !== undefined && e.pointerId !== lookPointerId) return;
      isDraggingLook = false;
      if (e && dom.hasPointerCapture && dom.hasPointerCapture(e.pointerId)) {
        try { dom.releasePointerCapture(e.pointerId); } catch (err) { /* not critical */ }
      }
      lookPointerId = null;
    }
    dom.addEventListener('pointerup', endLookDrag);
    dom.addEventListener('pointercancel', endLookDrag);
    window.addEventListener('blur', function () { endLookDrag(null); });

    dom.addEventListener('wheel', function (e) {
      if (viewMode !== VIEW.SEAT) return;
      e.preventDefault();
    }, { passive: false });

    dom.addEventListener('touchmove', function (e) {
      if (viewMode !== VIEW.SEAT) return;
      if (e.touches.length > 1) e.preventDefault();
    }, { passive: false });

    ['gesturestart', 'gesturechange', 'gestureend'].forEach(function (name) {
      dom.addEventListener(name, function (e) {
        if (viewMode !== VIEW.SEAT) return;
        e.preventDefault();
      }, { passive: false });
    });

    window.addEventListener('keydown', function (e) {
      if (viewMode === VIEW.WALK) {
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(e.code)) {
          e.preventDefault();
          walkKeys.add(e.code);
          if (e.code === 'Space' && !e.repeat) walkJumpRequested = true;
          requestRender();
        }
      }
      if (e.key !== 'Escape') return;
      if (booking.handleEscape()) return;
      if (viewMode === VIEW.WALK) {
        stopWalk(true);
      } else if (viewMode === VIEW.SEAT && currentSection) {
        enterSectionView(currentSection);
      } else if (viewMode === VIEW.SECTION) {
        if (selection) clearSelection();
        else enterOverview();
      } else if (selection) {
        clearSelection();
      }
    });

    window.addEventListener('keyup', function (event) { walkKeys.delete(event.code); });
    window.addEventListener('blur', function () { walkKeys.clear(); endWalkDrag(); });

    window.addEventListener('resize', function () {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      applyRenderQuality(renderer, sceneMode);
      updateCanvasRect();
      const nextMobileControls = mobileMediaQuery.matches || window.innerWidth <= 768;
      if (nextMobileControls !== mobileControls) {
        mobileControls = nextMobileControls;
        if (toolbar) toolbar.setWalkAvailable(!mobileControls);
        if (mobileControls && viewMode === VIEW.WALK) stopWalk(true);
      }
      requestRender();
    });
    controls.addEventListener('change', requestRender);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) requestRender();
    });

    requestAnimationFrame(function () {
      loading.classList.add('hidden');
      setTimeout(function () { loading.remove(); }, 600);
    });

    function animate(now) {
      renderFrame = 0;
      now = Number.isFinite(now) ? now : performance.now();
      const delta = Math.min((now - lastFrameTime) / 1000, 0.05);
      lastFrameTime = now;
      if (sceneMode === QUALITY_MODE.ULTRA) {
        lights.update(now * 0.001);
        stadium.userData.updateSceneMode(now * 0.001);
      }
      if (viewMode !== VIEW.SEAT && viewMode !== VIEW.WALK) controls.update();
      if (viewMode === VIEW.WALK) {
        walkPreviousPosition.copy(camera.position);

        if (walkJumpRequested) {
          if (walkGrounded) {
            walkVerticalVelocity = WALK_JUMP_SPEED;
            walkGrounded = false;
          }
          walkJumpRequested = false;
        }

        let currentWalkGroundY = getWalkGroundY(camera.position.x, camera.position.z);
        if (!walkGrounded) {
          walkVerticalVelocity -= WALK_GRAVITY * delta;
          camera.position.y += walkVerticalVelocity * delta;
          if (walkVerticalVelocity <= 0 && camera.position.y <= currentWalkGroundY) {
            camera.position.y = currentWalkGroundY;
            walkVerticalVelocity = 0;
            walkGrounded = true;
          }
        } else {
          camera.position.y = currentWalkGroundY;
        }

        camera.getWorldDirection(walkForward);
        walkForward.y = 0;
        if (walkForward.lengthSq() > 0) walkForward.normalize();
        walkRight.copy(walkForward).cross(camera.up).normalize();
        walkMovement.set(0, 0, 0);
        if (walkKeys.has('KeyW')) walkMovement.add(walkForward);
        if (walkKeys.has('KeyS')) walkMovement.sub(walkForward);
        if (walkKeys.has('KeyD')) walkMovement.add(walkRight);
        if (walkKeys.has('KeyA')) walkMovement.sub(walkRight);
        if (walkMovement.lengthSq() > 0) {
          walkMovement.normalize().multiplyScalar(WALK_SPEED * delta);
          camera.position.x += walkMovement.x;
          clampWalkCamera(camera, currentWalkGroundY);
          if (!canWalkMoveTo(camera.position.x, camera.position.z)) {
            camera.position.x = walkPreviousPosition.x;
          }
          camera.position.z += walkMovement.z;
          clampWalkCamera(camera, currentWalkGroundY);
          if (!canWalkMoveTo(camera.position.x, camera.position.z)) {
            camera.position.z = walkPreviousPosition.z;
          }
        }

        currentWalkGroundY = getWalkGroundY(camera.position.x, camera.position.z);
        if (!walkGrounded) {
          if (walkVerticalVelocity <= 0 && camera.position.y <= currentWalkGroundY) {
            camera.position.y = currentWalkGroundY;
            walkVerticalVelocity = 0;
            walkGrounded = true;
          }
        } else {
          camera.position.y = currentWalkGroundY;
        }
        clampWalkCamera(camera, currentWalkGroundY);
        const jumpCeiling = Math.min(
          currentWalkGroundY + WALK_MAX_JUMP_HEIGHT,
          ARENA.roof.elevation - 2.5
        );
        if (camera.position.y >= jumpCeiling && walkVerticalVelocity > 0) {
          camera.position.y = jumpCeiling;
          walkVerticalVelocity = 0;
        }
      } else if (!isCameraFlightActive()) {
        if (viewMode === VIEW.OVERVIEW) clampCameraForMode(camera, controls, activePreset);
        else if (viewMode === VIEW.SECTION) clampCameraForMode(camera, controls, 'section');
        else if (viewMode === VIEW.SEAT) clampCameraForMode(camera, controls, 'seat');
      }

      const overviewState = viewMode === VIEW.OVERVIEW && activePreset === 'overview';
      const sectionPickState = viewMode === VIEW.OVERVIEW && (overviewState || activePreset === 'fieldLevel');
      const roofHidden = overviewState || viewMode === VIEW.WALK;
      if (roofGroup && roofGroup.visible === roofHidden) roofGroup.visible = !roofHidden;
      if (videoBoardSuspension && videoBoardSuspension.visible === roofHidden) {
        videoBoardSuspension.visible = !roofHidden;
      }
      if (outlineGroup && outlineGroup.visible !== sectionPickState) {
        outlineGroup.visible = sectionPickState;
        if (!sectionPickState) clearHover();
      }

      if (viewMode !== VIEW.SECTION && (hoveredSeatId !== null || seatHoverCursorSet)) {
        clearSeatHover();
      }

      if (seatDistanceSoftening) {
        if (viewMode === VIEW.OVERVIEW && activePreset === 'overview') {
          const dx = camera.position.x - controls.target.x;
          const dy = camera.position.y - controls.target.y;
          const dz = camera.position.z - controls.target.z;
          const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const fadeT = Math.max(0, Math.min(1, (distance - 120) / 150));
          const easedFade = fadeT * fadeT * (3 - 2 * fadeT);
          const qualityFade = sceneMode === QUALITY_MODE.LITE ? 0.58 : 0.46;
          seatDistanceSoftening.value = easedFade * qualityFade;
        } else {
          seatDistanceSoftening.value = 0;
        }
      }
      renderer.render(scene, camera);
      fpsFrames++;
      if (now - fpsWindowStart >= 500) {
        displayedFps = Math.round((fpsFrames * 1000) / (now - fpsWindowStart));
        fpsFrames = 0;
        fpsWindowStart = now;
      }
      if (debugVisible && now - lastDebugUpdate >= 250) {
        lastDebugUpdate = now;
        const info = renderer.info;
        debugOverlay.textContent =
          'FPS: ' + displayedFps + '\n' +
          'Camera: ' + camera.position.x.toFixed(1) + ', ' + camera.position.y.toFixed(1) + ', ' + camera.position.z.toFixed(1) + '\n' +
          'Draw calls: ' + info.render.calls + '\n' +
          'Triangles: ' + info.render.triangles.toLocaleString() + '\n' +
          'Geometries: ' + info.memory.geometries + '\n' +
          'Textures: ' + info.memory.textures;
      }
      const walkActive = viewMode === VIEW.WALK && (
        walkKeys.size > 0 || walkJumpRequested || !walkGrounded || Math.abs(walkVerticalVelocity) > 0.001
      );
      if (sceneMode === QUALITY_MODE.ULTRA || isCameraFlightActive() || walkActive || debugVisible) {
        requestRender();
      }
    }
    requestRender();
  } catch (error) {
    console.error('Failed to initialise stadium:', error);
    loading.innerHTML = `
      <p style="color:#ff6b6b;font-size:14px;max-width:80%;text-align:center;">
        Failed to load the 3D scene.<br>
        ${error.message}
      </p>
    `;
  }
}

init();
