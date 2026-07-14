using BankMapper.Domain.Entities;

namespace BankMapper.Application.FileParsing;

public interface IFileParser
{
    ParsedFileResult Parse(Stream fileStream, SourceSchema schema);
}
