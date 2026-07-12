namespace BankMapper.Application.FileParsing;

public class ParsedFileResult
{
    public List<string> FieldNames { get; set; } = [];

    public List<Dictionary<string, string?>> Rows { get; set; } = [];
}
