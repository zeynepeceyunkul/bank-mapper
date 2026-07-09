using BankMapper.Application.Abstractions;

namespace BankMapper.Application.Products;

public class ProductService(IProductRepository productRepository) : IProductService
{
    public async Task<List<ProductDto>> GetAllAsync()
    {
        var products = await productRepository.GetAllAsync();

        return products
            .Select(p => new ProductDto { Id = p.Id, Code = p.Code, Name = p.Name })
            .ToList();
    }
}
