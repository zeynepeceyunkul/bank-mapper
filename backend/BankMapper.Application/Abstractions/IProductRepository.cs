using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface IProductRepository
{
    Task<List<Product>> GetAllAsync();
}
