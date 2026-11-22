
export interface LightState { angle: number; distance: number; power: number }
export const initialLight: LightState = {angle: 45, distance: 1, power: 100};
export function validateLight(s: LightState): void {
 if (!Number.isFinite(s.angle) || s.angle < -90 || s.angle > 90 ||
     !Number.isFinite(s.distance) || s.distance < 0.5 || s.distance > 3 ||
     !Number.isFinite(s.power) || s.power < 10 || s.power > 100) throw new RangeError('灯光参数超出练习范围');
}
// Ideal point source teaching ratio, not a calibration of any actual light.
export function relativeIlluminance(s: LightState): number { validateLight(s); return s.power / 100 / s.distance ** 2; }
export function lightStops(s: LightState): number { return Math.log2(relativeIlluminance(s)); }
export function exposureStops(aperture: number, seconds: number, iso: number): number {
 if (![aperture, seconds, iso].every(x => Number.isFinite(x) && x > 0)) throw new RangeError('曝光参数必须为正数');
 return Math.log2(seconds / (1/125)) - 2 * Math.log2(aperture / 4) + Math.log2(iso / 100);
}
export function hemisphereShade(nx: number, ny: number, s: LightState): number {
 validateLight(s);
 const nz = Math.sqrt(Math.max(0, 1-nx*nx-ny*ny));
 const a = s.angle * Math.PI / 180;
 return Math.min(1, .08 + Math.max(0,nx*Math.sin(a)+nz*Math.cos(a))*.65*relativeIlluminance(s));
}
export interface PracticeRecord { version: 1; light: LightState; observation: string; savedAt: string }
export function restorePractice(raw: unknown): PracticeRecord | null {
 if (!raw || typeof raw !== 'object') return null;
 const r = raw as PracticeRecord;
 try {
  if (r.version !== 1 || typeof r.observation !== 'string' || r.observation.length > 500 ||
      typeof r.savedAt !== 'string' || !Number.isFinite(Date.parse(r.savedAt))) return null;
  validateLight(r.light);
  return {version: 1, light: {...r.light}, observation: r.observation, savedAt: r.savedAt};
 } catch { return null; }
}
