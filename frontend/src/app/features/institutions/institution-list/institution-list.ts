import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { InstitutionService } from '../../../core/services/institution.service';
import { ToastService } from '../../../core/services/toast.service';
import { ConfirmService } from '../../../core/services/confirm.service';
import { AuthService } from '../../../core/services/auth.service';
import { Institution } from '../../../core/models/institution.model';
import { SortOption } from '../../../core/models/paged-result.model';

@Component({
  selector: 'app-institution-list',
  imports: [FormsModule, MatButtonModule, MatIconModule, MatPaginatorModule, MatProgressSpinnerModule],
  templateUrl: './institution-list.html',
  styleUrl: './institution-list.scss',
})
export class InstitutionList implements OnInit {
  private readonly institutionService = inject(InstitutionService);
  private readonly toastService = inject(ToastService);
  private readonly confirmService = inject(ConfirmService);
  private readonly authService = inject(AuthService);

  readonly institutions = signal<Institution[]>([]);
  readonly error = signal<string | null>(null);

  // mapping-list.ts'teki ayni desen - sadece ilk yukleme icin.
  readonly loading = signal(true);

  readonly pageIndex = signal(0);
  readonly pageSize = signal(10);
  readonly totalCount = signal(0);
  readonly pageSizeOptions = [5, 10, 25, 50];
  readonly sort = signal<SortOption>('NameAscending');
  readonly search = signal('');
  private searchDebounceHandle?: ReturnType<typeof setTimeout>;

  newInstitutionName = '';
  readonly creating = signal(false);

  ngOnInit(): void {
    this.loadInstitutions();
  }

  // "Ekle" formu/Sil butonu gizlenmiyor (bu oturumda kurdugumuz "gizle degil
  // uyar" prensibi, bkz. mapping-editor.ts'teki requireEditPermission) -
  // gercek kisitlama burada ve createInstitution/deleteInstitution'in
  // basinda yapiliyor.
  canManageInstitutions(): boolean {
    return this.authService.hasRole('Admin', 'MappingDefiner');
  }

  loadInstitutions(): void {
    this.error.set(null);
    this.institutionService.getPage(this.pageIndex(), this.pageSize(), this.sort(), this.search()).subscribe({
      next: (result) => {
        this.institutions.set(result.items);
        this.totalCount.set(result.totalCount);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Kurum listesi yüklenemedi. API çalışıyor mu?');
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: PageEvent): void {
    this.pageIndex.set(event.pageIndex);
    this.pageSize.set(event.pageSize);
    this.loadInstitutions();
  }

  onSortChange(value: SortOption): void {
    this.sort.set(value);
    this.pageIndex.set(0);
    this.loadInstitutions();
  }

  onSearchChange(value: string): void {
    this.search.set(value);
    clearTimeout(this.searchDebounceHandle);
    this.searchDebounceHandle = setTimeout(() => {
      this.pageIndex.set(0);
      this.loadInstitutions();
    }, 300);
  }

  createInstitution(): void {
    if (!this.canManageInstitutions()) {
      this.toastService.error('Bu işlem için yetkiniz yok.');
      return;
    }
    if (!this.newInstitutionName.trim()) {
      return;
    }

    this.creating.set(true);
    this.institutionService.create({ name: this.newInstitutionName.trim() }).subscribe({
      next: (institution) => {
        this.creating.set(false);
        this.newInstitutionName = '';
        this.pageIndex.set(0);
        this.loadInstitutions();
        this.toastService.success(`Eklendi: ${institution.name}`);
      },
      error: (err) => {
        this.creating.set(false);
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Kurum eklenemedi. API çalışıyor mu?');
      },
    });
  }

  async deleteInstitution(institution: Institution): Promise<void> {
    if (!this.canManageInstitutions()) {
      this.toastService.error('Bu işlem için yetkiniz yok.');
      return;
    }

    const confirmed = await this.confirmService.confirm(`'${institution.name}' kurumunu silmek istediğinize emin misiniz?`);
    if (!confirmed) return;

    this.institutionService.delete(institution.id).subscribe({
      next: () => {
        if (this.institutions().length === 1 && this.pageIndex() > 0) {
          this.pageIndex.update((i) => i - 1);
        }
        this.loadInstitutions();
        this.toastService.success(`Silindi: ${institution.name}`);
      },
      error: (err) => {
        this.toastService.error(typeof err.error === 'string' ? err.error : 'Kurum silinemedi. API çalışıyor mu?');
      },
    });
  }
}
