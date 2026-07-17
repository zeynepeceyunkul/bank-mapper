namespace BankMapper.Application.Preview;

public class PreviewSourceFile
{
    public string SourceSchemaId { get; set; } = string.Empty;

    public Stream Content { get; set; } = Stream.Null;
}
