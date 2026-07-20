namespace BankMapper.Application.Preview;

public interface IPreviewService
{
    Task<PreviewExecuteResult> ExecuteAsync(string mappingId, IReadOnlyList<PreviewSourceFile> files);

    Task<string> ConvertToCsvAsync(string mappingId, IReadOnlyList<PreviewSourceFile> files);
}
