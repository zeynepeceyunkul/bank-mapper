import { __decorate } from "tslib";
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { environment } from '../../../environments/environment';
let ProductService = class ProductService {
    http = inject(HttpClient);
    getProducts() {
        return this.http.get(`${environment.apiUrl}/products`);
    }
    getFileTypesByProductId(productId) {
        return this.http.get(`${environment.apiUrl}/products/${productId}/file-types`);
    }
};
ProductService = __decorate([
    Injectable({ providedIn: 'root' })
], ProductService);
export { ProductService };
