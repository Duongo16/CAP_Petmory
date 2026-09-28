import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { ANGLES_PREPARE, Engine3d, StandardAngle, MaterialZone } from './engine-3d';
import { PaintMode, PaintState } from './painter';

type ScreenState = 'NOT_LOADED' | 'LOADING' | 'READY' | 'ERROR' | 'UNSUPPORTED';

/** Checks whether the device can draw three-dimensional graphics at all. */
function supportsWebgl(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

@Component({
  selector: 'pm-viewer-3d',
  standalone: true,
  imports: [MatButtonToggleModule, MatProgressSpinnerModule, TranslatePipe],
  templateUrl: './viewer-3d.html',
  styleUrl: './viewer-3d.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Viewer3d {
  /** Path to the model file. Changing it reloads the model. */
  readonly pathModel = input.required<string>();

  /** Colour map by zone name. Changing it applies immediately without reloading the model. */
  readonly colorByZone = input<Record<string, string>>({});

  /** The colour currently held for painting. Empty turns paint mode off. */
  readonly colorPendingPaint = input<string | null>(null);

  /** Paint mode: brush over small patches, or flood one patch of a single colour. */
  readonly paintMode = input<PaintMode>('BRUSH');

  /** Brush size, in the model's local units. */
  readonly brushSize = input(0.06);

  /** Reports the material zones read from the model file itself. */
  readonly zoneDetected = output<MaterialZone[]>();

  /**
   * The saved colours of a draft. Setting a value reloads them as soon as the model
   * has finished loading. An empty array means the model keeps its original colours.
   */
  readonly statusPaint = input<PaintState[]>([]);

  /** Reports the set of six still images once the user presses capture. */
  readonly capturedSixAngles = output<Record<StandardAngle, string>>();

  /** Reports that the model is ready, along with a way to read the current colours for saving. */
  readonly isReady = output<void>();

  /** Reports every successful paint, so the caller can record which colours were used. */
  readonly painted = output<string>();

  private readonly wrap = viewChild.required<ElementRef<HTMLDivElement>>('wrap');
  private readonly destroyRef = inject(DestroyRef);

  private engine: Engine3d | null = null;

  readonly status = signal<ScreenState>('NOT_LOADED');
  readonly countVertex = signal(0);
  readonly autoRotate = signal(true);
  readonly angleSelected = signal<StandardAngle>('ISO');
  readonly angles = ANGLES_PREPARE;
  readonly canPaint = signal(false);
  private draggingBrush = false;

  constructor() {
    effect(() => {
      const path = this.pathModel();
      const box = this.wrap().nativeElement;
      this.initAndLoad(box, path);
    });

    effect(() => {
      const zoneMap = this.colorByZone();
      const engine = this.engine;
      if (!engine || this.status() !== 'READY') {
        return;
      }
      for (const [zone, color] of Object.entries(zoneMap)) {
        engine.changeColorZone(zone, color);
      }
    });

    this.destroyRef.onDestroy(() => {
      this.engine?.destroy();
      this.engine = null;
    });
  }

  /** While a colour is held, dragging paints instead of rotating the model. */
  private get pendingPaint(): boolean {
    return this.colorPendingPaint() !== null && this.canPaint();
  }

  startPaint(su: PointerEvent): void {
    if (!this.pendingPaint || su.button !== 0) {
      return;
    }
    su.preventDefault();
    su.stopPropagation();
    this.draggingBrush = true;
    (su.target as HTMLElement).setPointerCapture?.(su.pointerId);
    this.paintAtEvent(su);
  }

  dragPaint(su: PointerEvent): void {
    if (!this.draggingBrush || this.paintMode() === 'FILL') {
      return;
    }
    su.preventDefault();
    this.paintAtEvent(su);
  }

  endPaint(su: PointerEvent): void {
    if (!this.draggingBrush) {
      return;
    }
    this.draggingBrush = false;
    (su.target as HTMLElement).releasePointerCapture?.(su.pointerId);
  }

  undo(): void {
    this.engine?.undoPaint();
  }

  /** Reads the current colour of every face, used when saving a draft. */
  readStatusPaint(): PaintState[] {
    return this.engine?.exportStatusPaint() ?? [];
  }

  private paintAtEvent(su: PointerEvent): void {
    const color = this.colorPendingPaint();
    if (!color) {
      return;
    }
    const box = (su.currentTarget as HTMLElement).getBoundingClientRect();
    const painted = this.engine?.paintAtPoint(
      (su.clientX - box.left) / box.width,
      (su.clientY - box.top) / box.height,
      color,
      this.paintMode(),
      this.brushSize(),
    );
    if (painted) {
      this.painted.emit(color);
    }
  }

  changeAngle(angle: StandardAngle): void {
    this.angleSelected.set(angle);
    this.autoRotate.set(false);
    this.engine?.setAutoRotate(false);
    this.engine?.setAngle(angle);
  }

  toggleAutoRotate(): void {
    const toggle = !this.autoRotate();
    this.autoRotate.set(toggle);
    this.engine?.setAutoRotate(toggle);
  }

  captureSixAngles(): void {
    const bundle = this.engine?.captureSixAngles();
    if (bundle) {
      this.capturedSixAngles.emit(bundle);
    }
  }

  keyAngle(angle: StandardAngle): string {
    return `VIEWER.ANGLE.${angle}`;
  }

  private initAndLoad(box: HTMLDivElement, path: string): void {
    if (!supportsWebgl()) {
      this.status.set('UNSUPPORTED');
      return;
    }
    if (!this.engine) {
      this.engine = new Engine3d(box, {
        baseModel: getComputedStyle(box).getPropertyValue('--pm-bg-3d').trim() || '#f2efed',
        maxPixelRatio: 2,
      });
      this.engine.setAutoRotate(this.autoRotate());
    }

    this.status.set('LOADING');
    this.engine
      .loadModel(path)
      .then((kq) => {
        this.countVertex.set(kq.countVertex);
        this.status.set('READY');
        this.canPaint.set(this.engine?.canPaint ?? false);
        this.zoneDetected.emit(kq.zone);
        for (const [zone, color] of Object.entries(this.colorByZone())) {
          this.engine?.changeColorZone(zone, color);
        }
        const saved = this.statusPaint();
        if (saved.length > 0) {
          this.engine?.loadStatusPaint(saved);
        }
        this.isReady.emit();
      })
      .catch(() => this.status.set('ERROR'));
  }
}
