import { Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MappingService } from '../../core/services/mapping.service';
import { SourceSchemaService } from '../../core/services/source-schema.service';
import { Mapping } from '../../core/models/mapping.model';

@Component({
  selector: 'app-dashboard',
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard implements OnInit {
  private readonly mappingService = inject(MappingService);
  private readonly sourceSchemaService = inject(SourceSchemaService);

  readonly mappingCount = signal<number | null>(null);
  readonly schemaCount = signal<number | null>(null);
  readonly recentMappings = signal<Mapping[]>([]);
  readonly error = signal<string | null>(null);

  // Gun icinde saate gore selamlama - "Gunaydin" figma tasariminda sabit
  // yaziyordu ama akşam da "Gunaydin" gormek garip kacardi.
  readonly greeting = Dashboard.getGreeting();

  ngOnInit(): void {
    // "page" endpoint'ini kucuk bir pageSize ile cagirmak, tum listeyi (getAll)
    // cekip client'ta saymaktan daha ucuz - zaten totalCount server'da hesaplaniyor.
    this.mappingService.getPage(0, 5, 'RecentFirst').subscribe({
      next: (result) => {
        this.mappingCount.set(result.totalCount);
        this.recentMappings.set(result.items);
      },
      error: () => this.error.set('Mapping bilgileri yüklenemedi. API çalışıyor mu?'),
    });

    this.sourceSchemaService.getPage(0, 1, 'RecentFirst').subscribe({
      next: (result) => this.schemaCount.set(result.totalCount),
      error: () => this.error.set('Şema bilgileri yüklenemedi. API çalışıyor mu?'),
    });
  }

  targetFieldEdgeCount(mapping: Mapping): number {
    return mapping.edges.filter((e) => e.toKind === 'TargetField').length;
  }

  private static getGreeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Günaydın';
    if (hour < 18) return 'İyi günler';
    return 'İyi akşamlar';
  }
}
