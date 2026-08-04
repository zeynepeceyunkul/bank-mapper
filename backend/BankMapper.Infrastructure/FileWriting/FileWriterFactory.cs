using BankMapper.Application.FileWriting;
using BankMapper.Domain.Enums;

namespace BankMapper.Infrastructure.FileWriting;

public class FileWriterFactory : IFileWriterFactory
{
    public IFileWriter GetWriter(FileFormat format) => format switch
    {
        FileFormat.Csv => new CsvFileWriter(),
        FileFormat.Excel => new ExcelFileWriter(),
        _ => throw new ArgumentException($"Bu format icin disa aktarma henuz desteklenmiyor: {format}")
    };
}
