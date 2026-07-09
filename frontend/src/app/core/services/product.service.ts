import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { FileType } from '../models/file-type.model';
import { Product } from '../models/product.model';

@Injectable({ providedIn: 'root' })
export class ProductService {
  private readonly http = inject(HttpClient);

  getProducts(): Observable<Product[]> {
    return this.http.get<Product[]>(`${environment.apiUrl}/products`);
  }

  getFileTypesByProductId(productId: string): Observable<FileType[]> {
    return this.http.get<FileType[]>(`${environment.apiUrl}/products/${productId}/file-types`);
  }
}
