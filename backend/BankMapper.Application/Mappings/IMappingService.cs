namespace BankMapper.Application.Mappings;

public interface IMappingService
{
    Task<MappingDto> CreateAsync(CreateMappingRequest request);
}
