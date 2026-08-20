import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MappingService } from '../../core/services/mapping.service';
import { SourceSchemaService } from '../../core/services/source-schema.service';
import { AuthService } from '../../core/services/auth.service';
import { InstitutionService } from '../../core/services/institution.service';
import { Mapping, MappingStatus } from '../../core/models/mapping.model';
import { Institution } from '../../core/models/institution.model';
import { relativeTime } from '../../core/utils/relative-time';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, MatProgressSpinnerModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly mappingService = inject(MappingService);
  private readonly sourceSchemaService = inject(SourceSchemaService);
  private readonly authService = inject(AuthService);
  private readonly institutionService = inject(InstitutionService);

  readonly mappingCount = signal<number | null>(null);
  readonly schemaCount = signal<number | null>(null);
  readonly recentMappings = signal<Mapping[]>([]);
  readonly institutions = signal<Institution[]>([]);
  readonly error = signal<string | null>(null);

  // Sadece Admin/Approver'a - digerleri onaylama yapamadigi icin bu sayi
  // onlar icin islevsiz bir bilgi olurdu.
  readonly pendingApprovalCount = signal<number | null>(null);

  // Ilk yukleme sirasinda spinner gostermek icin - mapping ve sema sayilari
  // ayri iki istekten geldigi icin, ikisi de donene kadar true kalıyor.
  // Sayfalama/arama gibi sonraki yeniden-yuklemelerde tekrar true'ya
  // donmuyor, tablo ani bir "yukleniyor" durumuna gecip gorunumu bozmasin.
  readonly loading = signal(true);
  private mappingsResolved = false;
  private schemasResolved = false;

  // Gun icinde saate gore selamlama - "Gunaydin" figma tasariminda sabit
  // yaziyordu ama akşam da "Gunaydin" gormek garip kacardi.
  readonly greeting = Dashboard.getGreeting();

  // Hero kartinin sagindaki bosluk (B secenegi, Ece'nin karari - A'da kart
  // kendi genisligine sabitlenince "kotu durdu" dendi) - dekoratif bir seyle
  // degil, zaten elde olan veriden (en son guncellenen mapping) turetilen
  // gercek bir bilgiyle dolduruluyor.
  readonly lastActivityText = computed(() => {
    const mostRecent = this.recentMappings()[0];
    return mostRecent ? relativeTime(mostRecent.updatedAt) : null;
  });

  ngOnInit(): void {
    // "page" endpoint'ini kucuk bir pageSize ile cagirmak, tum listeyi (getAll)
    // cekip client'ta saymaktan daha ucuz - zaten totalCount server'da hesaplaniyor.
    this.mappingService.getPage(0, 10, 'RecentFirst').subscribe({
      next: (result) => {
        this.mappingCount.set(result.totalCount);
        this.recentMappings.set(result.items);
        this.mappingsResolved = true;
        this.updateLoading();
      },
      error: () => {
        this.error.set('Mapping bilgileri yüklenemedi. API çalışıyor mu?');
        this.mappingsResolved = true;
        this.updateLoading();
      },
    });

    this.sourceSchemaService.getPage(0, 1, 'RecentFirst').subscribe({
      next: (result) => {
        this.schemaCount.set(result.totalCount);
        this.schemasResolved = true;
        this.updateLoading();
      },
      error: () => {
        this.error.set('Şema bilgileri yüklenemedi. API çalışıyor mu?');
        this.schemasResolved = true;
        this.updateLoading();
      },
    });

    if (this.canApprove()) {
      this.mappingService.getPage(0, 1, 'RecentFirst', '', 'PendingApproval').subscribe({
        next: (result) => this.pendingApprovalCount.set(result.totalCount),
        error: () => {}, // sessiz gec - bu banner ikincil bir bilgi, ana Panel'i engellememeli
      });
    }

    this.institutionService.getAll().subscribe({
      next: (institutions) => this.institutions.set(institutions),
      error: () => {}, // sessiz gec - mapping-list.ts'teki ayni desen, Kurum sutunu ikincil bir bilgi
    });
  }

  private updateLoading(): void {
    if (this.mappingsResolved && this.schemasResolved) {
      this.loading.set(false);
    }
  }

  targetFieldEdgeCount(mapping: Mapping): number {
    return mapping.edges.filter((e) => e.toKind === 'TargetField').length;
  }

  // mapping-list.ts'teki kurumNames/statusLabel ile ayni mantik.
  kurumNames(mapping: Mapping): string {
    if (mapping.kurumIds.length === 0) return '—';
    const names = this.institutions();
    return mapping.kurumIds.map((id) => names.find((k) => k.id === id)?.name ?? '—').join(', ');
  }

  statusLabel(status: MappingStatus): string {
    switch (status) {
      case 'Approved':
        return 'Onaylandı';
      case 'Rejected':
        return 'Reddedildi';
      default:
        return 'Onay Bekliyor';
    }
  }

  // mapping-list.ts'teki canApprove ile ayni gerekce/rol seti.
  canApprove(): boolean {
    return this.authService.hasRole('Admin', 'Approver');
  }

  // Buyuk harfe CSS'teki text-transform:uppercase yerine burada elle
  // ceviriyoruz - tarayicinin varsayilan (Turkce olmayan) buyutme kurali
  // kucuk noktali "i"yi "I" (noktasiz) yapiyor, "iyi" -> "IYI" cikiyordu,
  // dogrusu "İYİ" olmali.
  private static getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'GÜNAYDIN';
    if (hour < 18) return 'İYİ GÜNLER';
    return 'İYİ AKŞAMLAR';
  }
}
