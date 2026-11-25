import { QUALITY_MODE } from '../config/renderQuality.js';

const MOBILE_USER_AGENT = /Android|iPhone|iPod|iPad|Mobile|Windows Phone/i;
const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|lavapipe|software rasterizer|microsoft basic render|warp|mesa offscreen/i;

function readGpuDescription(renderer) {
  try {
    const context = renderer?.getContext?.();
    if (!context) return '';
    const extension = context.getExtension('WEBGL_debug_renderer_info');
    const rendererName = extension
      ? context.getParameter(extension.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER);
    const vendorName = extension
      ? context.getParameter(extension.UNMASKED_VENDOR_WEBGL)
      : context.getParameter(context.VENDOR);
    return `${vendorName || ''} ${rendererName || ''}`.trim();
  } catch (_error) {
    return '';
  }
}

export function detectDeviceTier(renderer, navigatorLike = globalThis.navigator) {
  const nav = navigatorLike || {};
  const readPositiveMetric = (value) => {
    const metric = Number(value);
    return value !== undefined && value !== null && Number.isFinite(metric) && metric > 0
      ? metric
      : null;
  };
  const cores = readPositiveMetric(nav.hardwareConcurrency);
  const memory = readPositiveMetric(nav.deviceMemory);
  const userAgent = String(nav.userAgent || '');
  const touchPoints = Number(nav.maxTouchPoints) || 0;
  const smallestScreenSide = Math.min(globalThis.screen?.width || globalThis.innerWidth || 0, globalThis.screen?.height || globalThis.innerHeight || 0);
  const mobile = MOBILE_USER_AGENT.test(userAgent) || (touchPoints > 1 && smallestScreenSide > 0 && smallestScreenSide < 820);
  const gpu = readGpuDescription(renderer);
  const softwareGpu = SOFTWARE_RENDERER.test(gpu);
  const reasons = [];

  if (mobile) reasons.push('mobile');
  if (softwareGpu) reasons.push('software-gpu');
  if (cores !== null && cores <= 2) reasons.push('limited-cpu');
  if (memory !== null && memory <= 2) reasons.push('limited-memory');
  if (cores !== null && cores <= 4 && memory !== null && memory <= 4) reasons.push('limited-device');

  const isLiteRecommended = reasons.length > 0;
  return {
    mode: isLiteRecommended ? QUALITY_MODE.LITE : QUALITY_MODE.STANDARD,
    autoSelected: isLiteRecommended,
    reasons,
    mobile,
    softwareGpu,
    cores,
    memory,
    gpu
  };
}
