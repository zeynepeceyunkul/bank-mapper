namespace BankMapper.Application.Functoids;

public class FunctoidDto
{
    public string Code { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public List<FunctoidParameterDto> Parameters { get; set; } = [];
}
