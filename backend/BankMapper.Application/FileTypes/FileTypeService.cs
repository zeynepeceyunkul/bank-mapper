using BankMapper.Application.Abstractions;

namespace BankMapper.Application.FileTypes;

public class FileTypeService(IFileTypeRepository fileTypeRepository) : IFileTypeService
{
    public async Task<List<FileTypeDto>> GetFileTypesByProductIdAsync(string productId)
    {
        var fileTypes = await fileTypeRepository.GetByProductIdAsync(productId);

        return fileTypes
            .Select(ft => new FileTypeDto
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
            })
            .ToList();
    }
}
