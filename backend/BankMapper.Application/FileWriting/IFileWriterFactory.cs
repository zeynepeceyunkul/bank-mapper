using BankMapper.Domain.Enums;

namespace BankMapper.Application.FileWriting;

public interface IFileWriterFactory
{
    IFileWriter GetWriter(FileFormat format);
}
