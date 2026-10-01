import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

type OnboardingStep = 1 | 2 | null;

@Component({
  selector: 'pm-guest-home-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './guest-home-page.html',
  styleUrl: './guest-home-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestHomePage {
  readonly onboardingStep = signal<OnboardingStep>(null);

  readonly features = [
    {
      icon: '📖',
      title: 'Nhật ký thú cưng',
      description: 'Ghi lại từng khoảnh khắc đáng yêu — ảnh, video, bài đăng cộng đồng. Cuốn nhật ký số mãi mãi bên bạn.',
      tone: 'amber',
    },
    {
      icon: '✨',
      title: 'Kỷ niệm & Memories',
      description: 'Petmory tự động tạo lại kỷ niệm đáng nhớ theo ngày tháng. Những moment quan trọng không bao giờ bị lãng quên.',
      tone: 'accent',
    },
    {
      icon: '🛍️',
      title: 'Cửa hàng & Studio',
      description: 'Chọn quà, đặt sản phẩm thú cưng cá nhân hóa từ studio độc đáo. Mỗi món quà là một kỷ niệm.',
      tone: 'success',
    },
    {
      icon: '🐾',
      title: 'Cộng đồng yêu thú cưng',
      description: 'Kết nối với hàng nghìn sen yêu thú cưng khắp Việt Nam. Chia sẻ, học hỏi, và lan toả yêu thương.',
      tone: 'memorial',
    },
  ] as const;

  readonly steps = [
    {
      number: '01',
      icon: '👤',
      title: 'Tạo tài khoản',
      description: 'Đăng ký miễn phí chỉ trong vài giây. Không cần thẻ tín dụng.',
      tone: 'accent',
    },
    {
      number: '02',
      icon: '🐾',
      title: 'Thêm thú cưng',
      description: 'Tạo hồ sơ cho bé — tên, giống, ảnh đại diện và thông tin sức khoẻ.',
      tone: 'amber',
    },
    {
      number: '03',
      icon: '📸',
      title: 'Ghi lại kỷ niệm',
      description: 'Đăng ảnh, viết nhật ký và để Petmory lưu giữ hành trình cùng bé yêu.',
      tone: 'success',
    },
  ] as const;

  openOnboarding(): void { this.onboardingStep.set(1); }
  nextOnboardingStep(): void { this.onboardingStep.set(2); }
  closeOnboarding(): void { this.onboardingStep.set(null); }
}
