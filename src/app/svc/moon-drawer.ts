import { ISkyObserver, KM_PER_AU, SolarSystem } from '@tubular/astronomy';
import { abs, Angle, cos_deg, PI, sin_deg, to_radian, Unit } from '@tubular/math';
import { fillCircle, strokeCircle } from '@tubular/util';
import {
  AmbientLight, CanvasTexture, Mesh, MeshPhongMaterial, PerspectiveCamera, PointLight, Scene, SphereGeometry,
  sRGBEncoding, WebGLRenderer
} from 'three';

const MAX_LUNAR_ANGULAR_DIAMETER = 34; // In arc-minutes, rounded up from 33.66.
const MOON_RADIUS = 1737.4; // km

export class MoonDrawer {
  private camera: PerspectiveCamera;
  private earthShine: AmbientLight;
  private moonMesh: Mesh;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private shadowCanvas: HTMLCanvasElement;
  private sun: PointLight;
  private webGlRendererSize = 0;

  static getMoonDrawer(): Promise<MoonDrawer> {
    return new Promise<MoonDrawer>((resolve, reject) => {
      const image = new Image();

      image.onload = (): void => {
        const image2 = new Image();

        image2.onload = (): void => {
          resolve(new MoonDrawer(image, image2));
        };
        image2.onerror = (reason): void => {
          console.warn('Moon bump map failed to load:', reason);
          resolve(new MoonDrawer(image));
        };

        image2.src = 'assets/resources/moon_map_bump.jpg';
      };
      image.onerror = (reason): void => {
        reject(new Error('Moon map failed to load: ' + reason));
      };

      image.src = 'assets/resources/moon_map.jpg';
    });
  }

  constructor(private moonImage: HTMLImageElement, private moonBumps?: HTMLImageElement) {}

