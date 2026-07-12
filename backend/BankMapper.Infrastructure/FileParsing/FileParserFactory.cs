using BankMapper.Application.FileParsing;
using BankMapper.Domain.Enums;

namespace BankMapper.Infrastructure.FileParsing;

public class FileParserFactory : IFileParserFactory
{
    public IFileParser GetParser(FileFormat format) => format switch
    {
        FileFormat.Excel => new ExcelParser(),
        FileFormat.Csv => new CsvParser(),
        FileFormat.FixedLength => new FixedLengthParser(),
        _ => throw new NotSupportedException($"Desteklenmeyen dosya formati: {format}")
    };
}
