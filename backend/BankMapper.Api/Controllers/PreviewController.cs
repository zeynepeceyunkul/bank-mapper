using BankMapper.Application.Preview;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/preview")]
[Authorize(Policy = "Convert")]
public class PreviewController(IPreviewService previewService) : ControllerBase
{
    [HttpPost("execute")]
    public async Task<ActionResult<PreviewExecuteResult>> Execute([FromForm] ExecutePreviewFormRequest form)
    {
        var validationError = Validate(form);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var result = await previewService.ExecuteAsync(form.MappingId, BuildSourceFiles(form));
        return Ok(result);
    }

    [HttpPost("convert")]
    public async Task<IActionResult> Convert([FromForm] ConvertPreviewFormRequest form)
    {
        var validationError = Validate(form);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        var result = await previewService.ConvertAsync(form.MappingId, BuildSourceFiles(form), form.Format);
        return File(result.Content, result.ContentType, result.FileName);
    }

    private static string? Validate(ExecutePreviewFormRequest form)
    {
        if (form.Files.Count == 0)
        {
            return "En az bir dosya yüklenmesi gerekir.";
        }

        if (form.Files.Count != form.SourceSchemaIds.Count)
        {
            return "Her dosya için bir source şema id'si belirtilmelidir.";
        }

        return null;
    }

    private static List<PreviewSourceFile> BuildSourceFiles(ExecutePreviewFormRequest form) =>
        form.Files
            .Select((file, i) => new PreviewSourceFile
            {
                SourceSchemaId = form.SourceSchemaIds[i],
                Content = file.OpenReadStream(),
                FileName = file.FileName,
            })
            .ToList();
}
