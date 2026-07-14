using BankMapper.Domain.Functoids;

namespace BankMapper.Application.Functoids;

public class FunctoidService(FunctoidRegistry registry) : IFunctoidService
{
    private static readonly Dictionary<string, FunctoidDto> Definitions = new()
    {
        ["Trim"] = new FunctoidDto { Code = "Trim", Name = "Trim (Baş/Son Boşluk Kırp)" },
        ["Upper"] = new FunctoidDto { Code = "Upper", Name = "Upper (Büyük Harf)" },
        ["Lower"] = new FunctoidDto { Code = "Lower", Name = "Lower (Küçük Harf)" },
        ["Concat"] = new FunctoidDto
        {
            Code = "Concat",
            Name = "Concat (Birleştir)",
            Parameters = [new FunctoidParameterDto { Key = "separator", Label = "Ayraç", Type = "string" }],
        },
        ["LPad"] = new FunctoidDto
        {
            Code = "LPad",
            Name = "LPad (Sola Dolgu)",
            Parameters =
            [
                new FunctoidParameterDto { Key = "length", Label = "Uzunluk", Type = "number" },
                new FunctoidParameterDto { Key = "padChar", Label = "Dolgu Karakteri", Type = "string" },
            ],
        },
        ["RPad"] = new FunctoidDto
        {
            Code = "RPad",
            Name = "RPad (Sağa Dolgu)",
            Parameters =
            [
                new FunctoidParameterDto { Key = "length", Label = "Uzunluk", Type = "number" },
                new FunctoidParameterDto { Key = "padChar", Label = "Dolgu Karakteri", Type = "string" },
            ],
        },
    };

    public List<FunctoidDto> GetAll() =>
        registry.AvailableCodes
            .Select(code => Definitions.TryGetValue(code, out var dto) ? dto : new FunctoidDto { Code = code, Name = code })
            .ToList();
}
