using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface ISourceSchemaRepository
{
    Task<List<SourceSchema>> GetAllAsync();

    Task<SourceSchema> CreateAsync(SourceSchema schema);
}
