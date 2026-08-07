namespace BankMapper.Application.FieldMatching;

public class SuggestFieldMatchesRequest
{
    public List<string> SourceFieldNames { get; set; } = [];

    public List<string> TargetFieldNames { get; set; } = [];
}
