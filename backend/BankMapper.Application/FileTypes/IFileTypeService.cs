namespace BankMapper.Application.FileTypes;

public interface IFileTypeService
{
    Task<List<FileTypeDto>> GetFileTypesByProductIdAsync(string productId);
}
