import { Component, OnInit, inject, signal } from '@angular/core';
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
  imports: [MatPaginatorModule, MatProgressSpinnerModule],
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

  readonly roles: UserRole[] = ['Viewer', 'MappingDefiner', 'Approver', 'SuperAdmin'];

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

  // Onceden [ngModel] / [selected] binding'ine guveniyordu - onay penceresi
  // "Iptal" ile kapatilinca ALTTAKI veri hic degismiyordu (bu metod erken
  // donuyordu) ama tarayicinin NATIF <select>'i kullanicinin tikladigi
  // degeri zaten gostermis oluyordu. Angular'in bunu kendiliginden geri
  // duzeltmesini beklemek (ister ngModel, ister [selected] binding'i ile
  // olsun) GUVENILMEZ cikti - canli test edip DevTools'tan dogruladim:
  // sinyale "dokunma" (bkz. eski deneme) DAHI select'in gercek DOM degerini
  // (option.selected) geri yazmiyordu, muhtemelen bu projenin zoneless
  // olmasi + native <select>'in kendi ic durumunun Angular'in bakis acisindan
  // "hicbir sey degismedi" sayilmasi birlesimi (Ece'nin canli yakaladigi bug,
  // 2026-08-25 - veri hic bozulmuyordu, sadece dropdown yanlis gorunuyordu).
  // Kesin cozum: mapping-editor.ts'teki "select'i tamamen elle yonet"
  // deseniyle ayni - native elementin kendisini alip iptal/hata durumunda
  // .value'sunu DOGRUDAN elle geri yaziyoruz, Angular'in binding'ine
  // guvenmiyoruz.
  async onRoleChange(user: User, selectEl: HTMLSelectElement): Promise<void> {
    const newRole = selectEl.value as UserRole;
    if (newRole === user.role) return;

    const confirmed = await this.confirmService.confirm(
      `${user.email} kullanıcısının rolünü '${user.role}' → '${newRole}' olarak değiştirmek istediğinize emin misiniz?`,
    );
    if (!confirmed) {
      selectEl.value = user.role;
      return;
    }

    const previousRole = user.role;
    this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));

    this.userService.updateRole(user.id, newRole).subscribe({
      next: () => this.toastService.success(`${user.email} artık ${newRole}`),
      error: (err) => {
        selectEl.value = previousRole;
        // Basarisiz olursa gorsel olarak eski role geri don - kullanici
        // dropdown'da yanlis bir degeri gorup dogruymus gibi guvenmesin.
        this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, role: previousRole } : u)));
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Rol güncellenemedi. API çalışıyor mu?');
      },
    });
  }
}
