import { __decorate } from "tslib";
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../../core/services/product.service';
let ProductFileTypes = class ProductFileTypes {
    productService = inject(ProductService);
    products = signal([]);
    fileTypes = signal([]);
    loading = signal(false);
    error = signal(null);
    selectedProductId = '';
    selectedFileTypeId = '';
    ngOnInit() {
        this.productService.getProducts().subscribe({
            next: (products) => this.products.set(products),
            error: () => this.error.set('Ürünler yüklenemedi. API çalışıyor mu?'),
        });
    }
    onProductChange() {
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
    get selectedFileType() {
        return this.fileTypes().find((ft) => ft.id === this.selectedFileTypeId);
    }
};
ProductFileTypes = __decorate([
    Component({
        selector: 'app-product-file-types',
        imports: [FormsModule],
        templateUrl: './product-file-types.html',
        styleUrl: './product-file-types.scss',
    })
], ProductFileTypes);
export { ProductFileTypes };
