using System.Text;
using BankMapper.Application.Preview;
using Microsoft.AspNetCore.Mvc;

namespace BankMapper.Api.Controllers;

[ApiController]
[Route("api/preview")]
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

        try
        {
            var result = await previewService.ExecuteAsync(form.MappingId, BuildSourceFiles(form));
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
    }

    [HttpPost("convert")]
    public async Task<IActionResult> Convert([FromForm] ExecutePreviewFormRequest form)
    {
        var validationError = Validate(form);
        if (validationError is not null)
        {
            return BadRequest(validationError);
        }

        try
        {
            var csv = await previewService.ConvertToCsvAsync(form.MappingId, BuildSourceFiles(form));
            var bytes = Encoding.UTF8.GetBytes(csv);
            return File(bytes, "text/csv", "donusturulen-dosya.csv");
        }
        catch (ArgumentException ex)
        {
            return BadRequest(ex.Message);
        }
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
            .Select((file, i) => new PreviewSourceFile { SourceSchemaId = form.SourceSchemaIds[i], Content = file.OpenReadStream() })
            .ToList();
}
