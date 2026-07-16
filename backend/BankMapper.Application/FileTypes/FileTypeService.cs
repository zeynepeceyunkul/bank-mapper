using BankMapper.Application.Abstractions;
using BankMapper.Domain.Entities;

namespace BankMapper.Application.FileTypes;

public class FileTypeService(IFileTypeRepository fileTypeRepository) : IFileTypeService
{
    public async Task<List<FileTypeDto>> GetFileTypesByProductIdAsync(string productId)
    {
        var fileTypes = await fileTypeRepository.GetByProductIdAsync(productId);
        return fileTypes.Select(ToDto).ToList();
    }

    public async Task<FileTypeDto?> GetByIdAsync(string id)
    {
        var fileType = await fileTypeRepository.GetByIdAsync(id);
        return fileType is null ? null : ToDto(fileType);
    }

    private static FileTypeDto ToDto(FileType ft) => new()
    {
        Id = ft.Id,
        ProductId = ft.ProductId,
        Code = ft.Code,
        Name = ft.Name,
        TargetFields = ft.TargetFields
            .Select(tf => new TargetFieldDto
            {
                Name = tf.Name,
                Type = tf.Type,
                Order = tf.Order,
                Length = tf.Length
            })
            .ToList()
    };
}
