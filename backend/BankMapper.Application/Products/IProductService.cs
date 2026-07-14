namespace BankMapper.Application.Products;

public interface IProductService
{
    Task<List<ProductDto>> GetAllAsync();
}
