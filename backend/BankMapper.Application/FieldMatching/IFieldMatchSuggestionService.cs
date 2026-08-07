namespace BankMapper.Application.FieldMatching;

public interface IFieldMatchSuggestionService
{
    Task<List<FieldMatchSuggestion>> SuggestAsync(List<string> sourceFieldNames, List<string> targetFieldNames);
}
