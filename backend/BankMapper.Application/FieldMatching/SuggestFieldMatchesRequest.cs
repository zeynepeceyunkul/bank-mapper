namespace BankMapper.Application.FieldMatching;

public class SuggestFieldMatchesRequest
{
    public List<string> SourceFieldNames { get; set; } = [];

    public List<TargetFieldInfo> TargetFields { get; set; } = [];
}
