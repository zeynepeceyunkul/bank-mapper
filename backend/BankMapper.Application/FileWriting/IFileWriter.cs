namespace BankMapper.Application.FileWriting;

public interface IFileWriter
{
    byte[] Write(List<Dictionary<string, object?>> rows);

    string ContentType { get; }

    string FileExtension { get; }
}
