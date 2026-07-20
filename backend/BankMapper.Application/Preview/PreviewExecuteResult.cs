namespace BankMapper.Application.Preview;

public class PreviewExecuteResult
{
    public List<Dictionary<string, object?>> Rows { get; set; } = [];

    public List<string> Warnings { get; set; } = [];
}
