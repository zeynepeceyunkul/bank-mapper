import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
import { FileType } from '../../../core/models/file-type.model';
import { Product } from '../../../core/models/product.model';

@Component({
  selector: 'app-product-file-types',
  imports: [FormsModule],
  templateUrl: './product-file-types.html',
  styleUrl: './product-file-types.scss',
})
export class ProductFileTypes implements OnInit {
  private readonly productService = inject(ProductService);

  readonly products = signal<Product[]>([]);
  readonly fileTypes = signal<FileType[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  selectedProductId = '';
  selectedFileTypeId = '';

  ngOnInit(): void {
    this.productService.getProducts().subscribe({
      next: (products) => this.products.set(products),
      error: () => this.error.set('Ürünler yüklenemedi. API çalışıyor mu?'),
    });
  }

  onProductChange(): void {
    this.fileTypes.set([]);
    this.selectedFileTypeId = '';

    if (!this.selectedProductId) {
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.productService.getFileTypesByProductId(this.selectedProductId).subscribe({
      next: (fileTypes) => {
        this.fileTypes.set(fileTypes);
        this.selectedFileTypeId = fileTypes[0]?.id ?? '';
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Dosya tipleri yüklenemedi. API çalışıyor mu?');
        this.loading.set(false);
      },
    });
  }

  get selectedFileType(): FileType | undefined {
    return this.fileTypes().find((ft) => ft.id === this.selectedFileTypeId);
  }
}
