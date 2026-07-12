namespace BankMapper.Application.SourceSchemas;

public interface ISourceSchemaService
{
    Task<List<SourceSchemaDto>> GetAllAsync();

    Task<SourceSchemaDto> CreateAsync(CreateSourceSchemaRequest request);
}
