namespace BankMapper.Application.Preview;

public interface IPreviewService
{
    Task<List<Dictionary<string, object?>>> ExecuteAsync(string mappingId, Stream file);
}
