using BankMapper.Domain.Entities;

namespace BankMapper.Application.Abstractions;

public interface IFileTypeRepository
{
    Task<List<FileType>> GetByProductIdAsync(string productId);
}