  drawMoon(context: CanvasRenderingContext2D, solarSystem: SolarSystem, time_JDE: number,
           cx: number, cy: number, size: number, pixelsPerArcSec: number, pixelRatio = 1,
           parallacticAngle?: Angle, observer?: ISkyObserver, showEclipses?: boolean): void {
    if (!this.renderer)
      this.setUpRenderer();

    if (size === 0)
      size = MAX_LUNAR_ANGULAR_DIAMETER * pixelsPerArcSec * 60;

    const targetSize = size;

    if (!pixelsPerArcSec)
      pixelsPerArcSec = size / MAX_LUNAR_ANGULAR_DIAMETER / 60;

    size *= pixelRatio;
    pixelsPerArcSec *= pixelRatio;

    if (this.webGlRendererSize !== size) {
      this.renderer.setSize(size, size);
      this.webGlRendererSize = size;
    }

    const r = size / 2;
    const saveCompOp = context.globalCompositeOperation;
    const phase = solarSystem.getLunarPhase(time_JDE);
    const libration = solarSystem.getLunarLibration(time_JDE, observer);

    this.camera.position.z = libration.D * KM_PER_AU;
    this.camera.rotation.z = (parallacticAngle ? parallacticAngle.radians : 0);
    this.moonMesh.rotation.y = to_radian(-libration.l);
    this.moonMesh.rotation.x = to_radian(libration.b);
    this.sun.position.x = 150000000 * sin_deg(phase); // Very approximate, but good enough.
    this.sun.position.z = -150000000 * cos_deg(phase);
    this.earthShine.intensity = 0.025 + cos_deg(phase) * 0.0125;
    this.renderer.render(this.scene, this.camera);
    context.globalCompositeOperation = 'source-over';
    context.drawImage(this.renderer.domElement, cx - targetSize / 2, cy - targetSize / 2, targetSize, targetSize);

    // If we're near a full moon, it's worth checking for a lunar eclipse, but not otherwise.
    if (showEclipses && abs(phase - 180.0) < 3.0) {
      const ei = solarSystem.getLunarEclipseInfo(time_JDE);

      if (ei.inPenumbra) {
        const dLon = ei.shadowPos.longitude.subtract(ei.pos.longitude).getAngle(Unit.ARC_SECONDS);
        const dLat = ei.shadowPos.latitude.subtract(ei.pos.latitude).getAngle(Unit.ARC_SECONDS);
        const sin_pa = parallacticAngle ? parallacticAngle.sin : 0;
        const cos_pa = parallacticAngle ? parallacticAngle.cos : 1;
        const sx = (dLon * cos_pa - dLat * sin_pa) * -pixelsPerArcSec + r;
        const sy = (dLon * sin_pa + dLat * cos_pa) * -pixelsPerArcSec + r;
        const uRadius = ei.umbraRadius * pixelsPerArcSec + 2;
        const pRadius = ei.penumbraRadius * pixelsPerArcSec + 2;
        const moonR = ei.radius * pixelsPerArcSec;

        if (!this.shadowCanvas) // Turns out that rendering eclipse shadows with 2D graphics works better than using WebGL.
          this.shadowCanvas = document.createElement('canvas');

        if (this.shadowCanvas.width !== size || this.shadowCanvas.height !== size)
          this.shadowCanvas.width = this.shadowCanvas.height = size;

        const context2 = this.shadowCanvas.getContext('2d');

        context2.fillStyle = '#FFFFFF';
        context2.fillRect(0, 0, size, size);
        // Penumbra
        context2.fillStyle = `hsl(36deg ${100 - ei.totality * 100}% 75%)`;
        context2.filter = `blur(${size / 6}px)`;
        fillCircle(context2, sx, sy, pRadius - size / 6);
        // Umbra
        context2.fillStyle = '#664533';
        context2.filter = `blur(${size / 125}px)`;
        fillCircle(context2, sx, sy, uRadius);
        // Mask off penumbra and umbra beyond edge of moon
        context2.filter = 'blur(1px)';
        context2.strokeStyle = 'white';
        context2.lineWidth = r;
        strokeCircle(context2, r, r, moonR + r / 2);

        context.globalCompositeOperation = 'multiply';
        context.drawImage(this.shadowCanvas, cx - targetSize / 2, cy - targetSize / 2, targetSize, targetSize);

        if (ei.totality > 0.8) {
          // Brighten remaining illuminated portion of moon to increase contrast with shadowed part.
          context2.clearRect(0, 0, size, size);
          context2.filter = '';
          context2.fillStyle = `rgba(255, 255, 255, ${(ei.totality - 0.8) / 0.25})`;
          fillCircle(context2, r, r, moonR);
          context2.fillStyle = 'black';
          context2.filter = `blur(${size / 125}px)`;
          fillCircle(context2, sx, sy, uRadius);
          context.globalCompositeOperation = 'lighten';
          context.drawImage(this.shadowCanvas, cx - targetSize / 2, cy - targetSize / 2, targetSize, targetSize);
        }
      }
    }

    context.globalCompositeOperation = saveCompOp;
  }

  private setUpRenderer(): void {
    const moon = new SphereGeometry(MOON_RADIUS, 50, 50);

    moon.rotateY(-PI / 2);
    this.camera = new PerspectiveCamera(MAX_LUNAR_ANGULAR_DIAMETER / 60, 1, 100, 500000);
    this.scene = new Scene();
    this.moonMesh = new Mesh(moon, new MeshPhongMaterial({ map: new CanvasTexture(this.moonImage),
      bumpMap: this.moonBumps ? new CanvasTexture(this.moonBumps) : undefined, bumpScale: 15,
      reflectivity: 0, shininess: 0 }));
    this.scene.add(this.moonMesh);
    this.renderer = new WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.outputEncoding = sRGBEncoding;

    this.sun = new PointLight('white');
    this.scene.add(this.sun);

    this.earthShine = new AmbientLight('white');
    this.scene.add(this.earthShine);
  }
}
