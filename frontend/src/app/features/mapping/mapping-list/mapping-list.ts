import { DatePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MappingService } from '../../../core/services/mapping.service';
import { Mapping } from '../../../core/models/mapping.model';

@Component({
  selector: 'app-mapping-list',
  imports: [RouterLink, DatePipe],
  templateUrl: './mapping-list.html',
  styleUrl: './mapping-list.scss',
})
export class MappingList implements OnInit {
  private readonly mappingService = inject(MappingService);

  readonly mappings = signal<Mapping[]>([]);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadMappings();
  }

  loadMappings(): void {
    this.error.set(null);
    this.mappingService.getAll().subscribe({
      next: (mappings) => this.mappings.set(mappings),
      error: () => this.error.set('Mapping listesi yüklenemedi. API çalışıyor mu?'),
    });
  }

  targetFieldEdgeCount(mapping: Mapping): number {
    return mapping.edges.filter((e) => e.toKind === 'TargetField').length;
  }
}
