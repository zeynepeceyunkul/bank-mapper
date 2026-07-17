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
            .Select(code =>
            {
                var dto = Definitions.TryGetValue(code, out var definition) ? definition : new FunctoidDto { Code = code, Name = code };
                dto.InputPorts = BuildPorts(registry.Get(code).InputPorts);
                return dto;
            })
            .ToList();

    // Domain (IFunctoid.InputPorts) is the source of truth for arity; burada sadece
    // Türkçe etiket üretiliyor, tek port varsa "Değer", birden fazlaysa "Değer 1", "Değer 2"...
    private static List<FunctoidPortDto> BuildPorts(IReadOnlyList<string> portNames) =>
        portNames.Count == 1
            ? [new FunctoidPortDto { Name = portNames[0], Label = "Değer" }]
            : portNames.Select((name, index) => new FunctoidPortDto { Name = name, Label = $"Değer {index + 1}" }).ToList();
}
