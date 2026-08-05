using BankMapper.Domain.Enums;

namespace BankMapper.Application.Preview;

public interface IPreviewService
{
    Task<PreviewExecuteResult> ExecuteAsync(string mappingId, IReadOnlyList<PreviewSourceFile> files);

    Task<ConvertResult> ConvertAsync(string mappingId, IReadOnlyList<PreviewSourceFile> files, FileFormat format);
}
