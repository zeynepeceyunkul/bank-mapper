using BankMapper.Domain.Enums;

namespace BankMapper.Application.FileParsing;

public interface IFileParserFactory
{
    IFileParser GetParser(FileFormat format);
}
