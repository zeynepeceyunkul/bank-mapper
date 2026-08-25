using BankMapper.Application.FieldMatching;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;

namespace BankMapper.Api.Controllers;

// Eskiden hicbir [Authorize] yoktu (herkes cagirabiliyordu), frontend'deki
// requireEditPermission() (Admin+MappingDefiner) ile tutarsizdi - Viewer/
// Approver bu ucu API'den dogrudan cagirabilirdi. MappingManage policy'si
// zaten tam olarak ayni rol setini tasidigi icin tekrar kullanildi (Ece'nin
// karari, 2026-08-22: backend'i frontend'e uydur, tersini degil).
[ApiController]
[Route("api/field-match-suggestions")]
[Authorize(Policy = "MappingManage")]
[EnableRateLimiting("ai-suggestion")]
public class FieldMatchSuggestionsController(IFieldMatchSuggestionService service) : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<List<FieldMatchSuggestion>>> Suggest(SuggestFieldMatchesRequest request) =>
        Ok(await service.SuggestAsync(request.SourceFieldNames, request.TargetFields));
}
