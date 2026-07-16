using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface IMappingRepository
{
    Task<List<Mapping>> GetAllAsync();

    Task<Mapping?> GetByIdAsync(string id);

    Task<Mapping> CreateAsync(Mapping mapping);

    Task<Mapping?> UpdateAsync(Mapping mapping);
}
