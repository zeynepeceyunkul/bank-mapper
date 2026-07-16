namespace BankMapper.Application.Mappings;

public interface IMappingService
{
    Task<List<MappingDto>> GetAllAsync();

    Task<MappingDto?> GetByIdAsync(string id);

    Task<MappingDto> CreateAsync(CreateMappingRequest request);

    Task<MappingDto?> UpdateAsync(string id, CreateMappingRequest request);
}
