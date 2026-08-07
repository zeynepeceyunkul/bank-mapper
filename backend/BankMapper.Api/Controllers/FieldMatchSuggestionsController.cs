using BankMapper.Application.FieldMatching;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/field-match-suggestions")]
public class FieldMatchSuggestionsController(IFieldMatchSuggestionService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<List<FieldMatchSuggestion>>> Suggest(SuggestFieldMatchesRequest request) =>
        Ok(await service.SuggestAsync(request.SourceFieldNames, request.TargetFieldNames));
}
