import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MappingService } from '../../core/services/mapping.service';
import { SourceSchemaService } from '../../core/services/source-schema.service';
import { AuthService } from '../../core/services/auth.service';
import { InstitutionService } from '../../core/services/institution.service';
import { Mapping, MappingStatus } from '../../core/models/mapping.model';
import { Institution } from '../../core/models/institution.model';
import { relativeTime } from '../../core/utils/relative-time';

// Bir mapping onaylandiktan sonra hep Onaylandi kalir - reddedilenin aksine
// kendiliginden "cozulup" listeden dusmuyor. Bu yuzden "su an onaylanmis TUM
// mapping'lerim" saymak zamanla surekli buyuyup anlamsizlasirdi (6 ay sonra
// "47 mapping'iniz onaylandi" gibi). Ece'nin karari (2026-08-22): sadece EN
// SON GORDUGUNDEN BERI onaylananlar sayilsin - bu yuzden "gorulme zamani"
// e-posta bazli localStorage'da tutuluyor (auth.service.ts'teki ayni
// "bankmapper_" onek deseni). Ilk hic kaydi olmayan kullanicida varsayilan
// "simdi" - epoch/hep-goster degil, yoksa feature'in ilk yayina girdigi anda
// gecmisteki TUM eski onaylari bir kerede "yeni" gibi gosterip gurultu
// yaratirdi; bu sadece BUNDAN SONRAKI onaylari "yeni" sayar.
const APPROVED_SEEN_KEY_PREFIX = 'bankmapper_approved_seen_';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatProgressSpinnerModule],
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

  // Ece'nin karari (2026-08-22): bir mapping reddedildiginde tanimlayan kisi
  // bunu ANCAK Kayitli Mapping'ler'e gidip "Sadece Benim" + "Reddedildi"
  // filtresini kendi basina uygularsa goruyordu - pasif kesif yeterli
  // degildi, "uygulamaya girince gormeliyim" dedi. pendingApprovalCount ile
  // ayni banner deseni burada da kullaniliyor, rol kontrolu yok (canApprove
  // gibi) - zaten sadece Create yapabilen roller (Admin/MappingDefiner)
  // CreatedBy'da kendi e-postasini bulabilir, digerleri icin sorgu zaten 0 doner.
  //
  // Ece'nin 2. karari, ayni gun: banner'in Kayitli Mapping'ler'e yonlendirip
  // orada filtre+listeyi taratmasi "cok mantiksiz" bulundu - onun yerine
  // banner'a tikladiginda DOGRUDAN bir pop-up'ta isim+gerekce gorunmeli,
  // baska bir sayfaya gecmeden. Bu yuzden sadece sayi degil, mapping'lerin
  // kendisi (ad+gerekce) de burada tutuluyor.
  readonly myRejectedMappings = signal<Mapping[]>([]);
  readonly showRejectedModal = signal(false);

  // Onay icin ayni desen - Ece'nin karari: gerekce YOK (sadece red gerekce
  // tasiyor), sadece "onaylandi" bilgisi yeterli, o yuzden pop-up'ta liste
  // sadece isim gosteriyor (bkz. dashboard.html'deki ayri .approved-list).
  readonly myApprovedMappings = signal<Mapping[]>([]);
  readonly showApprovedModal = signal(false);

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

    const myEmail = this.authService.email();
    if (myEmail) {
      // pageSize 25 - pop-up icin, gercekci kullanimda kimsenin ayni anda
      // bu kadar cok reddedilen mapping'i olmaz, olursa da sayfalama yerine
      // pop-up'in kendi ic scroll'una birakiliyor (bkz. dashboard.scss).
      this.mappingService.getPage(0, 25, 'RecentFirst', '', 'Rejected', myEmail).subscribe({
        next: (result) => this.myRejectedMappings.set(result.items),
        error: () => {}, // sessiz gec - bu banner ikincil bir bilgi, ana Panel'i engellememeli
      });
      this.mappingService.getPage(0, 25, 'RecentFirst', '', 'Approved', myEmail).subscribe({
        next: (result) => {
          const lastSeen = this.getApprovedSeenAt(myEmail);
          const newlyApproved = result.items.filter((m) => m.approvedAt && new Date(m.approvedAt) > lastSeen);
          this.myApprovedMappings.set(newlyApproved);
        },
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

  toggleRejectedModal(): void {
    this.showRejectedModal.update((v) => !v);
  }

  // "Gorulme zamani" sadece POP-UP ACILINCA (banner'a bakmak degil, listeyi
  // gercekten gorunce) guncelleniyor - aksi halde banner render olur olmaz
  // "gorulmus" sayilip kullanici hic tiklamadan bilgiyi kacirabilirdi.
  toggleApprovedModal(): void {
    const opening = !this.showApprovedModal();
    this.showApprovedModal.set(opening);
    if (opening) {
      const myEmail = this.authService.email();
      if (myEmail) {
        this.setApprovedSeenAt(myEmail, new Date());
      }
    }
  }

  // Kayit yoksa sadece bellekte "simdi" donmekle YETINMIYORUZ - hemen
  // kaydediyoruz da. Yoksa her sayfa yuklemesinde taban "simdi"ye kayar ve
  // aradan gercekten yeni bir onay gecmis olsa bile "eskisinden once
  // onaylanmis" gibi gorunup asla "yeni" sayilmazdi (taban hep bir sonraki
  // yuklemenin kendi anina esitlenirdi).
  private getApprovedSeenAt(email: string): Date {
    const stored = localStorage.getItem(APPROVED_SEEN_KEY_PREFIX + email);
    if (stored) {
      return new Date(stored);
    }
    const now = new Date();
    this.setApprovedSeenAt(email, now);
    return now;
  }

  private setApprovedSeenAt(email: string, date: Date): void {
    localStorage.setItem(APPROVED_SEEN_KEY_PREFIX + email, date.toISOString());
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
