using BankMapper.Domain.Enums;

namespace BankMapper.Api.Controllers;

public class ConvertPreviewFormRequest : ExecutePreviewFormRequest
{
    public FileFormat Format { get; set; } = FileFormat.Csv;
}
