import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from './core/services/language.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: '<router-outlet />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App implements OnInit {
  private readonly language = inject(LanguageService);

  /*
   * Doc ra de dich vu giao dien duoc dung len ngay tu goc. Truoc day no chi
   * duoc dung len khi co nut bam trong khung chinh, nen man dang nhap va dang
   * ky khong theo lua chon sang toi nao ca.
   */
  private readonly theme = inject(ThemeService);

  ngOnInit(): void {
    // Dung ngon ngu nguoi doc da chon lan truoc, mac dinh la tieng Viet.
    this.language.start();
  }
}
