import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';
import { Icon } from '../../shared/icon/icon';
import {
  KnowledgeEntry,
  KnowledgeInput,
  KnowledgeTopic,
} from '../../core/services/assistant-knowledge.service';
import { TOPIC_KEYS } from './knowledge-topics';

export interface KnowledgeFormInput {
  /** Rong khi them muc moi. */
  entry: KnowledgeEntry | null;
  /** Ma cac muc khac, de chon cau goi y tiep theo. */
  codes: string[];
}

/** Cac o dien san tro ly hieu, de nguoi soan chen vao cau tra loi. */
const SLOTS = ['{{BANG_GIA}}', '{{KICH_CO}}', '{{THOI_GIAN}}', '{{CHAT_LIEU}}', '{{SO_NGAY_GIAO}}', '{{HANG_CO_SAN}}'];

/** Tach mot dong chu thanh danh sach, bo khoang trang va dong rong. */
function listOf(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((one) => one.trim())
    .filter((one) => one.length > 0);
}

/** Hop thoai them hoac sua mot muc hoi dap cua tro ly. */
@Component({
  selector: 'pm-knowledge-form-dialog',
  standalone: true,
  imports: [ReactiveFormsModule, TranslatePipe, Icon],
  templateUrl: './knowledge-form-dialog.html',
  styleUrl: './knowledge-form-dialog.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KnowledgeFormDialog {
  private readonly fb = inject(FormBuilder);
  private readonly ref = inject<MatDialogRef<KnowledgeFormDialog, KnowledgeInput>>(MatDialogRef);
  readonly data = inject<KnowledgeFormInput>(MAT_DIALOG_DATA);

  readonly editing = this.data.entry !== null;
  readonly topics = TOPIC_KEYS;
  readonly slots = SLOTS;
  readonly others = this.data.codes.filter((one) => one !== this.data.entry?.code);

  readonly form = this.fb.nonNullable.group({
    code: [
      { value: this.data.entry?.code ?? '', disabled: this.editing },
      [Validators.required, Validators.pattern(/^[A-Za-z0-9_-]{2,40}$/)],
    ],
    question: [this.data.entry?.question ?? '', [Validators.required, Validators.minLength(3), Validators.maxLength(160)]],
    keywords: [(this.data.entry?.keywords ?? []).join(', '), [Validators.required]],
    answer: [this.data.entry?.answer ?? '', [Validators.required, Validators.minLength(3), Validators.maxLength(2000)]],
    link: [this.data.entry?.link ?? '', [Validators.pattern(/^(\/[A-Za-z0-9\-_/?=&.]*)?$/)]],
    topic: [(this.data.entry?.topic ?? 'OTHER') as KnowledgeTopic],
    followUp: [this.data.entry?.followUp ?? ([] as string[])],
    starter: [this.data.entry?.starter ?? false],
    enabled: [this.data.entry?.enabled ?? true],
    sortOrder: [this.data.entry?.sortOrder ?? 100, [Validators.min(0), Validators.max(9999)]],
  });

  /** Chen mot o dien san vao cuoi cau tra loi. */
  addSlot(slot: string): void {
    const now = this.form.controls.answer.value;
    this.form.controls.answer.setValue(now ? `${now} ${slot}` : slot);
    this.form.controls.answer.markAsDirty();
  }

  /** Cac cau goi y tiep dang chon, giu song song voi o trong bieu mau de khung nhin doc san. */
  private readonly chosen = signal<string[]>(this.data.entry?.followUp ?? []);

  readonly followChips = computed(() =>
    this.others.map((code) => ({ code, on: this.chosen().includes(code) })),
  );

  toggleFollowUp(code: string): void {
    const now = this.chosen();
    const next = now.includes(code) ? now.filter((one) => one !== code) : [...now, code];
    this.chosen.set(next);
    this.form.controls.followUp.setValue(next);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    this.ref.close({
      code: raw.code.trim().toUpperCase(),
      question: raw.question.trim(),
      keywords: listOf(raw.keywords),
      answer: raw.answer.trim(),
      link: raw.link.trim(),
      topic: raw.topic,
      followUp: raw.followUp,
      starter: raw.starter,
      enabled: raw.enabled,
      sortOrder: Number(raw.sortOrder),
    });
  }

  close(): void {
    this.ref.close();
  }
}
