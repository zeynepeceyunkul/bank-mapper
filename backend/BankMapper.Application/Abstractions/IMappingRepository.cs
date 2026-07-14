using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface IMappingRepository
{
    Task<Mapping> CreateAsync(Mapping mapping);
}
