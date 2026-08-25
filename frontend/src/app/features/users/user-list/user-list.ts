import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { UserService } from '../../../core/services/user.service';
import { ToastService } from '../../../core/services/toast.service';
import { AuthService } from '../../../core/services/auth.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { PageAccessService } from '../../../core/services/page-access.service';
import { User, UserRole } from '../../../core/models/user.model';
import { SortOption } from '../../../core/models/paged-result.model';

@Component({
  selector: 'app-user-list',
  imports: [FormsModule, MatPaginatorModule, MatProgressSpinnerModule],
  templateUrl: './user-list.html',
  styleUrl: './user-list.scss',
})
export class UserList implements OnInit {
  private readonly userService = inject(UserService);
  private readonly toastService = inject(ToastService);
  private readonly authService = inject(AuthService);
  private readonly confirmService = inject(ConfirmService);
  private readonly pageAccessService = inject(PageAccessService);

  readonly users = signal<User[]>([]);
  readonly error = signal<string | null>(null);

  // institution-list.ts'teki ayni desen - sadece ilk yukleme icin.
  readonly loading = signal(true);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly totalCount = signal(0);
  readonly pageSizeOptions = [5, 10, 25, 50];
  readonly sort = signal<SortOption>('NameAscending');
  readonly search = signal('');
  private searchDebounceHandle?: ReturnType<typeof setTimeout>;

  // '' = tum roller.
  readonly roleFilter = signal<UserRole | ''>('');

  readonly roles: UserRole[] = ['Viewer', 'MappingDefiner', 'Approver', 'Admin'];

  // roleGuard sayfayi hep aciyor artik (bkz. role.guard.ts, PageAccessService) -
  // yetkisiz erisimde veri cekmeyi hic denemiyoruz, yoksa backend'in 403'u
  // kendi genel "API calisiyor mu?" hata mesajimizi tetikleyip app-unauthorized-modal
  // ile ayni anda gorunup kafa karistiriyordu (Ece'nin canli yakaladigi bug).
  ngOnInit(): void {
    if (this.pageAccessService.denied()) {
      this.loading.set(false);
      return;
    }
    this.loadUsers();
  }

  loadUsers(): void {
    this.error.set(null);
    this.userService.getPage(this.pageIndex(), this.pageSize(), this.sort(), this.search(), this.roleFilter() || undefined).subscribe({
      next: (result) => {
        this.users.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Kullanıcı listesi yüklenemedi. API çalışıyor mu?');
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadUsers();
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounceHandle);
    this.searchDebounceHandle = setTimeout(() => {
      this.pageIndex.set(0);
      this.loadUsers();
    }, 300);
  }

  onRoleFilterChange(value: string): void {
    this.roleFilter.set(value as UserRole | '');
    this.pageIndex.set(0);
    this.loadUsers();
  }

  // Bir Admin bu ekrandan kendi rolunu degistiremesin diye (Ece'nin karari,
  // 2026-08-20) - yanlislikla kendini Admin'likten dusurup kilitli kalma
  // riskini onler. Backend de ayni kisitlamayi zorluyor (UserService.
  // UpdateRoleAsync), burasi sadece kullanici deneyimini duzeltiyor.
  isCurrentUser(user: User): boolean {
    return user.email === this.authService.email();
  }

  // [ngModel] tek-yonlu bagli (user.role'den okuyor, ondan yazmiyor) - onay
  // reddedilirse hicbir seyi guncellemeden donuyoruz, bir sonraki change
  // detection turunda select DOM'u zaten user.role'e (degismedi) geri
  // senkronlaniyor, hata-durumundaki rollback ile ayni mekanizma.
  async onRoleChange(user: User, value: string): Promise<void> {
    const newRole = value as UserRole;
    if (newRole === user.role) return;

    const confirmed = await this.confirmService.confirm(
      `${user.email} kullanıcısının rolünü '${user.role}' → '${newRole}' olarak değiştirmek istediğinize emin misiniz?`,
    );
    if (!confirmed) return;

    const previousRole = user.role;
    this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));

    this.userService.updateRole(user.id, newRole).subscribe({
      next: () => this.toastService.success(`${user.email} artık ${newRole}`),
      error: (err) => {
        // Basarisiz olursa gorsel olarak eski role geri don - kullanici
        // dropdown'da yanlis bir degeri gorup dogruymus gibi guvenmesin.
        this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, role: previousRole } : u)));
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Rol güncellenemedi. API çalışıyor mu?');
      },
    });
  }
}
